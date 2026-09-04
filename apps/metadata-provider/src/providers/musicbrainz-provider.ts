import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import { extractBarcode, extractMbid, normalizeMbid } from '@shared/utils/mbid-util';
import { ExternalMetadataProvider } from '../core/external-metadata-provider';
import {
  DEFAULT_COVER_ART_ARCHIVE_URL,
  DEFAULT_MUSICBRAINZ_API_URL,
  MUSICBRAINZ_REQUEST_INTERVAL_MS,
  MUSICBRAINZ_USER_AGENT,
} from './musicbrainz-const';
import { MusicBrainzReleaseModel } from './musicbrainz-model';

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
  public readonly name = 'musicbrainz';
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
    const searchedMbid = extractMbid(searchText);
    if (searchedMbid) {
      const item = await this.getItem(searchedMbid);
      return { results: item ? [item] : [] };
    }

    const url = new URL('release', this.apiUrl);
    const barcode = extractBarcode(searchText);
    url.searchParams.set('query', barcode ? `barcode:${barcode}` : this.toAlbumSearchQuery(searchText));
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('limit', `${SEARCH_LIMIT}`);
    const data = await this.fetchJson<unknown>(url);
    const releases = this.isObject(data) ? data.releases : undefined;
    const seenGroups = new Set<string>();
    const results = (Array.isArray(releases) ? releases : []).flatMap((release) => {
      const item = this.toItem(release, '250');
      if (!item) return [];
      const groupId = this.getReleaseGroupId(release) || item.providerItemId;
      if (seenGroups.has(groupId)) return [];
      seenGroups.add(groupId);
      return [item];
    });
    return { results };
  }

  public async getItem(providerItemId: string): Promise<ExternalMetadataItemModel | null> {
    const mbid = normalizeMbid(providerItemId);
    if (!mbid) return null;
    const url = new URL(`release/${mbid}`, this.apiUrl);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('inc', 'artists+release-groups+tags+media');
    const response = await this.fetchResponse(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${this.name} responded with ${response.status}`);
    const release: unknown = await response.json();
    return this.toItem(release, '500');
  }

  private toItem(release: unknown, coverSize: '250' | '500'): ExternalMetadataItemModel | null {
    if (!this.isObject(release)) return null;
    const mbid = normalizeMbid(this.getString(release.id));
    const title = this.getString(release.title);
    if (!mbid || !title) return null;
    return {
      provider: this.name,
      providerItemId: mbid,
      externalIds: [{ source: 'musicbrainz', id: mbid }],
      title,
      year: this.extractYear(this.getString(release.date)),
      contentType: 'album',
      poster: this.getCoverUrl(mbid, coverSize),
      plot: '',
      actors: this.getArtistCredit(release),
      genres: this.getGenres(release),
      ratings: [],
    };
  }

  private toAlbumSearchQuery(searchText: string): string {
    const escaped = searchText.trim().replace(LUCENE_QUOTE_PATTERN, '\\$&');
    return `${escaped} AND status:official AND primarytype:album`;
  }

  private getReleaseGroupId(release: unknown): string {
    if (!this.isObject(release)) return '';
    const releaseGroup = this.isObject(release['release-group']) ? release['release-group'] : undefined;
    return normalizeMbid(this.getString(releaseGroup?.id)) ?? '';
  }

  private getCoverUrl(mbid: string, size: '250' | '500'): string {
    return new URL(`release/${mbid}/front-${size}`, this.coverUrl).href;
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
    if (url.hostname === MUSICBRAINZ_HOSTNAME) await waitForMusicBrainzRequest();
    return fetch(url.href, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': MUSICBRAINZ_USER_AGENT, Accept: 'application/json' },
    });
  }

  private getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private isObject(value: unknown): value is MusicBrainzReleaseModel {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractYear(value: string): string {
    return value.match(/\b\d{4}\b/)?.[0] ?? '';
  }
}
