import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DialogShell } from './dialog-shell';

@Component({
  imports: [DialogShell],
  template: `
    <libc-dialog-shell>
      <div dialog-shell-content>Content</div>
    </libc-dialog-shell>
    <button id="other">Other focusable</button>
  `,
})
class HostComponent {}

describe('DialogShell component', () => {
  let closeSpy: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(() => {
    closeSpy = vi.fn();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PortalService, useValue: { close: closeSpy } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('focuses dialog root on init and calls portal.close on button click', () => {
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    expect(document.activeElement).toBe(dialogRoot);

    const closeButton = fixture.nativeElement.querySelector('.dialog-header button') as HTMLButtonElement;
    closeButton?.click();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls portal.close when Escape key is pressed', () => {
    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLElement;
    dialogRoot?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('calls portal.close when backdrop is clicked', () => {
    const overlay = fixture.nativeElement.querySelector('.dialog-overlay') as HTMLButtonElement;
    overlay?.click();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
