import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { WatchLater } from './watch-later';

describe('WatchLater', () => {
  let fixture: ComponentFixture<WatchLater>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  const portal = { open: vi.fn() };
  const api = {
    searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
  };

  const createFixture = (searchText = '') => {
    TestBed.configureTestingModule({
      imports: [WatchLater],
      providers: [
        provideStore({ ...initialCollectionState, searchText }, collectionStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(WatchLater, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(WatchLater);
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
    collectionState.setState('searchText', 'matrix');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('matrix');
  });

  it('persists search text changes back to the store', () => {
    fixture.componentInstance['searchTextModel'].set('alien');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('alien');
  });

  it('searches watch later items by standard text', () => {
    fixture.componentInstance['watchLaterDataSource']({ reset: true, offset: 10, limit: 25, searchText: ' alien ' });

    expect(api.searchItems).toHaveBeenCalledWith({ search: 'alien', listType: 'watch-later' }, 10, 25);
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });

  it('opens the watch later dialog from the empty CTA', () => {
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddWatchLater'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { watchLater: true });
  });
});
