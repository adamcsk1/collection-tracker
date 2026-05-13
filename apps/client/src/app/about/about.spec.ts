import { ComponentFixture, TestBed } from '@angular/core/testing';
import { About } from './about';
import { mainStateToken, initialMainState } from '../main/main-store';
import { toastStateToken, initialToastState } from '@components/toast/toast-store';
import { provideStore } from 'ngx-simple-signal-store';
import { ThemeService } from '@services/theme/theme-service';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('About', () => {
  let fixture: ComponentFixture<About>;
  let component: About;
  let webstorage: { setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    webstorage = { setItem: vi.fn(), removeItem: vi.fn() };

    TestBed.configureTestingModule({
      imports: [About],
      providers: [
        provideStore(initialMainState, mainStateToken),
        provideStore(initialToastState, toastStateToken),
        { provide: ThemeService, useValue: { themeLogo: () => 'logo.png' } },
        { provide: WebstorageService, useValue: webstorage },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(About, { set: { template: '' } });
  });

  const setup = () => {
    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('exposes static build info, theme logo, and base path', () => {
    setup();

    expect(component['build']).toBe('localhost-build');
    expect(component['buildDate']).toBe('localhost-build-date');
    expect(component['appVersion']).toBe('localhost-version');
    expect(component['themeLogo']()).toBe('logo.png');
    expect(component['basePath']).toBeDefined();
  });
});
