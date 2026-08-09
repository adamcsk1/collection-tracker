import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { About } from './about';

describe('About', () => {
  let fixture: ComponentFixture<About>;
  let component: About;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [About],
      providers: [
        { provide: ThemeService, useValue: { themeLogo: signal('logo.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    TestBed.overrideComponent(About, { set: { template: '' } });

    fixture = TestBed.createComponent(About);
    component = fixture.componentInstance;
  });

  it('exposes static build info, theme logo, and base path', () => {
    expect(component['build']).toBe('localhost-build');
    expect(component['buildDate']).toBe('localhost-build-date');
    expect(component['appVersion']).toBe('localhost-version');
    expect(component['themeLogo']()).toBe('logo.png');
    expect(component['basePath']).toBeDefined();
  });

  it('exposes translated labels', () => {
    expect(component['translations'].title()).toBe('AppTitle');
    expect(component['translations'].aboutDescription()).toBe('About.Description');
    expect(component['translations'].build()).toBe('Build');
    expect(component['translations'].buildDate()).toBe('BuildDate');
    expect(component['translations'].appVersion()).toBe('AppVersion');
    expect(component['translations'].links()).toBe('Links');
    expect(component['translations'].navigateToServerHealth()).toBe('NavigateToServerHealth');
    expect(component['translations'].viewOnGitHub()).toBe('ViewOnGitHub');
    expect(component['translations'].navigateToApiDocs()).toBe('NavigateToApiDocs');
  });
});
