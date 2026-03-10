import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { CollectionService } from '@client/collection/collection-service';
import { mainCollectionStateToken, initialMainCollectionState } from '@client/main/main-collection-store';
import {
  blockerLoadingStateToken,
  initialBlockerLoadingState,
} from '@components/blocker-loading/blocker-loading-store';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { WATCHED_TAG } from '@shared/constants/tags-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeWatchedStatusService } from './change-watched-status-service';

const buildItem = (overrides: Partial<CollectionItemModel>): CollectionItemModel => ({
  rawContent: overrides.rawContent || '',
  rawContentLower: (overrides.rawContent || '').toLowerCase(),
  image: '',
  title: overrides.title || '',
  titleLower: (overrides.title || '').toLowerCase(),
  genre: overrides.genre || [],
  IMDbId: overrides.IMDbId || 'tt000',
  tags: overrides.tags || [],
  name: overrides.name || 'item',
  year: null,
  rate: '',
});

describe('ChangeWatchedStatusService', () => {
  let service: ChangeWatchedStatusService;
  let mainCollectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;
  let collectionService: { loadCollection: ReturnType<typeof vi.fn> };
  let api: { update: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    collectionService = { loadCollection: vi.fn() };
    api = { update: vi.fn(() => of(undefined)) };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };

    TestBed.configureTestingModule({
      providers: [
        ChangeWatchedStatusService,
        { provide: CollectionService, useValue: collectionService },
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialBlockerLoadingState, blockerLoadingStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(ChangeWatchedStatusService);
    mainCollectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
  });

  it('marks only untagged items as watched and reports errors when tagging fails', () => {
    mainCollectionState.setState('collection', [
      buildItem({ name: 'first', rawContent: '**Tags** #action #adventure', tags: ['#action', '#adventure'] }),
      buildItem({ name: 'second', rawContent: 'no tags here', tags: [] }),
    ]);

    service.markAllAsWatched();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith('first', expect.stringContaining(WATCHED_TAG));
    expect(collectionService.loadCollection).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<typeof initialToastState>;
    expect(toast.state.message()).toBe('Toast.MarkingAllAsWatchedWithErrors');
  });

  it('unmarks only watched items and completes without errors', () => {
    mainCollectionState.setState('collection', [
      buildItem({ name: 'first', rawContent: '**Tags** #action #watched', tags: ['#action', '#watched'] }),
      buildItem({ name: 'second', rawContent: '**Tags** #adventure', tags: ['#adventure'] }),
    ]);
    const blocker = TestBed.inject(blockerLoadingStateToken) as NgxSimpleSignalStoreService<
      typeof initialBlockerLoadingState
    >;

    service.markAllAsUnwatched();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update).toHaveBeenCalledWith('first', '**Tags** #action ');
    expect(collectionService.loadCollection).toHaveBeenCalledTimes(1);
    const toast = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<typeof initialToastState>;
    expect(toast.state.message()).toBe('Toast.MarkedAllAsUnwatched');
    expect(blocker.state.show()).toBe(false);
  });

  it('does nothing when user declines watching all as watched', () => {
    confirm.ifConfirmed = vi.fn(() => of(false));
    mainCollectionState.setState('collection', []);
    service.markAllAsWatched();

    expect(api.update).not.toHaveBeenCalled();
    expect(collectionService.loadCollection).toHaveBeenCalledTimes(1);
  });
});
