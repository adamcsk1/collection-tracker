import { DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { UserSharesApiResponseModel } from '@shared/models/api-model';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharesService } from './shares-service';
import { SharesLoaderService } from './shares-loader-service';
import { initialSharesState, sharesStateToken, type SharesState } from './shares-store';
import { initialMainState, mainStateToken } from '../main/main-store';
import { SettingsService } from '../settings/settings-service';

describe('SharesService', () => {
  let api: {
    getShares: ReturnType<typeof vi.fn>;
    saveShare: ReturnType<typeof vi.fn>;
    deleteShare: ReturnType<typeof vi.fn>;
    revokeIncomingShare: ReturnType<typeof vi.fn>;
  };
  let service: SharesService;
  let sharesState: NgxSimpleSignalStoreService<SharesState>;
  let translate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = {
      getShares: vi.fn(() =>
        of({
          userShareCode: 'short-code',
          outgoing: [],
          incoming: [],
        })
      ),
      saveShare: vi.fn(() => of(undefined)),
      deleteShare: vi.fn(() => of(undefined)),
      revokeIncomingShare: vi.fn(() => of(undefined)),
    };
    translate = vi.fn((key: string) => key);

    TestBed.configureTestingModule({
      providers: [
        SharesService,
        SharesLoaderService,
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate } },
        {
          provide: SettingsService,
          useValue: {
            removeDefaultCollectionOwner: (ownerUserShareCode: string) => {
              const mainState = TestBed.inject(mainStateToken);
              mainState.setState(
                'defaultCollectionOwners',
                mainState.state
                  .defaultCollectionOwners()
                  .filter((ownerDefault) => ownerDefault.ownerUserShareCode !== ownerUserShareCode)
              );
            },
          },
        },
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(SharesService);
    sharesState = TestBed.inject(sharesStateToken);
  });

  it('loads the short share code into state', () => {
    const sharesState = TestBed.inject(sharesStateToken);

    service.loadShares();

    expect(sharesState.state.loaded()).toBe(true);
    expect(sharesState.state.userShareCode()).toBe('short-code');
  });

  it('does not load shares while a mutation is pending', () => {
    sharesState.setState('mutating', true);

    service.loadShares();

    expect(api.getShares).not.toHaveBeenCalled();
  });

  it('marks shares as loaded when the current load fails', () => {
    api.getShares.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.loadShares();

    expect(sharesState.state.loaded()).toBe(true);
  });

  it('saves shares by short share code', () => {
    const grants = [
      {
        listType: 'library' as const,
        contentType: 'movie' as const,
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'all' as const,
      },
    ];
    service.saveShare('friend-code', grants);

    expect(api.saveShare).toHaveBeenCalledWith({
      sharedWithUserShareCode: 'friend-code',
      grants,
    });
  });

  it('keeps share actions pending until saved shares reload', () => {
    const saveResponse = new Subject<void>();
    const reloadResponse = new Subject<UserSharesApiResponseModel>();
    const grants = [
      {
        listType: 'wishlist' as const,
        contentType: 'movie' as const,
        canRead: true,
        canCreate: false,
        canUpdate: true,
        canDelete: false,
        readMode: 'all' as const,
      },
    ];
    sharesState.setState('outgoing', [
      {
        sharedWithUserShareCode: 'other-code',
        sharedWithUsername: 'Other',
        grants: [],
      },
      {
        sharedWithUserShareCode: 'friend-code',
        sharedWithUsername: 'Friend',
        grants: [{ ...grants[0], canUpdate: false }],
      },
    ]);
    api.saveShare.mockReturnValueOnce(saveResponse);
    api.getShares.mockReturnValueOnce(reloadResponse);

    service.saveShare('friend-code', grants);
    expect(sharesState.state.mutating()).toBe(true);
    expect(translate).not.toHaveBeenCalled();

    saveResponse.next();
    saveResponse.complete();

    expect(translate).toHaveBeenCalledWith('Toast.ShareSaved');
    expect(
      sharesState.state.outgoing().find((share) => share.sharedWithUserShareCode === 'friend-code')?.grants
    ).toEqual(grants);
    expect(api.getShares).toHaveBeenCalledOnce();
    expect(sharesState.state.mutating()).toBe(true);

    reloadResponse.next({
      userShareCode: 'short-code',
      outgoing: [{ sharedWithUserShareCode: 'friend-code', sharedWithUsername: 'Friend', grants }],
      incoming: [],
    });
    reloadResponse.complete();

    expect(
      sharesState.state.outgoing().find((share) => share.sharedWithUserShareCode === 'friend-code')?.grants
    ).toEqual(grants);
    expect(sharesState.state.mutating()).toBe(false);
  });

  it('clears pending share actions when saving fails', () => {
    api.saveShare.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.saveShare('friend-code', []);

    expect(sharesState.state.mutating()).toBe(false);
    expect(api.getShares).not.toHaveBeenCalled();
    expect(translate).not.toHaveBeenCalled();
  });

  it('clears pending share actions when reloading saved shares fails', () => {
    api.getShares.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.saveShare('friend-code', []);

    expect(sharesState.state.mutating()).toBe(false);
  });

  it('clears pending share actions when the service is destroyed', () => {
    api.saveShare.mockReturnValueOnce(new Subject<void>());

    service.saveShare('friend-code', []);
    expect(sharesState.state.mutating()).toBe(true);

    TestBed.resetTestingModule();

    expect(sharesState.state.mutating()).toBe(false);
  });

  it('leaves shares unloaded when destruction cancels the canonical reload', () => {
    api.getShares.mockReturnValueOnce(new Subject<UserSharesApiResponseModel>());
    sharesState.setState('loaded', true);

    service.saveShare('friend-code', []);
    expect(sharesState.state.loaded()).toBe(false);

    TestBed.resetTestingModule();

    expect(sharesState.state.loaded()).toBe(false);
    expect(sharesState.state.mutating()).toBe(false);
  });

  it('ignores a stale load that completes after a saved share reload', () => {
    const staleLoad = new Subject<UserSharesApiResponseModel>();
    const savedReload = new Subject<UserSharesApiResponseModel>();
    api.getShares.mockReturnValueOnce(staleLoad).mockReturnValueOnce(savedReload);

    service.loadShares();
    service.saveShare('friend-code', []);
    savedReload.next({
      userShareCode: 'short-code',
      outgoing: [{ sharedWithUserShareCode: 'friend-code', sharedWithUsername: 'Friend', grants: [] }],
      incoming: [],
    });
    savedReload.complete();

    staleLoad.next({ userShareCode: 'short-code', outgoing: [], incoming: [] });
    staleLoad.complete();

    expect(sharesState.state.outgoing()).toEqual([expect.objectContaining({ sharedWithUserShareCode: 'friend-code' })]);
  });

  it('ignores a stale loader response that completes after a saved share reload', () => {
    const staleLoad = new Subject<UserSharesApiResponseModel>();
    const savedReload = new Subject<UserSharesApiResponseModel>();
    const loader = TestBed.inject(SharesLoaderService);
    const destroyRef = TestBed.runInInjectionContext(() => inject(DestroyRef));
    api.getShares.mockReturnValueOnce(staleLoad).mockReturnValueOnce(savedReload);

    loader.load(destroyRef);
    service.saveShare('friend-code', []);
    savedReload.next({
      userShareCode: 'short-code',
      outgoing: [{ sharedWithUserShareCode: 'friend-code', sharedWithUsername: 'Friend', grants: [] }],
      incoming: [],
    });
    savedReload.complete();

    staleLoad.next({ userShareCode: 'short-code', outgoing: [], incoming: [] });
    staleLoad.complete();

    expect(sharesState.state.outgoing()).toEqual([expect.objectContaining({ sharedWithUserShareCode: 'friend-code' })]);
  });

  it('ignores a stale load failure after a mutation starts', () => {
    const staleLoad = new Subject<UserSharesApiResponseModel>();
    api.getShares.mockReturnValueOnce(staleLoad);

    service.loadShares();
    service.saveShare('friend-code', []);
    sharesState.setState('loaded', false);
    staleLoad.error(new Error('fail'));

    expect(sharesState.state.loaded()).toBe(false);
  });

  it('keeps a newly created share when its canonical reload fails', () => {
    api.getShares.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.saveShare('friend-code', []);

    expect(sharesState.state.outgoing()).toEqual([
      {
        sharedWithUserShareCode: 'friend-code',
        sharedWithUsername: null,
        grants: [],
      },
    ]);
    expect(sharesState.state.loaded()).toBe(false);
    expect(sharesState.state.mutating()).toBe(false);
  });

  it('keeps a removed share absent when its canonical reload fails', () => {
    sharesState.setState('outgoing', [
      { sharedWithUserShareCode: 'friend-code', sharedWithUsername: 'Friend', grants: [] },
    ]);
    api.getShares.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.removeShare('friend-code');

    expect(sharesState.state.outgoing()).toEqual([]);
    expect(sharesState.state.mutating()).toBe(false);
  });

  it('keeps a revoked incoming share absent when its canonical reload fails', () => {
    sharesState.setState('incoming', [{ ownerUserShareCode: 'owner-code', ownerUsername: 'Owner', grants: [] }]);
    api.getShares.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.revokeIncomingShare('owner-code');

    expect(sharesState.state.incoming()).toEqual([]);
    expect(sharesState.state.mutating()).toBe(false);
  });

  it('does not start another mutation while one is pending', () => {
    api.saveShare.mockReturnValueOnce(new Subject<void>());

    service.saveShare('friend-code', []);
    service.removeShare('friend-code');

    expect(api.deleteShare).not.toHaveBeenCalled();
  });

  it('revokes incoming shares as the invited user', () => {
    const mainState = TestBed.inject(mainStateToken);
    mainState.setState('defaultCollectionOwners', [
      { listType: 'library', contentType: 'movie', ownerUserShareCode: 'owner-code' },
      { listType: 'tracking', contentType: 'series', ownerUserShareCode: 'other-code' },
    ]);

    service.revokeIncomingShare('owner-code');

    expect(api.revokeIncomingShare).toHaveBeenCalledWith('owner-code');
    expect(mainState.state.defaultCollectionOwners()).toEqual([
      { listType: 'tracking', contentType: 'series', ownerUserShareCode: 'other-code' },
    ]);
  });
});
