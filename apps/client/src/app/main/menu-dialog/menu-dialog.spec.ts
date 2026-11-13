import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiService } from '@services/api/api-service';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { describe, expect, it, vi } from 'vitest';
import { LogoutService } from '../logout-service';
import { initialMainState, mainStateToken } from '../main-store';
import { MenuDialog } from './menu-dialog';

describe('MenuDialog', () => {
  it('names the dialog using the translated menu label', async () => {
    TestBed.configureTestingModule({
      imports: [MenuDialog],
      providers: [
        { provide: PortalService, useValue: { closeAll: vi.fn(), closeTop: vi.fn() } },
        { provide: ApiService, useValue: {} },
        { provide: LogoutService, useValue: {} },
        { provide: ThemeService, useValue: { themeLogo: signal('logo.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => `translated ${key}` } },
        provideStore(initialMainState, mainStateToken),
        provideRouter([]),
      ],
    });

    const fixture = TestBed.createComponent(MenuDialog);
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    const label = fixture.nativeElement.querySelector(`#${dialog.getAttribute('aria-labelledby')}`) as HTMLElement;
    expect(label.textContent?.trim()).toBe('translated Menu');
  });
});
