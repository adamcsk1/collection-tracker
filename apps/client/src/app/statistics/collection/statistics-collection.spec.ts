import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import type { CollectionStatisticsApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialStatisticsState, statisticsStateToken } from '../statistics-store';
import { StatisticsCollection } from './statistics-collection';

const response: CollectionStatisticsApiResponseModel = {
  scope: 'all',
  summary: { total: 2, movies: 1, series: 0, books: 1, music: 0, favorites: 1 },
  charts: {
    mediaTypeCounts: [
      { type: 'movie', count: 1 },
      { type: 'book', count: 1 },
    ],
    statusCounts: [],
    genreCounts: [{ genre: 'Drama', count: 1 }],
    tagCounts: [{ tag: '#tag', count: 1 }],
    releaseYearCounts: [{ year: '2020', count: 1 }],
    userRatingCounts: [{ rating: 8, count: 1 }],
  },
};
describe('StatisticsCollection', () => {
  const create = (getStatistics = vi.fn(() => of(response))) => {
    const searchItems = vi.fn(() => of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } }));
    TestBed.configureTestingModule({
      imports: [StatisticsCollection],
      providers: [
        provideStore(initialStatisticsState, statisticsStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        { provide: ApiService, useValue: { getStatistics, searchItems } },
        { provide: PortalService, useValue: { componentRef: signal(null) } },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    return { fixture: TestBed.createComponent(StatisticsCollection), searchItems };
  };
  it('loads composition only and lazily requests titles after choosing a count or bar', async () => {
    const { fixture, searchItems } = create();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).classList.contains('statistics-section')).toBe(true);
    expect(searchItems).not.toHaveBeenCalled();
    expect(fixture.componentInstance['overview']()).toContainEqual({ label: 'Movies', count: 1, value: 'movie' });
    expect(fixture.componentInstance['genres']()[0].label).toBe('Drama');
    expect(fixture.componentInstance['tags']()[0].label).toBe('#tag');
    fixture.componentInstance['choose']({ favorite: true }, 'Favorites');
    await fixture.whenStable();
    expect(searchItems).toHaveBeenLastCalledWith(expect.objectContaining({ favorite: true }), null, 50);
  });
  it('clears previous drilldown filters when media scope changes', async () => {
    const api = vi.fn(() => of(response));
    const { fixture } = create(api);
    await fixture.whenStable();
    fixture.componentInstance['chooseOverview']('book');
    await fixture.whenStable();
    expect(fixture.componentInstance['filters']().type).toBe('book');
    TestBed.inject(statisticsStateToken).setState('selectedScope', 'movie');
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.filters()).toBeNull();
    expect(api).toHaveBeenLastCalledWith({ type: 'movie' });
  });
  it('offers retry on errors and shows empty results without confusing them', async () => {
    const api = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValue(of({ ...response, summary: { ...response.summary, total: 0 } }));
    const { fixture } = create(api);
    await fixture.whenStable();
    expect(fixture.componentInstance['store'].state.status()).toBe('error');
    fixture.componentInstance['refresh']();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-test-id="statistics-empty"]')).not.toBeNull();
  });
});
