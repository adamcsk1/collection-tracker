import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeService } from '@services/theme/theme-service';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it } from 'vitest';
import { About } from './about';

describe('About', () => {
  let fixture: ComponentFixture<About>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [About],
      providers: [
        { provide: ThemeService, useValue: { themeLogo: signal('logo.png') } },
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
      ],
    });

    fixture = TestBed.createComponent(About);
  });

  it('renders build information with the themed logo', async () => {
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const logo = element.querySelector('img');

    expect(logo?.getAttribute('src')).toBe('icons/logo.png');
    expect(logo?.getAttribute('alt')).toBe('AppTitle');
    expect(element.querySelector('[data-test-id="about-title"]')?.textContent).toContain('AppTitle');
    expect(element.querySelector('[data-test-id="about-build"]')?.textContent).toContain('localhost-build');
    expect(element.querySelector('[data-test-id="about-version"]')?.textContent).toContain('localhost-version');
  });
});
