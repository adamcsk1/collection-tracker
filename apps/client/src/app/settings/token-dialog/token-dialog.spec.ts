import { ComponentFixture, TestBed } from '@angular/core/testing';
import { initialToastState, toastStateToken, type ToastState } from '@components/toast/toast-store';
import { PortalService } from '@services/portal-service';
import * as copyToClipboardUtil from '@shared/utils/copy-to-clipboard-util';
import * as mobileUserAgentUtil from '@shared/utils/mobile-user-agent.util';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { TokenDialog } from './token-dialog';

vi.mock('@shared/utils/copy-to-clipboard-util', () => ({ copyToClipboard: vi.fn() }));
vi.mock('@shared/utils/mobile-user-agent.util', () => ({ mobileUserAgent: vi.fn() }));

describe('TokenDialog component', () => {
  let component: TokenDialog;
  let fixture: ComponentFixture<TokenDialog>;

  beforeEach(() => {
    (mobileUserAgentUtil.mobileUserAgent as Mock).mockReturnValue(null);

    TestBed.configureTestingModule({
      imports: [TokenDialog],
      providers: [
        provideStore(initialToastState, toastStateToken),
        { provide: PortalService, useValue: { closeTop: vi.fn() } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    fixture = TestBed.createComponent(TokenDialog);
    fixture.componentRef.setInput('title', 'My Title');
    fixture.componentRef.setInput('message', 'My Message');
    fixture.componentRef.setInput('token', 'secret-token');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('names the dialog using only the title text', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;

    expect(dialog).toHaveAccessibleName('My Title');
  });

  it('calls copyToClipboard with the current token', () => {
    component['onCopyToClipboard']();

    expect(copyToClipboardUtil.copyToClipboard).toHaveBeenCalledWith('secret-token');
  });

  it('sets toast message when not on a mobile device', () => {
    (mobileUserAgentUtil.mobileUserAgent as Mock).mockReturnValue(null);
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onCopyToClipboard']();

    expect(toastState.state.message()).toBe('Toast.CopiedToClipboard');
  });

  it('does not set toast message on a mobile device', () => {
    (mobileUserAgentUtil.mobileUserAgent as Mock).mockReturnValue(['Android'] as unknown as RegExpMatchArray);
    const toastState = TestBed.inject(toastStateToken) as NgxSimpleSignalStoreService<ToastState>;

    component['onCopyToClipboard']();

    expect(toastState.state.message()).toBe('');
  });
});
