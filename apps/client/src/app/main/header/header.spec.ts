import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortalService } from '@services/portal-service';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './header';
import { MenuDialog } from '../menu-dialog/menu-dialog';

describe('Header component', () => {
  let fixture: ComponentFixture<Header>;
  let component: Header;
  let portal: { open: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    portal = { open: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: PortalService, useValue: portal },
        { provide: ThemeService, useValue: { themeLogo: signal('logo-mock.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
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
});
