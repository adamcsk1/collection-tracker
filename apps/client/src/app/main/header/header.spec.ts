import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './header';
import { MenuDialog } from '../menu-dialog/menu-dialog';

describe('Header component', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let portal: { open: ReturnType<typeof vi.fn> };
  let routerEvents: Subject<NavigationEnd>;
  let router: { url: string; events: Subject<NavigationEnd> };

  beforeEach(() => {
    portal = { open: vi.fn() };
    routerEvents = new Subject<NavigationEnd>();
    router = { url: '/collection/library', events: routerEvents };

    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: Router, useValue: router },
        provideSignalTranslateConfig({ path: '' }),
      ],
    });

    TestBed.overrideComponent(Header, { set: { template: '' } });

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens menu dialog when menu button is clicked', () => {
    component['onOpenMenu']();

    expect(portal.open).toHaveBeenCalledTimes(1);
    expect(portal.open).toHaveBeenCalledWith(MenuDialog);
  });

  it('shows the current top-level navigation title', () => {
    expect(component['currentNavTitle']()).toBe('Collection');

    routerEvents.next(new NavigationEnd(1, '/collection/favorites', '/collection/favorites'));

    expect(component['currentNavTitle']()).toBe('Favorites');
  });

  it('uses settings as the title for settings child pages', () => {
    routerEvents.next(new NavigationEnd(1, '/settings/tag-configs', '/settings/tag-configs'));

    expect(component['currentNavTitle']()).toBe('Settings');
  });
});
