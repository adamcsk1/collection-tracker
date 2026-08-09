import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { UserShareGrantApiModel } from '@shared/models/api-model';
import * as copyToClipboardUtil from '@shared/utils/copy-to-clipboard-util';
import * as mobileUserAgentUtil from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { SettingsShares } from './shares';
import { initialMainState, mainStateToken } from '../../main/main-store';
import { SharesService } from '../../shares/shares-service';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';
import { SettingsService } from '../settings-service';
import { ShareDialog } from './share-dialog/share-dialog';

vi.mock('@shared/utils/copy-to-clipboard-util', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@shared/utils/mobile-user-agent.util', () => ({ mobileUserAgent: vi.fn() }));

describe('SettingsShares', () => {
  let fixture: ComponentFixture<SettingsShares>;
  let component: SettingsShares;
  let sharesService: {
    loadShares: ReturnType<typeof vi.fn>;
    saveShare: ReturnType<typeof vi.fn>;
    removeShare: ReturnType<typeof vi.fn>;
    revokeIncomingShare: ReturnType<typeof vi.fn>;
  };
  let settingsService: { storeDefaultLibraryOwnerShareCode: ReturnType<typeof vi.fn> };
  let portal: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    (mobileUserAgentUtil.mobileUserAgent as Mock).mockReturnValue(null);
    sharesService = {
      loadShares: vi.fn(),
      saveShare: vi.fn(),
      removeShare: vi.fn(),
      revokeIncomingShare: vi.fn(),
    };
    settingsService = { storeDefaultLibraryOwnerShareCode: vi.fn() };
    portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [SettingsShares],
      providers: [
        { provide: ConfirmService, useValue: { ifConfirmed: vi.fn(() => of(true)) } },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
        { provide: SettingsService, useValue: settingsService },
        { provide: PortalService, useValue: portal },
        provideStore(initialToastState, toastStateToken),
        provideStore(initialMainState, mainStateToken),
        provideStore(initialSharesState, sharesStateToken),
      ],
    });
    TestBed.overrideComponent(SettingsShares, {
      set: {
        template: '',
        providers: [{ provide: SharesService, useValue: sharesService }],
      },
    });

    fixture = TestBed.createComponent(SettingsShares);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads shares on init', () => {
    expect(sharesService.loadShares).toHaveBeenCalled();
  });

  it('opens the share dialog for a new share and saves it', () => {
    component['onAddShare']();

    expect(portal.open).toHaveBeenCalledWith(ShareDialog, expect.any(Object));
    const inputs = portal.open.mock.calls[0][1] as {
      saved: (shareCode: string, grants: UserShareGrantApiModel[]) => void;
    };
    const grants: UserShareGrantApiModel[] = [
      {
        listType: 'library',
        contentType: 'movie',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
    ];
    inputs.saved('share-code', grants);
    expect(sharesService.saveShare).toHaveBeenCalledWith('share-code', grants);
  });

  it('opens the share dialog for an outgoing share and saves its grants', () => {
    const share = {
      sharedWithUserShareCode: 'share-code',
      sharedWithUsername: 'Shared User',
      grants: [
        {
          listType: 'library' as const,
          contentType: 'movie' as const,
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false,
        },
      ],
    };

    component['onEditShare'](share);

    expect(portal.open).toHaveBeenCalledWith(ShareDialog, expect.objectContaining({ share }));
    const inputs = portal.open.mock.calls[0][1] as {
      saved: (shareCode: string, grants: typeof share.grants) => void;
    };
    inputs.saved('ignored-share-code', share.grants);
    expect(sharesService.saveShare).toHaveBeenCalledWith('share-code', share.grants);
  });

  it('opens the share dialog for an incoming share', () => {
    const share = {
      ownerUserShareCode: 'owner-code',
      ownerUsername: 'Owner',
      grants: [],
    };

    component['onViewIncomingShare'](share);

    expect(portal.open).toHaveBeenCalledWith(ShareDialog, { share });
  });

  it('revokes incoming shares after confirmation', () => {
    component['onRevokeIncomingShare']('owner-code');

    expect(sharesService.revokeIncomingShare).toHaveBeenCalledWith('owner-code');
  });

  it('copies the user share code and shows the clipboard toast', () => {
    const sharesState = TestBed.inject(sharesStateToken);
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;
    sharesState.setState('userShareCode', 'share-code');

    component['onCopyUserHash']();

    expect(copyToClipboardUtil.copyToClipboard).toHaveBeenCalledWith('share-code');
    expect(toastState.state.message()).toBe('Toast.CopiedToClipboard');
  });

  it('does not show the clipboard toast on mobile devices', () => {
    (mobileUserAgentUtil.mobileUserAgent as Mock).mockReturnValue(['Android'] as unknown as RegExpMatchArray);
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onCopyUserHash']();

    expect(toastState.state.message()).toBe('');
  });

  it('stores selected incoming share as default library', () => {
    component['onDefaultLibraryChange']('owner-code');

    expect(settingsService.storeDefaultLibraryOwnerShareCode).toHaveBeenCalledWith('owner-code');
  });

  it('stores null when my library is selected as default library', () => {
    component['onDefaultLibraryChange']('');

    expect(settingsService.storeDefaultLibraryOwnerShareCode).toHaveBeenCalledWith(null);
  });
});
