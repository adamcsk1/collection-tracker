export interface OpenLibraryAuthorRefModel {
  key?: string;
  name?: string;
  author?: { key?: string };
}

export interface OpenLibraryDescriptionModel {
  value?: string;
}

export interface OpenLibrarySearchDocumentModel {
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number | string;
  key?: string;
  subject?: string[];
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
  key?: string;
  first_publish_date?: string;
  works?: { key?: string }[];
}
