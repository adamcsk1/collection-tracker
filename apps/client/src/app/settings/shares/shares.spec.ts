import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmService } from '@services/confirm-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsShares } from './shares';
import { SharesService } from '../../shares/shares-service';
import { initialSharesState, sharesStateToken } from '../../shares/shares-store';

describe('SettingsShares', () => {
  let fixture: ComponentFixture<SettingsShares>;
  let component: SettingsShares;
  let sharesService: {
    loadShares: ReturnType<typeof vi.fn>;
    saveShare: ReturnType<typeof vi.fn>;
    removeShare: ReturnType<typeof vi.fn>;
    revokeIncomingShare: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sharesService = {
      loadShares: vi.fn(),
      saveShare: vi.fn(),
      removeShare: vi.fn(),
      revokeIncomingShare: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [SettingsShares],
      providers: [
        { provide: ConfirmService, useValue: { ifConfirmed: vi.fn(() => of(true)) } },
        { provide: NgxSignalTranslateService, useValue: { translate: vi.fn((key: string) => key) } },
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

  it('updates an outgoing share permission level', () => {
    component['onUpdateShare'](
      {
        sharedWithUserShareCode: 'share-code',
        canRead: true,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      },
      { canUpdate: true }
    );

    expect(sharesService.saveShare).toHaveBeenCalledWith('share-code', {
      canRead: true,
      canCreate: false,
      canUpdate: true,
      canDelete: false,
    });
  });

  it('revokes incoming shares after confirmation', () => {
    component['onRevokeIncomingShare']('owner-code');

    expect(sharesService.revokeIncomingShare).toHaveBeenCalledWith('owner-code');
  });
});
