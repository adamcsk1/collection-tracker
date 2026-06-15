import { TestBed } from '@angular/core/testing';
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

describe('Statistics component', () => {
  let component: Statistics;
  let api: { getStatistics: ReturnType<typeof vi.fn> };
  let webstorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };
  let portal: { closeAll: ReturnType<typeof vi.fn> };
  let routerNavigate: ReturnType<typeof vi.fn>;

  const statistics = {
    totalItems: 2,
    movieCount: 1,
    seriesCount: 1,
    favoriteCount: 1,
    watchLaterCount: 1,
    wishlistCount: 1,
    watchedCount: 1,
    unwatchedCount: 1,
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
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    TestBed.overrideComponent(Statistics, { set: { template: '' } });

    component = TestBed.createComponent(Statistics).componentInstance;
    component['tagChart'].set(mockChart());
    component['watchedChart'].set(mockChart());
    component['typeChart'].set(mockChart());
    component['genreChart'].set(mockChart());
  });

  it('loads summary and tags from the statistics endpoint', () => {
    expect(api.getStatistics).toHaveBeenCalled();
    expect(component['summary']()).toEqual({
      movies: 1,
      series: 1,
      favorites: 1,
      watchLater: 1,
      wishlist: 1,
      all: 2,
      watched: 1,
      unwatched: 1,
    });
    expect(component['tags']()).toEqual(['#drama', '#action']);
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

  it('navigates to collection with search query when clicking a stat card', () => {
    component['onNavigateToCollection']('#movie');

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'library'], { queryParams: { search: '#movie' } });
  });

  it('navigates to favorites when clicking the favorites stat card', () => {
    component['onNavigateToFavorites']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'favorites']);
  });

  it('navigates to watch later when clicking the watch later stat card', () => {
    component['onNavigateToWatchLater']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'watch-later']);
  });

  it('navigates to wishlist when clicking the wishlist stat card', () => {
    component['onNavigateToWishlist']();

    expect(routerNavigate).toHaveBeenCalledWith(['/collection', 'wishlist']);
  });

  it('closes the dialog after a successful stat navigation', async () => {
    component['onNavigateToCollection']();
    await Promise.resolve();

    expect(portal.closeAll).toHaveBeenCalled();
  });
});
