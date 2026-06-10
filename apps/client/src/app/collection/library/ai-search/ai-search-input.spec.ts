import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { PortalService } from '@services/portal-service';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSearchDialog } from './ai-search-dialog';
import { AiSearchInput } from './ai-search-input';

@Component({
  imports: [AiSearchInput],
  template: `<ct-ai-search-input [formField]="promptField" placeholder="Ask AI..." (sendEvent)="onSend()" />`,
})
class HostComponent {
  protected readonly promptModel = signal('');
  protected readonly promptField = form(this.promptModel);
  public sendCalled = false;
  public onSend(): void {
    this.sendCalled = true;
  }
}

describe('AiSearchInput component', () => {
  let fixture: ComponentFixture<HostComponent>;
  let portalOpenSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    portalOpenSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PortalService, useValue: { open: portalOpenSpy } },
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the compact trigger button and no inline dialog', () => {
    const trigger = fixture.nativeElement.querySelector('.compact-trigger');
    expect(trigger).toBeTruthy();
    expect(fixture.nativeElement.querySelector('ct-ai-search-dialog')).toBeNull();
  });

  it('opens the AI search dialog through the portal when the compact trigger is clicked', () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();

    expect(portalOpenSpy).toHaveBeenCalledWith(AiSearchDialog, {
      formField: expect.any(Function),
      placeholder: 'Ask AI...',
      send: expect.any(Function),
    });
  });

  it('passes a send callback to the dialog', () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();
    const inputs = portalOpenSpy.mock.calls[0][1] as { send: () => void };
    inputs.send();

    expect(fixture.componentInstance.sendCalled).toBe(true);
  });
});
