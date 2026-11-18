import { Component, viewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MessageDialogRequest } from '@services/message-dialog-model';
import { MESSAGE_DIALOG_COMPONENT } from '@services/message-dialog-const';
import { MessageDialogService } from '@services/message-dialog-service';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogShell } from '../dialog-shell/dialog-shell';
import { MessageDialog } from './message-dialog';

describe('MessageDialog component', () => {
  let fixture: ComponentFixture<MessageDialog>;
  let close: ReturnType<typeof vi.fn>;
  let resolve: ReturnType<typeof vi.fn<MessageDialogRequest['resolve']>>;

  const initialize = async (request: Partial<MessageDialogRequest> = {}): Promise<void> => {
    fixture = TestBed.createComponent(MessageDialog);
    fixture.componentRef.setInput('request', {
      message: 'Message body',
      mode: 'confirm',
      options: {},
      resolve,
      ...request,
    } satisfies MessageDialogRequest);
    await fixture.whenStable();
  };

  const action = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-test-id="message-dialog-confirm"]');

  beforeEach(() => {
    close = vi.fn();
    resolve = vi.fn();
    TestBed.configureTestingModule({
      imports: [MessageDialog],
      providers: [
        { provide: PortalService, useValue: { close } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
  });

  it.each(['confirm', 'alert', 'info'] as const)('renders %s with accessible labels and mode actions', async (mode) => {
    await initialize({ mode });
    const root = fixture.nativeElement.querySelector('[data-test-id="dialog-frame"]') as HTMLElement;
    const title = fixture.nativeElement.querySelector('[data-test-id="message-dialog-title"]') as HTMLElement;
    const message = fixture.nativeElement.querySelector('[data-test-id="message-dialog-message"]') as HTMLElement;

    expect(root.getAttribute('role')).toBe(mode === 'info' ? 'dialog' : 'alertdialog');
    expect(root.classList.contains('compact')).toBe(true);
    expect(root.getAttribute('aria-labelledby')).toBe(title.id);
    expect(root.getAttribute('aria-describedby')).toBe(message.id);
    expect(title.textContent).toContain(
      mode === 'confirm' ? 'Dialog.ConfirmTitle' : mode === 'info' ? 'Dialog.Info' : 'Dialog.Alert'
    );
    expect(message.textContent).toBe('Message body');
    expect(action().textContent?.trim()).toBe(mode === 'confirm' ? 'Dialog.Confirm' : 'Dialog.Ok');
    expect(!!fixture.nativeElement.querySelector('[data-test-id="message-dialog-cancel"]')).toBe(mode === 'confirm');
    expect(fixture.nativeElement.querySelector('[data-test-id="message-dialog-input"]')).toBeNull();
    expect(action().disabled).toBe(false);
  });

  it('uses custom title and action labels', async () => {
    await initialize({ options: { title: 'Custom title', actionLabel: 'Delete' } });

    expect(fixture.nativeElement.querySelector('[data-test-id="message-dialog-title"]').textContent).toContain(
      'Custom title'
    );
    expect(action().textContent?.trim()).toBe('Delete');
  });

  it('requires an exact typed match for destructive confirmation through the signal form', async () => {
    await initialize({ options: { destructive: true, confirmationText: 'My Item' } });
    const input = fixture.nativeElement.querySelector(
      '[data-test-id="message-dialog-input"] input'
    ) as HTMLInputElement;

    expect(action().disabled).toBe(true);
    expect(action().classList.contains('button-danger')).toBe(true);
    fixture.componentInstance['finish'](true);
    expect(close).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    for (const value of ['my item', ' My Item', 'My Item ', 'My Item']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
      expect(action().disabled).toBe(value !== 'My Item');
    }

    action().click();
    action().click();
    expect(resolve).not.toHaveBeenCalled();
    fixture.debugElement.query(By.directive(DialogShell)).componentInstance.closed.emit();
    expect(resolve).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('never enables a destructive action with empty confirmation text', async () => {
    await initialize({ options: { destructive: true, confirmationText: '' } });

    expect(action().disabled).toBe(true);
    fixture.componentInstance['finish'](true);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('closes before resolving, even when close destroys the component synchronously', async () => {
    await initialize();
    close.mockImplementation(() => fixture.destroy());
    resolve.mockImplementation(() => expect(close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement));

    action().click();
    expect(close).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    fixture.debugElement.query(By.directive(DialogShell)).componentInstance.closed.emit();

    expect(resolve).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('resolves cancellation once without requiring the destructive phrase', async () => {
    await initialize({ options: { destructive: true, confirmationText: 'My Item' } });
    fixture.nativeElement.querySelector('[data-test-id="message-dialog-cancel"]').click();
    fixture.componentInstance['finish'](true);
    expect(close).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();

    fixture.debugElement.query(By.directive(DialogShell)).componentInstance.closed.emit();
    fixture.destroy();

    expect(close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
    expect(resolve).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('treats shell dismissal as cancellation', async () => {
    await initialize();
    const shell = fixture.debugElement.query(By.directive(DialogShell)).componentInstance as DialogShell;

    shell.closed.emit();

    expect(close).toHaveBeenCalledExactlyOnceWith(fixture.nativeElement);
    expect(resolve).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('resolves false on external destruction without closing another portal', async () => {
    await initialize();

    fixture.destroy();
    fixture.componentInstance.ngOnDestroy();

    expect(resolve).toHaveBeenCalledExactlyOnceWith(false);
    expect(close).not.toHaveBeenCalled();
  });
});

@Component({
  selector: 'libc-test-message-portal-host',
  template:
    '<main data-dialog-background><button data-test-id="trigger">Open</button></main><ng-container #portalHost />',
})
class MessagePortalHost {
  public readonly portalHost = viewChild.required('portalHost', { read: ViewContainerRef });
}

describe('MessageDialog stacked dismissal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [MessagePortalHost],
      providers: [
        { provide: MESSAGE_DIALOG_COMPONENT, useValue: MessageDialog },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('dismisses only the original message when another alert opens during its close animation', () => {
    const fixture = TestBed.createComponent(MessagePortalHost);
    fixture.detectChanges();
    const portal = TestBed.inject(PortalService);
    portal.setViewContainerRef(fixture.componentInstance.portalHost());
    const dialogs = TestBed.inject(MessageDialogService);
    const trigger = fixture.nativeElement.querySelector('[data-test-id="trigger"]') as HTMLButtonElement;
    trigger.focus();
    const originalResult = vi.fn();
    const secondResult = vi.fn();
    dialogs.open({ message: 'Original', mode: 'confirm', options: {} }).subscribe(originalResult);
    fixture.detectChanges();
    const original = portal.componentRef()!;
    const originalHost = original.location.nativeElement as HTMLElement;
    const originalFrame = originalHost.querySelector('[data-test-id="dialog-frame"]') as HTMLElement;
    originalFrame.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    dialogs.open({ message: 'Second alert', mode: 'alert', options: {} }).subscribe(secondResult);
    fixture.detectChanges();
    const second = portal.componentRef()!;
    const secondHost = second.location.nativeElement as HTMLElement;
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    expect(originalHost.isConnected).toBe(false);
    expect(originalResult).toHaveBeenCalledExactlyOnceWith(false);
    expect(secondResult).not.toHaveBeenCalled();
    expect(portal.componentRef()).toBe(second);
    expect(secondHost.isConnected).toBe(true);
    expect(secondHost.hasAttribute('inert')).toBe(false);
    const confirm = secondHost.querySelector('[data-test-id="message-dialog-confirm"]') as HTMLButtonElement;
    confirm.click();
    expect(secondResult).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    fixture.detectChanges();

    expect(secondResult).toHaveBeenCalledExactlyOnceWith(true);
    expect(portal.componentRef()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.closest('[inert]')).toBeNull();
  });
});
