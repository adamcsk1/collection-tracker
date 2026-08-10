import { DestroyRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialSharesState, SharesState, sharesStateToken } from './shares-store';
import { SharesLoaderService } from './shares-loader-service';

describe('SharesLoaderService', () => {
  let service: SharesLoaderService;
  let sharesState: NgxSimpleSignalStoreService<SharesState>;
  let api: { getShares: ReturnType<typeof vi.fn> };
  let destroyRef: DestroyRef;

  beforeEach(() => {
    api = {
      getShares: vi.fn(() =>
        of({
          userShareCode: 'own-code',
          outgoing: [],
          incoming: [
            {
              ownerUserShareCode: 'owner-code',
              ownerUsername: 'Owner',
              grants: [
                {
                  listType: 'library',
                  contentType: 'movie',
                  canRead: true,
                  canCreate: true,
                  canUpdate: false,
                  canDelete: false,
                },
                {
                  listType: 'library',
                  contentType: 'series',
                  canRead: true,
                  canCreate: true,
                  canUpdate: false,
                  canDelete: false,
                },
              ],
            },
          ],
        })
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        SharesLoaderService,
        { provide: ApiService, useValue: api },
        provideStore(initialSharesState, sharesStateToken),
      ],
    });

    service = TestBed.inject(SharesLoaderService);
    sharesState = TestBed.inject(sharesStateToken);
    destroyRef = TestBed.runInInjectionContext(() => inject(DestroyRef));
  });

  it('loads shares into state', () => {
    service.load(destroyRef);

    expect(sharesState.state.loaded()).toBe(true);
    expect(sharesState.state.userShareCode()).toBe('own-code');
    expect(sharesState.state.incoming()).toEqual([
      expect.objectContaining({
        ownerUserShareCode: 'owner-code',
        grants: expect.arrayContaining([expect.objectContaining({ canCreate: true })]),
      }),
    ]);
  });

  it('does not reload shares that are already loaded', () => {
    sharesState.setState('loaded', true);

    service.load(destroyRef);

    expect(api.getShares).not.toHaveBeenCalled();
  });

  it('does not load shares while a mutation is pending', () => {
    sharesState.setState('mutating', true);

    service.load(destroyRef);

    expect(api.getShares).not.toHaveBeenCalled();
  });

  it('marks shares as loaded when loading fails', () => {
    api.getShares.mockReturnValueOnce(throwError(() => new Error('fail')));

    service.load(destroyRef);

    expect(sharesState.state.loaded()).toBe(true);
    expect(sharesState.state.incoming()).toEqual([]);
  });

  it('ignores a response superseded by another share request', () => {
    const staleLoad = new Subject<{
      userShareCode: string;
      outgoing: [];
      incoming: [];
    }>();
    api.getShares.mockReturnValueOnce(staleLoad);

    service.load(destroyRef);
    sharesState.setState('requestId', sharesState.state.requestId() + 1);
    staleLoad.next({ userShareCode: 'stale-code', outgoing: [], incoming: [] });
    staleLoad.complete();

    expect(sharesState.state.loaded()).toBe(false);
    expect(sharesState.state.userShareCode()).toBe('');
  });
});
