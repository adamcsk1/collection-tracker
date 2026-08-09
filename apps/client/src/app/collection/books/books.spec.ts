import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatActionsService } from '../../main/float-actions/float-actions-service';
import { initialMainCollectionState, mainCollectionStateToken } from '../../main/main-collection-store';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { collectionStateToken, initialCollectionState } from '../collection-store';
import { NewItemDialog } from '../item/new-item-dialog/new-item-dialog';
import { AiSearchService } from '../search/ai-search-service';
import { Books } from './books';

describe('Books', () => {
  let fixture: ComponentFixture<Books>;
  const portal = { open: vi.fn() };
  const api = { searchItems: vi.fn(() => of({ items: [], total: 0, offset: 0, limit: 50 })) };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Books],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useValue: {
            getMatchedIds: () => of(null),
            searchInProgress: signal(false),
            checkAiAvailable: vi.fn(() => of(true)),
          },
        },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParams: {} },
            queryParamMap: of({ get: () => null }),
          },
        },
      ],
    });
    TestBed.overrideComponent(Books, { set: { template: '<ng-template #floatSearch></ng-template>' } });
    fixture = TestBed.createComponent(Books);
    fixture.detectChanges();
  });

  it('searches only books list items', () => {
    fixture.componentInstance['booksDataSource']({
      reset: true,
      offset: 0,
      limit: 50,
      searchText: ' dune ',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'dune', listType: 'books', orderBy: 'createdAt', orderDirection: 'desc' },
      0,
      50
    );
  });

  it('opens books list item creation', () => {
    const event = new Event('click');
    const preventDefault = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddBooks'](event);

    expect(preventDefault).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { books: true });
  });

  it('clears float search on destroy', () => {
    const floatActions = TestBed.inject(FloatActionsService);
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });
});
