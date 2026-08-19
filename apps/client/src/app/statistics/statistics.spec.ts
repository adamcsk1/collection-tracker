import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { AllCollectionStatisticsChartsApiModel, CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import Chart from 'chart.js/auto';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialMainState, mainStateToken } from '../main/main-store';
import { StatisticsChartService } from './statistics-chart-service';
import { initialStatisticsState, statisticsStateToken } from './statistics-store';
import { Statistics } from './statistics';

describe('Statistics component', () => {
  let fixture: ComponentFixture<Statistics>;
  let component: Statistics;
  let api: { getStatistics: ReturnType<typeof vi.fn> };
  let webstorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
  let portal: { closeAll: ReturnType<typeof vi.fn> };
  let routerNavigate: ReturnType<typeof vi.fn>;

  const charts: AllCollectionStatisticsChartsApiModel = {
    tagCounts: [
      { tag: '#shared', count: 2 },
      { tag: '#movie', count: 1 },
      { tag: '#book', count: 1 },
    ],
    genreCounts: [{ genre: 'Drama', count: 2 }],
    releaseYearCounts: [{ year: '2026', count: 2 }],
    userRatingCounts: [{ rating: 8, count: 2 }],
    mediaTypeCounts: [
      { type: 'movie' as const, count: 2 },
      { type: 'series' as const, count: 1 },
      { type: 'book' as const, count: 1 },
    ],
    statusCounts: [],
  };
  const responses: Record<'all' | 'movie' | 'series' | 'book', CollectionStatisticsApiResponseModel> = {
    all: {
      scope: 'all',
      summary: { total: 4, movies: 2, series: 1, books: 1, favorites: 2 },
      charts,
    },
    movie: {
      scope: 'movie',
      summary: { total: 2, favorites: 1, watched: 1, unwatched: 1 },
      charts: {
        ...charts,
        tagCounts: [
          { tag: '#shared', count: 1 },
          { tag: '#movie', count: 1 },
        ],
        mediaTypeCounts: [],
        statusCounts: [
          { status: 'watched', count: 1 },
          { status: 'unwatched', count: 1 },
        ],
      },
    },
    series: {
      scope: 'series',
      summary: { total: 1, favorites: 0, tracked: 1, untracked: 0, completed: 0, inProgress: 1 },
      charts: {
        ...charts,
        tagCounts: [{ tag: '#series', count: 1 }],
        mediaTypeCounts: [],
        statusCounts: [
          { status: 'completed', count: 0 },
          { status: 'inProgress', count: 1 },
        ],
      },
    },
    book: {
      scope: 'book',
      summary: { total: 1, favorites: 1, read: 0, unread: 0, inProgress: 1 },
      charts: {
        ...charts,
        tagCounts: [{ tag: '#book', count: 1 }],
        mediaTypeCounts: [],
        statusCounts: [{ status: 'inProgress', count: 1 }],
      },
    },
  };
  const chartService = {
    createTagChart: vi.fn((chart) => chart ?? buildChart<'pie'>().chart),
    createOverviewChart: vi.fn((chart) => chart ?? buildChart<'doughnut'>().chart),
    createGenreChart: vi.fn((chart) => chart ?? buildChart<'bar'>().chart),
    createReleaseYearChart: vi.fn((chart) => chart ?? buildChart<'bar'>().chart),
    createRatingChart: vi.fn((chart) => chart ?? buildChart<'bar'>().chart),
    updateTagChart: vi.fn(),
    updateOverviewChart: vi.fn(),
    updateGenreChart: vi.fn(),
    updateReleaseYearChart: vi.fn(),
    updateRatingChart: vi.fn(),
  };

  beforeEach(() => {
    api = {
      getStatistics: vi.fn((filters: { type?: 'movie' | 'series' | 'book' }) => of(responses[filters.type ?? 'all'])),
    };
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn() };
    portal = { closeAll: vi.fn() };
    routerNavigate = vi.fn(() => Promise.resolve(true));
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialApiState, apiStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: ApiService, useValue: api },
        {
          provide: NgxSignalTranslateService,
          useValue: {
            translate: (key: string, values?: Record<string, string | number>) => {
              if (key === 'Aria.ChartDataPoint') return `${values?.label}: ${values?.count}`;
              if (key === 'Aria.ChartSummary') return `${values?.title} chart. ${values?.data}`;
              return key;
            },
          },
        },
        { provide: WebstorageService, useValue: webstorage },
        { provide: PortalService, useValue: portal },
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });
    TestBed.overrideComponent(Statistics, {
      set: {
        providers: [
          { provide: StatisticsChartService, useValue: chartService },
          provideStore(initialStatisticsState, statisticsStateToken),
        ],
      },
    });

    fixture = TestBed.createComponent(Statistics);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const hasCard = (testId: string): boolean =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`) !== null;

  it('loads the all scope and renders only the limited all-summary cards', () => {
    expect(api.getStatistics).toHaveBeenCalledWith({});
    expect(component['tags']()).toEqual(['#shared', '#movie', '#book']);
    expect(hasCard('statistics-summary-all')).toBe(true);
    expect(hasCard('statistics-summary-movies')).toBe(true);
    expect(hasCard('statistics-summary-series')).toBe(true);
    expect(hasCard('statistics-summary-books')).toBe(true);
    expect(hasCard('statistics-summary-favorites')).toBe(true);
    expect(hasCard('statistics-summary-watched-movies')).toBe(false);
    expect(hasCard('statistics-summary-tracked-series')).toBe(false);
    expect(hasCard('statistics-summary-read-books')).toBe(false);
    expect(hasCard('statistics-summary-wishlist')).toBe(false);
    expect(hasCard('statistics-summary-up-next')).toBe(false);
  });

  it('provides text alternatives for every chart', () => {
    const canvases = fixture.nativeElement.querySelectorAll('canvas') as NodeListOf<HTMLCanvasElement>;
    expect(canvases).toHaveLength(5);
    for (const canvas of canvases) {
      expect(canvas.getAttribute('role')).toBe('img');
      expect(canvas.getAttribute('aria-label')).not.toContain('[object Object]');
      expect(canvas.textContent).not.toContain('[object Object]');
    }
    expect(fixture.nativeElement.querySelector('#statistics-overview-chart')?.getAttribute('aria-label')).toBe(
      'MediaTypes chart. Movies: 2, Series: 1, Books: 1'
    );
    expect(fixture.nativeElement.querySelector('#statistics-genre-chart')?.getAttribute('aria-label')).toBe(
      'Genre chart. Drama: 2'
    );
    expect(component['overviewChart']()?.resize).toHaveBeenCalled();
  });

  it.each([
    [
      'movie',
      [
        'statistics-summary-movies',
        'statistics-summary-favorites',
        'statistics-summary-watched-movies',
        'statistics-summary-unwatched-movies',
      ],
    ],
    [
      'series',
      [
        'statistics-summary-series',
        'statistics-summary-favorites',
        'statistics-summary-tracked-series',
        'statistics-summary-untracked-series',
        'statistics-summary-completed-series',
        'statistics-summary-in-progress-series',
      ],
    ],
    [
      'book',
      [
        'statistics-summary-books',
        'statistics-summary-favorites',
        'statistics-summary-read-books',
        'statistics-summary-unread-books',
        'statistics-summary-in-progress-books',
      ],
    ],
  ] as const)('requests and renders only %s-focused summary cards', (scope, expectedCards) => {
    component['onSelectScope'](scope);
    fixture.detectChanges();

    expect(api.getStatistics).toHaveBeenLastCalledWith({ type: scope });
    for (const testId of expectedCards) expect(hasCard(testId)).toBe(true);
    expect(hasCard('statistics-summary-all')).toBe(false);
    const cards = fixture.nativeElement.querySelectorAll('[data-test-id^="statistics-summary-"]');
    expect(cards.length).toBe(expectedCards.length);
  });

  it('filters tags by media scope while preserving selections hidden in that scope', () => {
    component['onToggleTag']('#book');
    component['onSelectScope']('movie');
    fixture.detectChanges();

    expect(component['tags']()).toEqual(['#shared', '#movie']);
    expect(component['selectedTags']()).toEqual(['#book']);
    expect(component['applicableSelectedTags']()).toEqual([]);
    expect(component['selectedVisibleTags']()).toEqual([]);

    component['onSelectScope']('all');
    fixture.detectChanges();
    expect(component['applicableSelectedTags']()).toEqual(['#book']);
    expect(component['selectedVisibleTags']()).toEqual(['#book']);
  });

  it('uses cached statistics when returning to an already loaded scope', () => {
    component['onSelectScope']('movie');
    fixture.detectChanges();
    component['onSelectScope']('all');
    fixture.detectChanges();
    component['onSelectScope']('movie');
    fixture.detectChanges();

    expect(api.getStatistics).toHaveBeenCalledTimes(2);
    expect(api.getStatistics).toHaveBeenNthCalledWith(1, {});
    expect(api.getStatistics).toHaveBeenNthCalledWith(2, { type: 'movie' });
  });

  it('cancels stale scope loads and ignores their responses', () => {
    const movieResponse = new Subject<CollectionStatisticsApiResponseModel>();
    const seriesResponse = new Subject<CollectionStatisticsApiResponseModel>();
    api.getStatistics.mockReturnValueOnce(movieResponse).mockReturnValueOnce(seriesResponse);

    component['onSelectScope']('movie');
    fixture.detectChanges();
    component['onSelectScope']('series');
    fixture.detectChanges();

    movieResponse.next(responses.movie);
    expect(component['statistics']()).toBeNull();

    seriesResponse.next(responses.series);
    expect(component['statistics']()).toEqual(responses.series);
  });

  it('clears stale statistics while a new scope loads and shows request errors', () => {
    const movieResponse = new Subject<CollectionStatisticsApiResponseModel>();
    api.getStatistics.mockReturnValueOnce(movieResponse);

    component['onSelectScope']('movie');
    fixture.detectChanges();
    expect(component['statistics']()).toBeNull();
    expect(hasCard('statistics-summary-all')).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-test-id="statistics-scroll"]')?.getAttribute('aria-busy')).toBe(
      'true'
    );
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();

    api.getStatistics.mockReturnValueOnce(throwError(() => new Error('failed')));
    component['onSelectScope']('series');
    fixture.detectChanges();
    expect(component['statistics']()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-test-id="statistics-error"]')?.textContent).toContain(
      'Toast.LoadStatisticsError'
    );
    expect(fixture.nativeElement.querySelector('[data-test-id="statistics-error"]')?.getAttribute('role')).toBe(
      'alert'
    );
    const retryButton = fixture.nativeElement.querySelector('[data-test-id="statistics-retry"]') as HTMLButtonElement;
    expect(retryButton.textContent).toContain('Retry');

    retryButton.click();
    fixture.detectChanges();
    expect(api.getStatistics).toHaveBeenLastCalledWith({ type: 'series' });
    expect(hasCard('statistics-summary-series')).toBe(true);
  });

  it('filters, toggles, clears, and persists applicable tags', () => {
    component['onToggleTag']('#shared');
    component['onFilterTags']('mov');
    expect(component['availableVisibleTags']()).toEqual(['#movie']);

    component['onClearSelectedTags']();
    expect(component['selectedTags']()).toEqual([]);
    expect(webstorage.setItem).toHaveBeenLastCalledWith(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify([]));
  });

  it('sets deterministic contrast-safe colors on selected tag chips', () => {
    component['onToggleTag']('#shared');
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('[data-test-id="statistics-tag-#shared"]') as HTMLElement;
    expect(chip.style.getPropertyValue('--tag-background-color')).toMatch(/^hsl\(/);
    expect(chip.style.getPropertyValue('--tag-foreground-color')).toMatch(/^#(?:000000|FFFFFF)$/);
  });

  it.each(['', 'not-json', '{"tag":"#shared"}', '["#shared", 1]'])(
    'discards malformed or stale stored tag selections: %s',
    (storedTags) => {
      fixture.destroy();
      webstorage.getItem.mockReturnValue(storedTags);

      fixture = TestBed.createComponent(Statistics);
      component = fixture.componentInstance;

      expect(component['selectedTags']()).toEqual([]);
      expect(webstorage.removeItem).toHaveBeenCalledWith(STORAGE_STATISTICS_SELECTED_TAGS);
    }
  );

  it('restores stored tag selections when they are a string array', () => {
    fixture.destroy();
    webstorage.getItem.mockReturnValue('["#shared", "#book"]');

    fixture = TestBed.createComponent(Statistics);
    component = fixture.componentInstance;

    expect(component['selectedTags']()).toEqual(['#shared', '#book']);
    expect(webstorage.removeItem).not.toHaveBeenCalled();
  });

  it('navigates focused cards to their relevant lists and filters', () => {
    component['navigateToCollection']('book', { favorite: true });
    component['navigateToCollection']('movie', { watched: false });
    component['navigateToTracking']('series', { completed: false });

    expect(routerNavigate).toHaveBeenNthCalledWith(1, ['/collection', 'books'], { queryParams: { favorite: true } });
    expect(routerNavigate).toHaveBeenNthCalledWith(2, ['/collection', 'library'], {
      queryParams: { type: 'movie', watched: false },
    });
    expect(routerNavigate).toHaveBeenNthCalledWith(3, ['/collection', 'tracking'], {
      queryParams: { type: 'series', completed: false },
    });
  });

  it('closes the statistics portal after successful navigation', async () => {
    component['navigateToCollection']();
    await Promise.resolve();

    expect(portal.closeAll).toHaveBeenCalled();
  });

  it('destroys every chart with the component', () => {
    const tagChart = buildChart<'pie'>();
    const overviewChart = buildChart<'doughnut'>();
    const genreChart = buildChart<'bar'>();
    const releaseYearChart = buildChart<'bar'>();
    const ratingChart = buildChart<'bar'>();
    component['tagChart'].set(tagChart.chart);
    component['overviewChart'].set(overviewChart.chart);
    component['genreChart'].set(genreChart.chart);
    component['releaseYearChart'].set(releaseYearChart.chart);
    component['ratingChart'].set(ratingChart.chart);

    fixture.destroy();

    for (const destroy of [
      tagChart.destroy,
      overviewChart.destroy,
      genreChart.destroy,
      releaseYearChart.destroy,
      ratingChart.destroy,
    ])
      expect(destroy).toHaveBeenCalledOnce();
  });

  const buildChart = <TType extends 'pie' | 'doughnut' | 'bar'>() => {
    const destroy = vi.fn();
    const resize = vi.fn();
    return { chart: { destroy, resize } as unknown as Chart<TType, number[], string>, destroy, resize };
  };
});
