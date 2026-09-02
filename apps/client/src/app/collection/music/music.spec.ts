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
import { Music } from './music';

describe('Music', () => {
  let fixture: ComponentFixture<Music>;
  const portal = { open: vi.fn() };
  const api = {
    searchItems: vi.fn(() => of({ items: [], page: { limit: 50, hasMore: false, nextCursor: null } })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [Music],
      providers: [
        provideStore(initialCollectionState, collectionStateToken),
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialMainState, mainStateToken),
        { provide: PortalService, useValue: portal },
        { provide: ApiService, useValue: api },
        {
          provide: AiSearchService,
          useValue: {
            getMatchedIds: () => of({ status: 'idle' }),
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
    TestBed.overrideComponent(Music, { set: { template: '<ng-template #floatSearch></ng-template>' } });
    fixture = TestBed.createComponent(Music);
    fixture.detectChanges();
  });

  it('searches only music list items', () => {
    fixture.componentInstance['musicDataSource']({
      reset: true,
      cursor: null,
      limit: 50,
      searchText: ' dark side ',
      orderBy: 'createdAt',
      orderDirection: 'desc',
    });

    expect(api.searchItems).toHaveBeenCalledWith(
      { search: 'dark side', listType: 'music', orderBy: 'createdAt', orderDirection: 'desc' },
      null,
      50
    );
  });

  it('exposes translated music labels and standard-search state', () => {
    expect(fixture.componentInstance['translations'].messageEmptyMusic()).toBe('Message.EmptyMusic');
    expect(fixture.componentInstance['translations'].messageAddFirstMusic()).toBe('Message.AddFirstMusic');
    expect(fixture.componentInstance['translations'].placeholderSearchInMusic()).toBe('Placeholder.SearchInMusic');
    expect(fixture.componentInstance['translations'].placeholderReply()).toBe('Placeholder.Reply');
    expect(fixture.componentInstance['queryFilterKey']()).toBe('');
    expect(fixture.componentInstance['forceStandardSearch']()).toBe(false);
  });

  it('opens music list item creation', () => {
    const event = new Event('click');
    const preventDefault = vi.spyOn(event, 'preventDefault');

    fixture.componentInstance['onAddMusic'](event);

    expect(preventDefault).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalledWith(NewItemDialog, { music: true });
  });

  it('clears float search on destroy', () => {
    const floatActions = TestBed.inject(FloatActionsService);
    expect(floatActions.searchTemplate()).toBeTruthy();

    fixture.destroy();

    expect(floatActions.searchTemplate()).toBeNull();
  });
});
