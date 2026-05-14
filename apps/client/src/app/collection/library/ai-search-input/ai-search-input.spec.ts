import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form } from '@angular/forms/signals';
import { AlertService } from '@services/alert-service';
import { provideSignalTranslateConfig } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  let alertSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    alertSpy = vi.fn();

    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: AlertService, useValue: { show: alertSpy } }, provideSignalTranslateConfig({ path: '' })],
    });

    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the compact trigger button and is collapsed by default', () => {
    const trigger = fixture.nativeElement.querySelector('.compact-trigger');
    expect(trigger).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.expanded-panel')).toBeNull();
  });

  it('expands the panel when the compact trigger is clicked', async () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.expanded-panel')).toBeTruthy();
  });

  it('collapses the panel when the backdrop is clicked', async () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const backdrop: HTMLElement = fixture.nativeElement.querySelector('.backdrop');
    backdrop.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.expanded-panel')).toBeNull();
  });

  it('emits sendEvent and collapses the panel when the send button is clicked', async () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const sendButton: HTMLElement = fixture.nativeElement.querySelector('.button-icon');
    sendButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.sendCalled).toBe(true);
    expect(fixture.nativeElement.querySelector('.expanded-panel')).toBeNull();
  });

  it('collapses the panel on Escape keydown in the expanded panel', async () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel: HTMLElement = fixture.nativeElement.querySelector('.expanded-panel');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.expanded-panel')).toBeNull();
  });

  it('shows an alert when the info link is clicked', async () => {
    const trigger: HTMLElement = fixture.nativeElement.querySelector('.compact-trigger');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const infoLink: HTMLElement = fixture.nativeElement.querySelector('.text-button');
    infoLink.click();
    fixture.detectChanges();

    expect(alertSpy).toHaveBeenCalled();
  });
});
