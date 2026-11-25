import { TestBed, DeferBlockBehavior } from '@angular/core/testing';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { provideStore } from 'ngx-simple-signal-store';
import { describe, expect, it } from 'vitest';
import { initialMainState, mainStateToken } from '../main/main-store';
import { Statistics } from './statistics';

describe('Statistics', () => {
  it('defaults to My year and defers feature components until opened', async () => {
    TestBed.configureTestingModule({
      imports: [Statistics],
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        provideStore(initialMainState, mainStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
      ],
    });
    const fixture = TestBed.createComponent(Statistics);
    await fixture.whenStable();
    const host: HTMLElement = fixture.nativeElement;
    const header = host.querySelector('[data-test-id="statistics-header"]')!;
    expect(header.tagName).toBe('DIV');
    expect(header.getAttribute('role')).not.toBe('banner');
    expect(header.querySelector('[data-test-id="statistics-view-title"]')).not.toBeNull();
    expect(header.querySelector('[data-test-id="statistics-media-chips"]')).not.toBeNull();
    expect(host.querySelector('[data-test-id="statistics-view-title"]')?.tagName).toBe('H2');
    const yearTab = host.querySelector<HTMLButtonElement>('[data-test-id="statistics-year-view"]')!;
    const collectionTab = host.querySelector<HTMLButtonElement>('[data-test-id="statistics-collection-view"]')!;
    expect(yearTab.getAttribute('role')).toBe('tab');
    expect(yearTab.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('#statistics-view-panel-1')?.getAttribute('aria-labelledby')).toBe(yearTab.id);
    expect(host.querySelector<HTMLElement>('#statistics-view-panel-2')?.hidden).toBe(true);
    expect(host.querySelector('ct-statistics-activity')).toBeNull();
    collectionTab.click();
    await fixture.whenStable();
    expect(collectionTab.getAttribute('aria-selected')).toBe('true');
    expect(yearTab.getAttribute('aria-selected')).toBe('false');
    expect(host.querySelector<HTMLElement>('#statistics-view-panel-1')?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('#statistics-view-panel-2')?.hidden).toBe(false);
    expect(host.querySelector('ct-statistics-collection')).toBeNull();
    collectionTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await fixture.whenStable();
    expect(yearTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(yearTab);
  });
});
