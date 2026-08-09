import { TestBed } from '@angular/core/testing';
import { initialToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharesService } from './shares-service';
import { initialSharesState, sharesStateToken } from './shares-store';

describe('SharesService', () => {
  let api: {
    getShares: ReturnType<typeof vi.fn>;
    saveShare: ReturnType<typeof vi.fn>;
    deleteShare: ReturnType<typeof vi.fn>;
    revokeIncomingShare: ReturnType<typeof vi.fn>;
  };
  let service: SharesService;

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

    TestBed.configureTestingModule({
      providers: [
        SharesService,
        { provide: ApiService, useValue: api },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        provideStore(initialSharesState, sharesStateToken),
        provideStore(initialToastState, toastStateToken),
      ],
    });

    service = TestBed.inject(SharesService);
  });

  it('loads the short share code into state', () => {
    const sharesState = TestBed.inject(sharesStateToken);

    service.loadShares();

    expect(sharesState.state.loaded()).toBe(true);
    expect(sharesState.state.userShareCode()).toBe('short-code');
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
      },
    ];
    service.saveShare('friend-code', grants);

    expect(api.saveShare).toHaveBeenCalledWith({
      sharedWithUserShareCode: 'friend-code',
      grants,
    });
  });

  it('revokes incoming shares as the invited user', () => {
    service.revokeIncomingShare('owner-code');

    expect(api.revokeIncomingShare).toHaveBeenCalledWith('owner-code');
  });
});
