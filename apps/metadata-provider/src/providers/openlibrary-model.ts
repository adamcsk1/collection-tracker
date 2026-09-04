export interface OpenLibrarySearchDocumentModel {
  author_name?: unknown;
  cover_i?: unknown;
  cover_edition_key?: unknown;
  editions?: { docs?: OpenLibraryEditionModel[] };
  first_publish_year?: unknown;
  isbn?: unknown;
  key?: unknown;
  subject?: unknown;
  title?: unknown;
}

export interface OpenLibraryEditionModel {
  cover_i?: unknown;
  isbn?: unknown;
  isbn_10?: unknown;
  isbn_13?: unknown;
  key?: unknown;
  title?: unknown;
}

export interface OpenLibrarySearchResponseModel {
  docs?: OpenLibrarySearchDocumentModel[];
}

export interface OpenLibraryBookModel {
  authors?: Array<{ key?: unknown; name?: unknown }>;
  by_statement?: unknown;
  covers?: unknown;
  description?: unknown;
  publish_date?: unknown;
  subjects?: unknown;
  title?: unknown;
}

export interface OpenLibraryAuthorModel {
  name?: unknown;
}
