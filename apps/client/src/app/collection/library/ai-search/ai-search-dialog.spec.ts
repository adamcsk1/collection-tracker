import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { AlertService } from '@services/alert-service';
import { PortalService } from '@services/portal-service';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSearchDialog } from './ai-search-dialog';

@Component({
  selector: 'ct-test-ai-search-dialog-host',
  imports: [AiSearchDialog],
  template: `<ct-ai-search-dialog [formField]="promptField" placeholder="Ask AI..." [send]="onSend" />`,
})
class HostComponent {
  protected readonly promptModel = signal('');
  protected readonly promptField = form(this.promptModel);
  public sendCalled = false;
  public readonly onSend = (): void => {
    this.sendCalled = true;
  };
}

describe('AiSearchDialog component', () => {
  let fixture: ComponentFixture<HostComponent>;
  let alertSpy: ReturnType<typeof vi.fn>;
  let portalCloseSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();
    portalCloseSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: AlertService, useValue: { show: alertSpy } },
        { provide: PortalService, useValue: { close: portalCloseSpy } },
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the AI search textarea', () => {
    expect(fixture.nativeElement.querySelector('[data-test-id="ai-search-textarea"]')).toBeTruthy();
  });

  it('uses the standard dialog host class', () => {
    const dialog = fixture.nativeElement.querySelector('ct-ai-search-dialog') as HTMLElement;

    expect(dialog.classList.contains('dialog')).toBe(true);
  });

  it('calls send and closes the portal when the send button is clicked', () => {
    const sendButton: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="ai-search-send"]');
    sendButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.sendCalled).toBe(true);
    expect(portalCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('shows an alert when the info button is clicked', () => {
    const infoButton: HTMLElement = fixture.nativeElement.querySelector('[data-test-id="ai-search-info"]');
    infoButton.click();
    fixture.detectChanges();

    expect(alertSpy).toHaveBeenCalled();
  });
});
