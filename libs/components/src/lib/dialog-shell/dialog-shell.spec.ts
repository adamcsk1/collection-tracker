import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
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
  let closeSpy: jest.Mock;

  beforeEach(() => {
    closeSpy = jest.fn();
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: PortalService, useValue: { close: closeSpy } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });
  });

  it('focuses dialog root on init and calls portal.close on button click', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLDivElement;
    expect(document.activeElement).toBe(dialogRoot);

    const closeButton = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    closeButton.click();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls portal.close when Escape key is pressed', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const dialogRoot = fixture.nativeElement.querySelector('.dialog-frame') as HTMLDivElement;
    dialogRoot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
