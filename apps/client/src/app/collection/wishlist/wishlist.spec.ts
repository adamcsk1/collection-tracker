import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { CollectionState, collectionStateToken, initialCollectionState } from '../collection-store';
import { NewItemDialog } from '../new-item-dialog/new-item-dialog';
import { Wishlist } from './wishlist';

describe('Wishlist', () => {
  let fixture: ComponentFixture<Wishlist>;
  let collectionState: NgxSimpleSignalStoreService<CollectionState>;
  let floatActions: FloatActionsService;
  const portal = { open: vi.fn() };
  const api = {
    searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })),
  };

  const createFixture = (searchText = '') => {
    TestBed.configureTestingModule({
      imports: [Wishlist],
      providers: [
        provideStore({ ...initialCollectionState, searchText }, collectionStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(Wishlist, {
      set: {
        template: '<ng-template #floatSearch></ng-template>',
      },
    });

    fixture = TestBed.createComponent(Wishlist);
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
    collectionState.setState('searchText', 'arrival');
    fixture.detectChanges();

    expect(fixture.componentInstance['searchTextModel']()).toBe('arrival');
  });

  it('persists search text changes back to the store', () => {
    fixture.componentInstance['searchTextModel'].set('dune');
    fixture.detectChanges();

    expect(collectionState.state.searchText()).toBe('dune');
  });

  it('searches wishlist items by standard text', () => {
    fixture.componentInstance['wishlistDataSource']({ reset: true, offset: 10, limit: 25, searchText: ' dune ' });

    expect(api.searchItems).toHaveBeenCalledWith({ search: 'dune', listType: 'wishlist' }, 10, 25);
  });

  it('registers and clears the float search template', () => {
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });

  it('opens the wishlist dialog from the empty CTA', () => {
    const event = new Event('click');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddWishlist'](event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { wishlist: true });
  });
});
