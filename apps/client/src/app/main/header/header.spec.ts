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

  it('uses movie tracker as the title for movie tracker page', () => {
    routerEvents.next(new NavigationEnd(1, '/collection/movie-tracker', '/collection/movie-tracker'));

    expect(component['currentNavTitle']()).toBe('MovieTracker');
  });

  it('uses settings as the title for settings child pages', () => {
    routerEvents.next(new NavigationEnd(1, '/settings/tag-management', '/settings/tag-management'));

    expect(component['currentNavTitle']()).toBe('Settings');
  });
});
