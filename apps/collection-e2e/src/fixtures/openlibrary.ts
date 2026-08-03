const isbn = '9780306406157';

export const buildOpenLibraryItem = (title: string, itemIsbn = isbn) => ({
  provider: 'openlibrary',
  providerItemId: itemIsbn,
  externalIds: [{ source: 'isbn', id: itemIsbn }],
  title,
  year: '1965',
  contentType: 'book',
  poster: '',
  plot: 'A test book description for e2e testing.',
  actors: 'Author One, Author Two',
  genres: ['Science fiction'],
  ratings: [],
});

export const buildOpenLibrarySearchResult = (title: string, itemIsbn = isbn) => ({
  results: [buildOpenLibraryItem(title, itemIsbn)],
});

export const buildBookTrackerItem = (title: string, itemIsbn = isbn) => ({
  image: '',
  title,
  genre: ['Science fiction'],
  IMDbId: '',
  externalProvider: 'openlibrary',
  externalItemId: itemIsbn,
  externalIds: [{ source: 'isbn', id: itemIsbn }],
  tags: [],
  year: '1965',
  rate: '',
  rottenTomatoesRate: '',
  metacriticRate: '',
  userRate: null,
  actors: 'Author One, Author Two',
  plot: 'A test book description for e2e testing.',
  contentType: 'book',
  favorite: false,
  listType: 'book-tracker',
});
