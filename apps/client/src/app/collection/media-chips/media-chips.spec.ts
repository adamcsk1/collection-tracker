import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgxSignalTranslateService, provideSignalTranslateConfig } from 'ngx-signal-translate';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CollectionMediaChips } from './media-chips';

describe('CollectionMediaChips', () => {
  let fixture: ComponentFixture<CollectionMediaChips>;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      imports: [CollectionMediaChips],
      providers: [
        { provide: Router, useValue: router },
        { provide: NgxSignalTranslateService, useValue: { translate: (key: string) => key } },
        provideSignalTranslateConfig({ path: '' }),
      ],
    });
    fixture = TestBed.createComponent(CollectionMediaChips);
    fixture.componentRef.setInput('active', 'all');
    fixture.componentRef.setInput('booksEnabled', true);
    fixture.detectChanges();
  });

  it('renders all media chips with icons when books are enabled', () => {
    const host = fixture.nativeElement as HTMLElement;
    const allChip = host.querySelector('[data-test-id="collection-media-chip-all"]') as HTMLButtonElement;
    expect(allChip).toBeTruthy();
    expect(host.querySelector('[data-test-id="collection-media-chip-movie"]')).toBeTruthy();
    expect(host.querySelector('[data-test-id="collection-media-chip-series"]')).toBeTruthy();
    expect(host.querySelector('[data-test-id="collection-media-chip-book"]')).toBeTruthy();
    expect(allChip.classList.contains('button-reveal-label')).toBe(true);
    expect(allChip.querySelector('.material-icons')?.textContent?.trim()).toBe('local_library');
    expect(
      host.querySelector('[data-test-id="collection-media-chip-movie"] .material-icons')?.textContent?.trim()
    ).toBe('movie');
  });

  it('hides books chip when books feature is disabled', () => {
    fixture.componentRef.setInput('booksEnabled', false);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[data-test-id="collection-media-chip-book"]')).toBeNull();
  });

  it('navigates with merged type query params', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('[data-test-id="collection-media-chip-movie"]')?.click();
    expect(router.navigate).toHaveBeenCalledWith(['/collection', 'library'], {
      queryParams: { type: 'movie' },
      queryParamsHandling: 'merge',
    });

    host.querySelector<HTMLButtonElement>('[data-test-id="collection-media-chip-book"]')?.click();
    expect(router.navigate).toHaveBeenCalledWith(['/collection', 'library'], {
      queryParams: { type: 'book' },
      queryParamsHandling: 'merge',
    });
  });

  it('clears type when selecting all', () => {
    fixture.componentRef.setInput('active', 'movie');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('[data-test-id="collection-media-chip-all"]')?.click();
    expect(router.navigate).toHaveBeenCalledWith(['/collection', 'library'], {
      queryParams: { type: null },
      queryParamsHandling: 'merge',
    });
  });
});
