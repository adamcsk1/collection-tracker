import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { VIRTUAL_UNCOMPLETED_TAG, VIRTUAL_UNWATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { SeriesTracker } from './series-tracker';

describe('SeriesTracker', () => {
  let fixture: ComponentFixture<SeriesTracker>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  const portal = { open: vi.fn() };
  const api = {
    searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
  };

  const createFixture = (searchText = '') => {
    TestBed.configureTestingModule({
      imports: [SeriesTracker],
      providers: [
        provideStore({ ...initialCollectionState, searchText }, collectionStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(SeriesTracker, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(SeriesTracker);
    collectionState = fixture.debugElement.injector.get(collectionStateToken);
    floatActions = TestBed.inject(FloatActionsService);
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createFixture();
  });

  it('clears stale shared search text when created', () => {
    TestBed.resetTestingModule();

    createFixture('library search');

    expect(collectionState.state.searchText()).toBe('');
    expect(fixture.componentInstance['searchTextModel']()).toBe('');
  });

  it('syncs search text from store to the control', () => {
    collectionState.setState('searchText', 'fringe');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('fringe');
  });

  it('persists search text changes back to the store', () => {
    fixture.componentInstance['searchTextModel'].set('lost');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('lost');
  });

  it('searches series tracker items by standard text', () => {
    fixture.componentInstance['seriesTrackerDataSource']({ reset: true, offset: 10, limit: 25, searchText: ' dark ' });

    expect(api.searchItems).toHaveBeenCalledWith({ search: 'dark', listType: 'series-tracker' }, 10, 25);
  });

  it('searches series tracker items by tag', () => {
    fixture.componentInstance['seriesTrackerDataSource']({ reset: true, offset: 0, limit: 50, searchText: '#drama' });

    expect(api.searchItems).toHaveBeenCalledWith(
      { tags: ['#drama'], tagMode: 'all', listType: 'series-tracker' },
      0,
      50
    );
  });

  it('maps virtual unwatched search to series tracker filters', () => {
    fixture.componentInstance['seriesTrackerDataSource']({
      reset: true,
      offset: 0,
      limit: 50,
      searchText: VIRTUAL_UNWATCHED_TAG,
    });

    expect(api.searchItems).toHaveBeenCalledWith({ watched: false, listType: 'series-tracker' }, 0, 50);
  });

  it('maps virtual uncompleted search to series tracker filters', () => {
    fixture.componentInstance['seriesTrackerDataSource']({
      reset: true,
      offset: 0,
      limit: 50,
      searchText: VIRTUAL_UNCOMPLETED_TAG,
    });

    expect(api.searchItems).toHaveBeenCalledWith({ completed: false, listType: 'series-tracker' }, 0, 50);
  });

  it('searches series tracker items without a text filter by default', () => {
    fixture.componentInstance['seriesTrackerDataSource']({ reset: true, offset: 0, limit: 50, searchText: '' });

    expect(api.searchItems).toHaveBeenCalledWith({ listType: 'series-tracker' }, 0, 50);
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });

  it('opens the series tracker dialog from the empty CTA', () => {
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddSeriesTracker'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { seriesTracker: true });
  });
});
