import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionItemModel } from '../../collection-model';
import { ItemDialogDetail } from './item-dialog-detail';
import { ItemDialogTranslations } from './item-dialog-types';

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
  tags: signal('Tags'),
  systemTags: signal('System tags'),
  watchedUpTo: signal('Watched up to'),
  plot: signal('Plot'),
  links: signal('Links'),
  linkYouTubeTrailer: signal('Trailer'),
  linkWebSearch: signal('Web search'),
  manageSeriesMetadata: signal('Manage series metadata'),
  manageWatchedEpisodes: signal('Manage watched episodes'),
  markAsFavorite: signal('Mark as favorite'),
  markAsUnwatched: signal('Mark as unwatched'),
  markAsWatched: signal('Mark as watched'),
  copyToSeriesTracker: signal('Copy to series tracker'),
  moveToMovieTracker: signal('Move to movie tracker'),
  moveToSeriesTracker: signal('Move to series tracker'),
  removeFavorite: signal('Remove favorite'),
};

const item: CollectionItemModel = {
  image: 'https://example.com/poster.jpg',
  title: 'Test Movie',
  titleLower: 'test movie',
  genre: ['Drama'],
  IMDbId: 'tt1234567',
  tags: ['#movie'],
  year: '2020',
  rate: '8.5',
  rottenTomatoesRate: '90%',
  metacriticRate: '80/100',
  userRate: 9,
  hash: 'hash',
  actors: 'Actor One',
  plot: 'Plot text',
  listType: 'library',
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
    fixture.componentRef.setInput('systemTags', ['#movie']);
    fixture.componentRef.setInput('seriesTracker', true);
    fixture.componentRef.setInput('episodeProgressText', 'S01E02');
    fixture.detectChanges();
  });

  it('renders shared metadata, tags, system tags, and series progress', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-test-id="item-dialog-shared-library"]')?.textContent).toContain('Shared Owner');
    expect(element.querySelector('[data-test-id="item-dialog-tags-section"]')?.textContent).toContain('#drama');
    expect(element.querySelector('[data-test-id="item-dialog-system-tags-section"]')?.textContent).toContain('#movie');
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
});
