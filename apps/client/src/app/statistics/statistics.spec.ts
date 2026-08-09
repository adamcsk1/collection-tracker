import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from './statistics';
import { initialMainState, mainStateToken } from '../main/main-store';

describe('Statistics component', () => {
  let fixture: ComponentFixture<Statistics>;
  let component: Statistics;
  let api: { getStatistics: ReturnType<typeof vi.fn> };
  let webstorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
  let portal: { closeAll: ReturnType<typeof vi.fn> };
  let routerNavigate: ReturnType<typeof vi.fn>;

  const statistics = {
    totalItems: 2,
    movieCount: 1,
    seriesCount: 1,
    booksCount: 1,
    favoriteCount: 1,
    watchlistCount: 1,
    wishlistCount: 1,
    watchedMovieCount: 1,
    watchedSeriesCount: 0,
    unwatchedMovieCount: 0,
    unwatchedLibrarySeriesCount: 1,
    unwatchedTrackerSeriesCount: 0,
    completedTrackerSeriesCount: 0,
    watchedYearCounts: [{ year: '2026', movieCount: 1, seriesCount: 0, count: 1 }],
    tagCounts: [
      { tag: '#drama', count: 1 },
      { tag: '#action', count: 2 },
    ],
    genreCounts: [{ genre: 'Action', count: 2 }],
  };

  const mockChart = () => ({ data: { labels: [], datasets: [] }, update: vi.fn() }) as any;

  beforeEach(() => {
    api = { getStatistics: vi.fn(() => of(statistics)) };
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    portal = { closeAll: vi.fn() };
    routerNavigate = vi.fn(() => Promise.resolve(true));

    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialApiState, apiStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    fixture = TestBed.createComponent(Statistics);
    component = fixture.componentInstance;
    component['tagChart'].set(mockChart());
    component['watchedChart'].set(mockChart());
    component['typeChart'].set(mockChart());
    component['genreChart'].set(mockChart());
    component['watchedYearChart'].set(mockChart());
  });

  it('loads summary and tags from the statistics endpoint', () => {
    expect(api.getStatistics).toHaveBeenCalled();
    expect(component['translations'].statistics()).toBe('Statistics');
    expect(component['summary']()).toEqual({
      movies: 1,
      series: 1,
      books: 1,
      favorites: 1,
      watchlist: 1,
      wishlist: 1,
      all: 2,
      watchedMovies: 1,
      watchedSeries: 0,
      unwatchedMovies: 0,
      unwatchedLibrarySeries: 1,
      unwatchedTrackerSeries: 0,
      completedTrackerSeries: 0,
    });
    expect(component['tags']()).toEqual(['#drama', '#action']);
  });

  it('shows only summary cards for enabled collection features', () => {
    const mainState = TestBed.inject(mainStateToken);
    const hasCard = (testId: string) => fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`) !== null;

    mainState.setState('collectionFeaturePreferences', {
      books: true,
      watchlist: true,
      wishlist: false,
      tracking: true,
    });
    fixture.detectChanges();

    expect(hasCard('statistics-summary-watchlist')).toBe(true);
    expect(hasCard('statistics-summary-wishlist')).toBe(false);
    expect(hasCard('statistics-summary-watched-movies')).toBe(true);
    expect(hasCard('statistics-summary-watched-series')).toBe(true);
    expect(hasCard('statistics-summary-unwatched-tracker-series')).toBe(true);
    expect(hasCard('statistics-summary-completed-tracker-series')).toBe(true);
    expect(hasCard('statistics-summary-books')).toBe(true);

    mainState.setState('collectionFeaturePreferences', {
      books: false,
      watchlist: false,
      wishlist: true,
      tracking: false,
    });
    fixture.detectChanges();

    expect(hasCard('statistics-summary-watchlist')).toBe(false);
    expect(hasCard('statistics-summary-wishlist')).toBe(true);
    expect(hasCard('statistics-summary-watched-movies')).toBe(false);
    expect(hasCard('statistics-summary-watched-series')).toBe(false);
    expect(hasCard('statistics-summary-unwatched-tracker-series')).toBe(false);
    expect(hasCard('statistics-summary-completed-tracker-series')).toBe(false);
    expect(hasCard('statistics-summary-books')).toBe(false);
  });

  it('sets defaultOpenSelectedTags to true when no tags are stored', () => {
    expect(component['defaultOpenSelectedTags']).toBe(true);
  });

  it('sets defaultOpenSelectedTags to false when tags are stored', () => {
    webstorage.getItem = vi.fn((key: string) => (key === STORAGE_STATISTICS_SELECTED_TAGS ? '["#action"]' : null));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialApiState, apiStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });
    TestBed.overrideComponent(Statistics, { set: { template: '' } });

    const freshComponent = TestBed.createComponent(Statistics).componentInstance;

    expect(freshComponent['defaultOpenSelectedTags']).toBe(false);
  });

  it('adds a tag to selectedTags when toggling an unselected tag', () => {
    component['onToggleTag']('#action');

    expect(component['selectedTags']()).toContain('#action');
  });

  it('removes a tag from selectedTags when toggling an already selected tag', () => {
    component['onToggleTag']('#action');
    component['onToggleTag']('#action');

    expect(component['selectedTags']()).not.toContain('#action');
  });

  it('persists selected tags to webstorage when toggling', () => {
    component['onToggleTag']('#action');

    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify(['#action']));
  });

  it('filters visible tags by text', () => {
    component['onFilterTags']('act');

    expect(component['availableVisibleTags']()).toEqual(['#action']);
  });

  it('shows matching selected tags before available tags', () => {
    component['onToggleTag']('#action');
    component['onFilterTags']('a');

    expect(component['selectedVisibleTags']()).toEqual(['#action']);
    expect(component['availableVisibleTags']()).toEqual(['#drama']);
  });

  it('clears selected tags and persists the empty selection', () => {
    component['onToggleTag']('#action');

    component['onClearSelectedTags']();

    expect(component['selectedTags']()).toEqual([]);
    expect(webstorage.setItem).toHaveBeenLastCalledWith(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify([]));
  });

  it('navigates to collection without search when clicking total stat card', () => {
    component['onNavigateToCollection']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'library']);
  });

  it('navigates to collection with type query when clicking a type stat card', () => {
    component['onNavigateToCollectionType']('movie');

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'library'], { queryParams: { type: 'movie' } });
  });

  it('navigates to favorites when clicking the favorites stat card', () => {
    component['onNavigateToFavorites']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'library'], { queryParams: { favorite: 'true' } });
  });

  it('navigates to watch later when clicking the watch later stat card', () => {
    component['onNavigateToWatchlist']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'watchlist']);
  });

  it('navigates to wishlist when clicking the wishlist stat card', () => {
    component['onNavigateToWishlist']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'wishlist']);
  });

  it('navigates to tracking when clicking the watched movies stat card', () => {
    component['onNavigateToWatched']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'tracking'], { queryParams: { type: 'movie' } });
  });

  it('navigates to tracking when clicking the watched series stat card', () => {
    component['onNavigateToTracking']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'tracking']);
  });

  it('navigates to books list when clicking the tracked books stat card', () => {
    component['onNavigateToBooks']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'books']);
  });

  it('navigates to unwatched movies when clicking the unwatched movies stat card', () => {
    component['onNavigateToUnwatchedMovies']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'library'], {
      queryParams: { watched: false, type: 'movie' },
    });
  });

  it('navigates to unwatched library series when clicking the unwatched library series stat card', () => {
    component['onNavigateToUnwatchedLibrarySeries']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'library'], {
      queryParams: { watched: false, type: 'series' },
    });
  });

  it('navigates to unwatched tracker series when clicking the unwatched tracker series stat card', () => {
    component['onNavigateToUnwatchedTrackerSeries']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'tracking'], {
      queryParams: { completed: false },
    });
  });

  it('navigates to completed tracker series when clicking the completed tracker series stat card', () => {
    component['onNavigateToCompletedTrackerSeries']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'tracking'], {
      queryParams: { completed: true },
    });
  });

  it('closes the dialog after a successful stat navigation', async () => {
    component['onNavigateToCollection']();
    await Promise.resolve();

    expect(portal.closeAll).toHaveBeenCalled();
  });
});
