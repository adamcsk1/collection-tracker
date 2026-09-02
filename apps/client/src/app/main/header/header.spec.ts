import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
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
