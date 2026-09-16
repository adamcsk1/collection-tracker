export interface OpenLibraryAuthorRefModel {
  key?: string;
  name?: string;
}

export interface OpenLibraryDescriptionModel {
  value?: string;
}

export interface OpenLibrarySearchDocumentModel {
  author_name?: string[];
  cover_i?: number;
  cover_edition_key?: string;
  editions?: { docs?: OpenLibraryEditionModel[] };
  first_publish_year?: number | string;
  isbn?: string[];
  key?: string;
  subject?: string[];
  title?: string;
}

export interface OpenLibraryEditionModel {
  cover_i?: number;
  isbn?: string[];
  isbn_10?: string[];
  isbn_13?: string[];
  key?: string;
  title?: string;
}

export interface OpenLibrarySearchResponseModel {
  docs?: OpenLibrarySearchDocumentModel[];
}

export interface OpenLibraryBookModel {
  authors?: OpenLibraryAuthorRefModel[];
  by_statement?: string;
  covers?: number[];
  description?: string | OpenLibraryDescriptionModel;
  publish_date?: string;
  subjects?: string[];
  title?: string;
}

export interface OpenLibraryAuthorModel {
  name?: string;
}
