import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import { extractBarcode, normalizeMbid } from '@shared/utils/mbid-util';
import { extractMusicId, normalizeMusicId } from '@shared/utils/discovery-identity-util';
import { ExternalMetadataProvider } from '@node/models/external-metadata-runtime-model';
import {
  DEFAULT_COVER_ART_ARCHIVE_URL,
  DEFAULT_MUSICBRAINZ_API_URL,
  MUSICBRAINZ_REQUEST_INTERVAL_MS,
  MUSICBRAINZ_USER_AGENT,
} from './musicbrainz-const';
import { MusicBrainzReleaseModel, MusicBrainzSearchResponseModel } from './musicbrainz-model';

const FETCH_TIMEOUT_MS = 10_000;
const SEARCH_LIMIT = 20;
const LUCENE_QUOTE_PATTERN = /[\\"]/g;
const MUSICBRAINZ_HOSTNAME = new URL(DEFAULT_MUSICBRAINZ_API_URL).hostname;
let nextMusicBrainzRequestAt = 0;
let musicBrainzRequestQueue = Promise.resolve();

const waitForMusicBrainzRequest = async (): Promise<void> => {
  const previousRequest = musicBrainzRequestQueue;
  let releaseRequest: () => void = () => undefined;
  musicBrainzRequestQueue = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await previousRequest;
  const delay = Math.max(0, nextMusicBrainzRequestAt - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  nextMusicBrainzRequestAt = Date.now() + MUSICBRAINZ_REQUEST_INTERVAL_MS;
  releaseRequest();
};

export class MusicBrainzExternalMetadataProvider implements ExternalMetadataProvider {
  public readonly name = 'musicbrainz' as const;
  private readonly apiUrl: string;
  private readonly coverUrl: string;

  constructor(apiUrl = DEFAULT_MUSICBRAINZ_API_URL, coverUrl = DEFAULT_COVER_ART_ARCHIVE_URL) {
    const normalizedApiUrl = new URL(apiUrl);
    normalizedApiUrl.pathname = `${normalizedApiUrl.pathname.replace(/\/$/, '')}/`;
    this.apiUrl = normalizedApiUrl.href;
    const normalizedCoverUrl = new URL(coverUrl);
    normalizedCoverUrl.pathname = `${normalizedCoverUrl.pathname.replace(/\/$/, '')}/`;
    this.coverUrl = normalizedCoverUrl.href;
  }

  public async search(searchText: string): Promise<ExternalMetadataSearchResponseModel> {
    const searchedMbid = extractMusicId(searchText);
    if (searchedMbid) {
      const item = await this.getItem(searchedMbid);
      return { results: item ? [this.toDiscoveryItem(item)] : [] };
    }

    const barcode = extractBarcode(searchText);
    const query = barcode ? `barcode:${barcode}` : this.toAlbumSearchQuery(searchText);
    if (!query) return { results: [] };
    const url = new URL(barcode ? 'release' : 'release-group', this.apiUrl);
    url.searchParams.set('query', query);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('limit', `${SEARCH_LIMIT}`);
    const data = await this.fetchJson<MusicBrainzSearchResponseModel>(url);
    const candidates = barcode ? data?.releases : data?.['release-groups'];
    const releases = Array.isArray(candidates) ? candidates : [];
    const seenGroups = new Set<string>();
    const results = releases.flatMap((release) => {
      const mapped = this.toItem(release, '250', !barcode);
      if (!mapped) return [];
      const item = this.toDiscoveryItem(mapped);
      const groupId = item.providerItemId;
      if (seenGroups.has(groupId)) return [];
      seenGroups.add(groupId);
      return [item];
    });
    return { results };
  }

  public async getItem(providerItemId: string): Promise<ExternalMetadataItemModel | null> {
    const identity = normalizeMusicId(providerItemId);
    if (!identity) return null;
    const isGroup = identity.startsWith('release-group:');
    const mbid = isGroup ? identity.slice('release-group:'.length) : identity;
    const url = new URL(`${isGroup ? 'release-group' : 'release'}/${mbid}`, this.apiUrl);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('inc', isGroup ? 'artists+tags' : 'artists+release-groups+tags+media');
    const response = await this.fetchResponse(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${this.name} responded with ${response.status}`);
    const release: unknown = await response.json();
    return this.toItem(release, '500', isGroup);
  }

  private toItem(release: unknown, coverSize: '250' | '500', isGroup = false): ExternalMetadataItemModel | null {
    if (!this.isObject(release)) return null;
    const parsed = release as MusicBrainzReleaseModel;
    const mbid = normalizeMbid(this.getString(parsed.id));
    const title = this.getString(parsed.title);
    if (!mbid || !title) return null;
    const identity = isGroup ? `release-group:${mbid}` : mbid;
    const groupId = this.getReleaseGroupId(release);
    return {
      provider: this.name,
      providerItemId: identity,
      externalIds: [
        { source: 'musicbrainz', id: identity },
        ...(groupId ? [{ source: this.name, id: `release-group:${groupId}` }] : []),
      ],
      title,
      year: this.extractYear(this.getString(isGroup ? release['first-release-date'] : parsed.date)),
      contentType: 'album',
      poster: this.getCoverUrl(mbid, coverSize, isGroup),
      plot: '',
      actors: this.getArtistCredit(parsed),
      genres: this.getGenres(parsed),
      ratings: [],
    };
  }

  private toAlbumSearchQuery(searchText: string): string {
    const terms = searchText
      .trim()
      .split(/\s+/)
      .filter((term) => /[\p{L}\p{N}]/u.test(term));
    if (!terms.length) return '';
    const query = terms
      .map((term) => {
        const escaped = term.replace(LUCENE_QUOTE_PATTERN, '\\$&');
        return `(releasegroup:"${escaped}" OR artist:"${escaped}")`;
      })
      .join(' AND ');
    return `${query} AND (primarytype:album OR primarytype:ep OR primarytype:single)`;
  }

  private toDiscoveryItem(item: ExternalMetadataItemModel): ExternalMetadataItemModel {
    const group = item.externalIds?.find((identity) => identity.id.startsWith('release-group:'));
    return group ? { ...item, providerItemId: group.id } : item;
  }

  private getReleaseGroupId(release: unknown): string {
    if (!this.isObject(release)) return '';
    const releaseGroup = (release as MusicBrainzReleaseModel)['release-group'];
    return normalizeMbid(this.getString(releaseGroup?.id)) ?? '';
  }

  private getCoverUrl(mbid: string, size: '250' | '500', isGroup = false): string {
    return new URL(`${isGroup ? 'release-group' : 'release'}/${mbid}/front-${size}`, this.coverUrl).href;
  }

  private getArtistCredit(release: MusicBrainzReleaseModel): string {
    const credits = Array.isArray(release['artist-credit']) ? release['artist-credit'] : [];
    return credits
      .map((credit) => {
        if (!this.isObject(credit)) return '';
        const artist = this.isObject(credit.artist) ? credit.artist : undefined;
        return this.getString(credit.name) || this.getString(artist?.name);
      })
      .filter(Boolean)
      .join(', ');
  }

  private getGenres(release: MusicBrainzReleaseModel): string[] {
    const releaseGroup = this.isObject(release['release-group']) ? release['release-group'] : undefined;
    const tags = [
      ...(Array.isArray(release.tags) ? release.tags : []),
      ...(Array.isArray(releaseGroup?.tags) ? releaseGroup.tags : []),
    ];
    return [...new Set(tags.map((tag) => this.getString(this.isObject(tag) ? tag.name : undefined)).filter(Boolean))];
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await this.fetchResponse(url);
    if (!response.ok) throw new Error(`${this.name} responded with ${response.status}`);
    return (await response.json()) as T;
  }

  private async fetchResponse(url: URL): Promise<Response> {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    for (let attempt = 0; ; attempt++) {
      if (url.hostname === MUSICBRAINZ_HOSTNAME) await waitForMusicBrainzRequest();
      signal.throwIfAborted();
      const response = await fetch(url.href, {
        signal,
        headers: { 'User-Agent': MUSICBRAINZ_USER_AGENT, Accept: 'application/json' },
      });
      if (response.status !== 429 && response.status !== 503) return response;
      const retryAfter = response.headers.get('retry-after');
      const requestedDelay =
        retryAfter === null
          ? NaN
          : /^\d+$/.test(retryAfter)
            ? Number(retryAfter) * 1000
            : Date.parse(retryAfter) - Date.now();
      const delay = Math.max(1000, Number.isFinite(requestedDelay) ? requestedDelay : 1000);
      await response.body?.cancel();
      // Do not retry earlier than requested when the upstream delay exceeds our retry budget.
      if (attempt >= 2 || delay > 2000) {
        throw Object.assign(new Error(`${this.name} responded with ${response.status}`), { statusCode: 503 });
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractYear(value: string): string {
    return value.match(/\b\d{4}\b/)?.[0] ?? '';
  }
}
