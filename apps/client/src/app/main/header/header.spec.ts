import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MenuDialog } from '../menu-dialog/menu-dialog';
import { Header } from './header';

describe('Header component', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let routerEvents: Subject<NavigationEnd>;
  let router: { url: string; events: Subject<NavigationEnd> };

  beforeEach(() => {
    routerEvents = new Subject<NavigationEnd>();
    router = { url: '/collection/library', events: routerEvents };

    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: Router, useValue: router },
        { provide: PortalService, useValue: { open: vi.fn() } },
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    TestBed.overrideComponent(Header, { set: { template: '' } });

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the current top-level navigation title', () => {
    expect(component['currentNavTitle']()).toBe('Collection');

    routerEvents.next(new NavigationEnd(1, '/collection/library?favorite=true', '/collection/library?favorite=true'));

    expect(component['currentNavTitle']()).toBe('Collection');
  });

  it('uses tracking as the title for the tracking page', () => {
    routerEvents.next(new NavigationEnd(1, '/collection/tracking', '/collection/tracking'));

    expect(component['currentNavTitle']()).toBe('Tracking');
  });

  it('uses Up Next as the title for the up-next page', () => {
    routerEvents.next(new NavigationEnd(1, '/collection/up-next', '/collection/up-next'));

    expect(component['currentNavTitle']()).toBe('UpNext');
  });

  it('uses books as the title for books page', () => {
    routerEvents.next(new NavigationEnd(1, '/collection/books', '/collection/books'));

    expect(component['currentNavTitle']()).toBe('Books');
  });

  it('uses music as the title for the music page', () => {
    routerEvents.next(new NavigationEnd(1, '/collection/music', '/collection/music'));

    expect(component['currentNavTitle']()).toBe('Music');
  });

  it('uses settings as the title for settings child pages', () => {
    routerEvents.next(new NavigationEnd(1, '/settings/tag-management', '/settings/tag-management'));

    expect(component['currentNavTitle']()).toBe('Settings');
  });

  it('uses statistics as the title for the statistics page', () => {
    routerEvents.next(new NavigationEnd(1, '/statistics', '/statistics'));

    expect(component['currentNavTitle']()).toBe('Statistics');
  });
});

describe('Header menu', () => {
  it('renders a labelled menu trigger in the header and opens the existing dialog', async () => {
    const open = vi.fn();
    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: PortalService, useValue: { open } },
      ],
    });
    const fixture = TestBed.createComponent(Header);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-test-id="nav-menu-button"]'
    )!;
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Menu');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.querySelector('.material-icons')?.getAttribute('aria-hidden')).toBe('true');
    button.click();
    expect(open).toHaveBeenCalledWith(MenuDialog);
  });
});
