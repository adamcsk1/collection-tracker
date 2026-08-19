import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { ApiService } from '@services/api/api-service';
import { ConfirmService } from '@services/confirm-service';
import { PortalService } from '@services/portal-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { EMPTY, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountActions } from './account-actions';

describe('AccountActions component', () => {
  let fixture: ComponentFixture<AccountActions>;
  let component: AccountActions;
  let api: { createNewUserToken: ReturnType<typeof vi.fn>; deleteUser: ReturnType<typeof vi.fn> };
  let confirm: { ifConfirmed: ReturnType<typeof vi.fn> };
  let portal: { open: ReturnType<typeof vi.fn> };
  let webstorage: { clear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      createNewUserToken: vi.fn(() => of({ newToken: 'new-token-value' })),
      deleteUser: vi.fn(() => of(void 0)),
    };
    confirm = { ifConfirmed: vi.fn(() => of(true)) };
    portal = { open: vi.fn() };
    webstorage = { clear: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AccountActions],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ConfirmService, useValue: confirm },
        { provide: PortalService, useValue: portal },
        { provide: WebstorageService, useValue: webstorage },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        provideStore(initialToastState, toastStateToken),
      ],
    });

    fixture = TestBed.createComponent(AccountActions);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders account guidance as an article callout', () => {
    const callout = fixture.nativeElement.querySelector('[data-test-id="account-actions-info"]');

    expect(callout.querySelector('aside').getAttribute('role')).toBe('note');
    expect(callout.querySelector('.material-icons').textContent.trim()).toBe('article');
    expect(callout.textContent).toContain('Message.UserSettings');
  });

  it('creates a new user token and opens the token dialog when confirmed', () => {
    component['onCreateNewUserToken']();

    expect(api.createNewUserToken).toHaveBeenCalled();
    expect(portal.open).toHaveBeenCalled();
  });

  it('sets toast message after creating new user token', () => {
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onCreateNewUserToken']();

    expect(toastState.state.message()).toBe('Toast.NewUserTokenCreated');
  });

  it('does not call createNewUserToken when user cancels confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);

    component['onCreateNewUserToken']();

    expect(api.createNewUserToken).not.toHaveBeenCalled();
  });

  it('calls deleteUser and clears webstorage when confirmed', () => {
    vi.useFakeTimers();

    component['onDeleteUser']();

    expect(api.deleteUser).toHaveBeenCalled();
    expect(webstorage.clear).toHaveBeenCalled();

    vi.clearAllTimers();
  });

  it('sets toast message when deleting user', () => {
    vi.useFakeTimers();
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onDeleteUser']();

    expect(toastState.state.message()).toBe('Toast.UserDeleted');

    vi.clearAllTimers();
  });

  it('does not call deleteUser when user cancels confirmation', () => {
    confirm.ifConfirmed = vi.fn(() => EMPTY);

    component['onDeleteUser']();

    expect(api.deleteUser).not.toHaveBeenCalled();
  });
});
