import { TestBed } from '@angular/core/testing';
import { initialToastState, ToastState, toastStateToken } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessTokens } from './access-tokens';

const mockTokens = [
  { tokenHash: 'hash-1', createdAt: '2024-01-01', userAgent: 'Chrome', expiresAt: null },
  { tokenHash: 'hash-2', createdAt: '2024-02-01', userAgent: 'Firefox', expiresAt: null },
];

describe('AccessTokens component', () => {
  let component: AccessTokens;
  let api: {
    getAccessTokens: ReturnType<typeof vi.fn>;
    deleteAccessToken: ReturnType<typeof vi.fn>;
    createAccessToken: ReturnType<typeof vi.fn>;
  };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn>; };
  let portal: { open: ReturnType<typeof vi.fn>; };

  beforeEach(() => {
    api = {
      getAccessTokens: vi.fn(() => of(mockTokens)),
      deleteAccessToken: vi.fn(() => of(void 0)),
      createAccessToken: vi.fn(() => of({ accessToken: 'new-access-token' })),
    };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AccessTokens],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: PortalService, useValue: portal },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialToastState, toastStateToken),
      ],
    });

    TestBed.overrideComponent(AccessTokens, { set: { template: '' } });

    const fixture = TestBed.createComponent(AccessTokens);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads access tokens on init and populates the signal', () => {
    expect(api.getAccessTokens).toHaveBeenCalled();
    expect(component['accessTokens']()).toEqual(mockTokens);
  });

  it('calls deleteAccessToken and shows toast when revoking a token', () => {
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onRevokeAccessToken']('hash-1');

    expect(api.deleteAccessToken).toHaveBeenCalledWith('hash-1');
    expect(toastState.state.message()).toBe('Toast.AccessTokenRevoked');
  });

  it('reloads access tokens after revoking', () => {
    component['onRevokeAccessToken']('hash-1');

    expect(api.getAccessTokens).toHaveBeenCalledTimes(2);
  });

  it('creates an access token and opens the token dialog when confirmed', () => {
    component['onCreateAccessToken']();

    expect(api.createAccessToken).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalled();
  });

  it('sets toast message after creating an access token', () => {
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onCreateAccessToken']();

    expect(toastState.state.message()).toBe('Toast.AccessTokenCreated');
  });

  it('reloads access tokens after creating a new one', () => {
    component['onCreateAccessToken']();

    expect(api.getAccessTokens).toHaveBeenCalledTimes(2);
  });

  it('does not create an access token when user cancels confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);

    component['onCreateAccessToken']();

    expect(api.createAccessToken).not.toHaveBeenCalled();
  });
});
