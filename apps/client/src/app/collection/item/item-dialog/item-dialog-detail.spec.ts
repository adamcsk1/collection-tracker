import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionItemModel } from '../../collection-model';
import { ItemDialogTranslations } from '../item-form/item-form-model';
import { ItemDialogDetail } from './item-dialog-detail';

const translations: ItemDialogTranslations = {
  delete: signal('Delete'),
  edit: signal('Edit'),
  altPoster: signal('Poster image'),
  fallbackUnknownYear: signal('Unknown year'),
  fallbackNotAvailable: signal('N/A'),
  ratings: signal('Ratings'),
  labelRottenTomatoesRate: signal('Rotten Tomatoes'),
  labelMetacriticRate: signal('Metacritic'),
  labelUserRate: signal('User rate'),
  genre: signal('Genre'),
  actors: signal('Actors'),
  authors: signal('Authors'),
  subjects: signal('Subjects'),
  description: signal('Description'),
  isbn: signal('ISBN'),
  tags: signal('Tags'),
  watchedUpTo: signal('Watched up to'),
  plot: signal('Plot'),
  links: signal('Links'),
  linkYouTubeTrailer: signal('Trailer'),
  linkWebSearch: signal('Web search'),
  manageSeriesMetadata: signal('Manage series metadata'),
  manageCompletedEpisodes: signal('Manage watched episodes'),
  markAsFavorite: signal('Mark as favorite'),
  markAsUnwatched: signal('Mark as unwatched'),
  markAsWatched: signal('Mark as watched'),
  copyToTracking: signal('Add to Tracking'),
  moveToWatched: signal('Move to Watched'),
  moveToTracking: signal('Move to Tracking'),
  openInTracking: signal('Open in Tracking'),
  removeFavorite: signal('Remove favorite'),
  removeFromTracking: signal('Remove from Tracking'),
  readingProgress: signal('Reading progress'),
  pagesRead: signal('Pages read'),
  totalPages: signal('Total pages'),
};

const item: CollectionItemModel = {
  image: 'https://example.com/poster.jpg',
  title: 'Test Movie',
  titleLower: 'test movie',
  genre: ['Drama'],
  IMDbId: 'tt1234567',
  externalProvider: 'omdb',
  externalItemId: 'tt1234567',
  tags: [],
  year: '2020',
  rate: '8.5',
  rottenTomatoesRate: '90%',
  metacriticRate: '80/100',
  userRate: 9,
  hash: 'hash',
  actors: 'Actor One',
  plot: 'Plot text',
  listType: 'library',
  contentType: 'movie',
  favorite: false,
  watchedAt: null,
};

describe('ItemDialogDetail', () => {
  let fixture: ComponentFixture<ItemDialogDetail>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ItemDialogDetail] });
    fixture = TestBed.createComponent(ItemDialogDetail);
    fixture.componentRef.setInput('collectionItem', item);
    fixture.componentRef.setInput('translations', translations);
    fixture.componentRef.setInput('posterImageFailed', false);
    fixture.componentRef.setInput('imageUrl', 'proxy-poster.jpg');
    fixture.componentRef.setInput('imdbUrl', 'https://www.imdb.com/title/tt1234567/');
    fixture.componentRef.setInput('trailerUrl', 'https://youtube.example/trailer');
    fixture.componentRef.setInput('webSearchUrl', 'https://search.example');
    fixture.componentRef.setInput('isShared', true);
    fixture.componentRef.setInput('library', 'Shared Owner');
    fixture.componentRef.setInput('detailTags', ['#drama']);
    fixture.componentRef.setInput('tracking', true);
    fixture.componentRef.setInput('book', false);
    fixture.componentRef.setInput('isbn', '');
    fixture.componentRef.setInput('episodeProgressText', 'S01E02');
    fixture.detectChanges();
  });

  it('renders shared metadata, tags, and series progress', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-test-id="item-dialog-shared-library"]')?.textContent).toContain('Shared Owner');
    expect(element.querySelector('[data-test-id="item-dialog-tags-section"]')?.textContent).toContain('#drama');
    expect(element.querySelector('[data-test-id="item-dialog-episode-progress-chip"]')?.textContent).toContain(
      'S01E02'
    );
  });

  it('emits poster image errors from the poster image', () => {
    const posterImageError = vi.fn();
    fixture.componentInstance.posterImageError.subscribe(posterImageError);

    const image = (fixture.nativeElement as HTMLElement).querySelector('img');
    image?.dispatchEvent(new Event('error'));

    expect(posterImageError).toHaveBeenCalled();
  });

  it('hides the poster when the poster image has failed', () => {
    fixture.componentRef.setInput('posterImageFailed', true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('img')).toBeNull();
  });

  it('shows book metadata without movie ratings or trailer actions', () => {
    fixture.componentRef.setInput('collectionItem', {
      ...item,
      IMDbId: undefined,
      contentType: 'book',
      listType: 'books',
      externalProvider: 'openlibrary',
      externalItemId: 'OL7353617M',
      userRate: null,
    });
    fixture.componentRef.setInput('book', true);
    fixture.componentRef.setInput('tracking', false);
    fixture.componentRef.setInput('isbn', '9780441172719');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-test-id="item-dialog-isbn"]')?.textContent).toContain('9780441172719');
    expect(element.textContent).toContain('Authors');
    expect(element.textContent).toContain('Description');
    expect(element.textContent).not.toContain('IMDb');
    expect(element.querySelector('[data-test-id="video"]')).toBeNull();
  });
});
