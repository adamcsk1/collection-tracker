import { ExternalMetadataItemModel, ExternalMetadataSearchResponseModel } from '@shared/models/external-metadata-model';
import { normalizeIsbn13 } from '../../utils/isbn-util';
import { ExternalMetadataProvider } from '../external-metadata-provider';
import { DEFAULT_OPENLIBRARY_API_URL, DEFAULT_OPENLIBRARY_COVER_URL } from './openlibrary-const';
import {
  OpenLibraryAuthorModel,
  OpenLibraryBookModel,
  OpenLibraryEditionModel,
  OpenLibrarySearchDocumentModel,
  OpenLibrarySearchResponseModel,
} from './openlibrary-model';

const SEARCH_LIMIT = 20;
const SEARCH_FIELDS = [
  'key',
  'title',
  'author_name',
  'first_publish_year',
  'subject',
  'cover_i',
  'cover_edition_key',
  'editions',
  'editions.key',
  'editions.title',
  'editions.isbn',
  'editions.cover_i',
].join(',');
const AUTHOR_LIMIT = 5;

export class OpenLibraryExternalMetadataProvider implements ExternalMetadataProvider {
  public readonly name = 'openlibrary';
  private readonly apiUrl: string;

  constructor(apiUrl = DEFAULT_OPENLIBRARY_API_URL) {
    const normalizedApiUrl = new URL(apiUrl);
    normalizedApiUrl.pathname = `${normalizedApiUrl.pathname.replace(/\/$/, '')}/`;
    this.apiUrl = normalizedApiUrl.href;
  }

  public async search(searchText: string): Promise<ExternalMetadataSearchResponseModel> {
    const searchedIsbn = normalizeIsbn13(searchText);
    if (searchedIsbn) {
      const item = await this.getItemByIsbn(searchedIsbn, 'M');
      return { results: item ? [item] : [] };
    }

    const url = new URL('search.json', this.apiUrl);
    url.searchParams.set('q', searchText);
    url.searchParams.set('limit', `${SEARCH_LIMIT}`);
    url.searchParams.set('fields', SEARCH_FIELDS);
    const data = await this.fetchJson<OpenLibrarySearchResponseModel>(url);
    const seenIsbns = new Set<string>();
    const results = (Array.isArray(data.docs) ? data.docs : []).flatMap((document) => {
      const item = this.toSearchItem(document, searchText);
      if (!item || seenIsbns.has(item.providerItemId)) return [];
      seenIsbns.add(item.providerItemId);
      return [item];
    });
    return { results };
  }

  public async getItem(providerItemId: string): Promise<ExternalMetadataItemModel | null> {
    const isbn = normalizeIsbn13(providerItemId);
    if (!isbn) return null;
    return this.getItemByIsbn(isbn, 'L');
  }

  private async getItemByIsbn(isbn: string, coverSize: 'M' | 'L'): Promise<ExternalMetadataItemModel | null> {
    const url = new URL(`isbn/${isbn}.json`, this.apiUrl);
    const response = await fetch(url.href);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`${this.name} responded with ${response.status}`);
    const book = (await response.json()) as OpenLibraryBookModel;
    const authors = await this.getAuthors(book);
    return {
      provider: this.name,
      providerItemId: isbn,
      externalIds: [{ source: 'isbn', id: isbn }],
      title: this.getString(book.title),
      year: this.extractYear(this.getString(book.publish_date)),
      contentType: 'book',
      poster: this.getCoverUrl(isbn, coverSize, book.covers),
      plot: this.getDescription(book.description),
      actors: authors || this.getString(book.by_statement),
      genres: this.getStringArray(book.subjects),
      ratings: [],
    };
  }

  private async getAuthors(book: OpenLibraryBookModel): Promise<string> {
    if (!Array.isArray(book.authors)) return '';
    const names = await Promise.all(
      book.authors.slice(0, AUTHOR_LIMIT).map(async (author) => {
        const embeddedName = this.getString(author.name);
        const key = this.getString(author.key);
        if (embeddedName || !/^\/authors\/OL[A-Z0-9]+A$/i.test(key)) return embeddedName;
        try {
          const authorData = await this.fetchJson<OpenLibraryAuthorModel>(new URL(`${key.slice(1)}.json`, this.apiUrl));
          return this.getString(authorData.name);
        } catch {
          return '';
        }
      })
    );
    return names.filter(Boolean).join(', ');
  }

  private toSearchItem(document: OpenLibrarySearchDocumentModel, searchText: string): ExternalMetadataItemModel | null {
    const edition = this.getBestEdition(document, searchText);
    const editionIsbns = edition ? this.getCanonicalIsbns(edition.isbn, edition.isbn_13, edition.isbn_10) : [];
    const workIsbns = this.getCanonicalIsbns(document.isbn);
    const isbn = editionIsbns[0] ?? (workIsbns.length === 1 ? workIsbns[0] : null);
    if (!isbn) return null;
    const coverId = this.getPositiveCoverId(edition?.cover_i) ?? this.getPositiveCoverId(document.cover_i);
    return {
      provider: this.name,
      providerItemId: isbn,
      externalIds: [{ source: 'isbn', id: isbn }],
      title: this.getString(document.title),
      year: this.getYear(document.first_publish_year),
      contentType: 'book',
      poster: this.getCoverUrl(isbn, 'M', coverId),
      plot: '',
      actors: this.getStringArray(document.author_name).join(', '),
      genres: this.getStringArray(document.subject),
      ratings: [],
    };
  }

  private getBestEdition(document: OpenLibrarySearchDocumentModel, searchText: string): OpenLibraryEditionModel | null {
    const editions = Array.isArray(document.editions?.docs) ? document.editions.docs : [];
    const coverEditionKey = this.getString(document.cover_edition_key);
    const normalizedSearchTitle = this.normalizeTitle(searchText);
    const normalizedWorkTitle = this.normalizeTitle(this.getString(document.title));
    return (
      editions
        .map((edition) => ({ edition, isbns: this.getCanonicalIsbns(edition.isbn, edition.isbn_13, edition.isbn_10) }))
        .filter(({ isbns }) => isbns.length > 0)
        .map(({ edition, isbns }) => ({
          edition,
          isbn: isbns[0],
          score:
            (coverEditionKey && this.getString(edition.key) === coverEditionKey ? 4 : 0) +
            (normalizedSearchTitle && this.normalizeTitle(this.getString(edition.title)) === normalizedSearchTitle
              ? 2
              : 0) +
            (normalizedWorkTitle && this.normalizeTitle(this.getString(edition.title)) === normalizedWorkTitle ? 1 : 0),
        }))
        .sort((left, right) => right.score - left.score || left.isbn.localeCompare(right.isbn))[0]?.edition ?? null
    );
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url.href);
    if (!response.ok) throw new Error(`${this.name} responded with ${response.status}`);
    return (await response.json()) as T;
  }

  private getCoverUrl(isbn: string, size: 'M' | 'L', covers?: unknown): string {
    const coverId = this.getPositiveCoverId(covers);
    const url = new URL(
      coverId ? `b/id/${coverId}-${size}.jpg` : `b/isbn/${isbn}-${size}.jpg`,
      DEFAULT_OPENLIBRARY_COVER_URL
    );
    url.searchParams.set('default', 'false');
    return url.href;
  }

  private getPositiveCoverId(value: unknown): number | null {
    const coverIds = Array.isArray(value) ? value : [value];
    return coverIds.find((coverId): coverId is number => typeof coverId === 'number' && coverId > 0) ?? null;
  }

  private getCanonicalIsbns(...values: unknown[]): string[] {
    return [
      ...new Set(
        values.flatMap((value) => this.getStringArray(value)).flatMap((value) => normalizeIsbn13(value) ?? [])
      ),
    ].sort();
  }

  private normalizeTitle(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  private getDescription(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'value' in value) return this.getString(value.value);
    return '';
  }

  private getString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private getStringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.flatMap((entry) => (typeof entry === 'string' && entry.trim() ? [entry.trim()] : []))
      : [];
  }

  private getYear(value: unknown): string {
    return typeof value === 'number' && Number.isInteger(value) ? `${value}` : this.extractYear(this.getString(value));
  }

  private extractYear(value: string): string {
    return value.match(/\b\d{4}\b/)?.[0] ?? '';
  }
}
