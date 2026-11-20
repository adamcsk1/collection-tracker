import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import { parseGenreText } from '@shared/utils/collection-item-text-util';
import { extractBookId, normalizeBookId, normalizeWorkId } from '@shared/utils/discovery-identity-util';
import { ExternalMetadataProvider } from '@node/models/external-metadata-runtime-model';
import {
  DEFAULT_OPENLIBRARY_API_URL,
  DEFAULT_OPENLIBRARY_COVER_URL,
  OPENLIBRARY_REQUEST_INTERVAL_MS,
  OPENLIBRARY_USER_AGENT,
} from './openlibrary-const';
import { OpenLibraryBookModel, OpenLibrarySearchResponseModel } from './openlibrary-model';

const FETCH_TIMEOUT_MS = 10_000;
const SEARCH_LIMIT = 20;
const AUTHOR_LIMIT = 5;
let nextRequestAt = 0;

export class OpenLibraryExternalMetadataProvider implements ExternalMetadataProvider {
  public readonly name = 'openlibrary' as const;
  private readonly apiUrl: string;

  constructor(apiUrl = DEFAULT_OPENLIBRARY_API_URL) {
    const normalizedApiUrl = new URL(apiUrl);
    normalizedApiUrl.pathname = `${normalizedApiUrl.pathname.replace(/\/$/, '')}/`;
    this.apiUrl = normalizedApiUrl.href;
  }

  public async search(searchText: string): Promise<ExternalMetadataSearchResponseModel> {
    const identity = extractBookId(searchText);
    if (identity) {
      const item = await this.getDetails(identity, 'M', true);
      return { results: item ? [item] : [] };
    }

    const url = new URL('search.json', this.apiUrl);
    url.searchParams.set('q', searchText);
    url.searchParams.set('limit', `${SEARCH_LIMIT}`);
    url.searchParams.set('fields', 'key,title,author_name,first_publish_year,subject,cover_i');
    const data = (await this.fetchJson(url)) as OpenLibrarySearchResponseModel | null;
    const seenWorks = new Set<string>();
    const results = (Array.isArray(data?.docs) ? data.docs : []).flatMap((document) => {
      if (!this.isObject(document)) return [];
      const workId = normalizeWorkId(this.getString(document.key));
      const title = this.getString(document.title);
      if (!workId || !title || seenWorks.has(workId)) return [];
      seenWorks.add(workId);
      return [
        {
          provider: this.name,
          providerItemId: workId,
          externalIds: [{ source: this.name, id: workId }],
          title,
          year: this.extractYear(String(document.first_publish_year ?? '')),
          contentType: 'book' as const,
          poster: this.getCoverUrl(workId, 'M', document.cover_i),
          plot: '',
          actors: this.getStringArray(document.author_name).join(', '),
          genres: this.getStringArray(document.subject).flatMap(parseGenreText),
          ratings: [],
        },
      ];
    });
    return { results };
  }

  public async getItem(providerItemId: string): Promise<ExternalMetadataItemModel | null> {
    const identity = normalizeBookId(providerItemId);
    return identity ? this.getDetails(identity, 'L') : null;
  }

  private async getDetails(
    identity: string,
    coverSize: 'M' | 'L',
    discovery = false
  ): Promise<ExternalMetadataItemModel | null> {
    const workId = normalizeWorkId(identity);
    const data = await this.fetchJson(new URL(workId ? `works/${workId}.json` : `isbn/${identity}.json`, this.apiUrl));
    if (!this.isObject(data) || !this.getString(data.title)) return null;
    const book = data as OpenLibraryBookModel;
    const linkedWorks = Array.isArray(book.works)
      ? [
          ...new Set(
            book.works.flatMap((work) => (this.isObject(work) ? (normalizeWorkId(this.getString(work.key)) ?? []) : []))
          ),
        ]
      : [];
    const linkedWorkId = workId ?? (linkedWorks.length === 1 ? linkedWorks[0] : undefined);
    let work: OpenLibraryBookModel | null = workId ? book : null;
    if (!workId && linkedWorkId) {
      // Edition lookup remains usable when optional work enrichment is unavailable.
      try {
        const linkedWork = await this.fetchJson(new URL(`works/${linkedWorkId}.json`, this.apiUrl));
        if (this.isObject(linkedWork) && this.getString(linkedWork.title)) work = linkedWork as OpenLibraryBookModel;
      } catch {
        /* Keep the edition metadata. */
      }
    }
    const authors = await this.getAuthors(book);
    const fallbackAuthors = !authors && work && work !== book ? await this.getAuthors(work) : '';
    const displayBook = discovery && work ? work : book;
    return {
      provider: this.name,
      providerItemId: discovery && work && linkedWorkId ? linkedWorkId : identity,
      externalIds: workId
        ? [{ source: this.name, id: workId }]
        : [{ source: 'isbn', id: identity }, ...(linkedWorkId ? [{ source: this.name, id: linkedWorkId }] : [])],
      title: this.getString(displayBook.title),
      year: this.extractYear(
        this.getString(displayBook.first_publish_date) || this.getString(displayBook.publish_date)
      ),
      contentType: 'book',
      poster: this.getCoverUrl(
        identity,
        coverSize,
        this.getPositiveCoverId(book.covers) ?? this.getPositiveCoverId(work?.covers)
      ),
      plot: this.getDescription(book.description) || this.getDescription(work?.description),
      actors: authors || fallbackAuthors || this.getString(book.by_statement),
      genres: this.getStringArray(book.subjects?.length ? book.subjects : work?.subjects).flatMap(parseGenreText),
      ratings: [],
    };
  }

  private async getAuthors(book: OpenLibraryBookModel): Promise<string> {
    if (!Array.isArray(book.authors)) return '';
    const names = await Promise.all(
      book.authors.slice(0, AUTHOR_LIMIT).map(async (author) => {
        if (!this.isObject(author)) return '';
        const embeddedName = this.getString(author.name);
        const key = this.getString(author.key) || this.getString(this.isObject(author.author) ? author.author.key : '');
        if (embeddedName || !/^\/authors\/OL\d+A$/i.test(key)) return embeddedName;
        try {
          const data = await this.fetchJson(new URL(`${key.slice(1)}.json`, this.apiUrl));
          return this.isObject(data) ? this.getString(data.name) : '';
        } catch {
          return '';
        }
      })
    );
    return names.filter(Boolean).join(', ');
  }

  private async fetchJson(url: URL): Promise<unknown> {
    if (url.hostname === new URL(DEFAULT_OPENLIBRARY_API_URL).hostname) {
      const requestAt = Math.max(Date.now(), nextRequestAt);
      nextRequestAt = requestAt + OPENLIBRARY_REQUEST_INTERVAL_MS;
      const delay = requestAt - Date.now();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const response = await fetch(url.href, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': OPENLIBRARY_USER_AGENT, Accept: 'application/json' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${this.name} responded with ${response.status}`);
    return response.json();
  }

  private getCoverUrl(identity: string, size: 'M' | 'L', covers?: unknown): string {
    const coverId = this.getPositiveCoverId(covers);
    if (!coverId && normalizeWorkId(identity)) return '';
    const url = new URL(
      coverId ? `b/id/${coverId}-${size}.jpg` : `b/isbn/${identity}-${size}.jpg`,
      DEFAULT_OPENLIBRARY_COVER_URL
    );
    url.searchParams.set('default', 'false');
    return url.href;
  }

  private getPositiveCoverId(value: unknown): number | null {
    const coverIds: unknown[] = Array.isArray(value) ? value : [value];
    return (
      coverIds.find(
        (coverId): coverId is number => typeof coverId === 'number' && Number.isInteger(coverId) && coverId > 0
      ) ?? null
    );
  }

  private getDescription(value: unknown): string {
    return this.getString(value) || (this.isObject(value) ? this.getString(value.value) : '');
  }

  private getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private getStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.flatMap((entry) => this.getString(entry) || []) : [];
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private extractYear(value: string): string {
    return value.match(/\b\d{4}\b/)?.[0] ?? '';
  }
}
