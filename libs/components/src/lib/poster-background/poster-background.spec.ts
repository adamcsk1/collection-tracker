import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PublicApiService } from '@services/api/public-api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import * as mobileUserAgentUtil from '@shared/utils/mobile-user-agent.util';
import * as coarsePointerUtil from '@shared/utils/prefer-coarse-pointer-util';
import * as randomIntUtil from '@shared/utils/random-int-util';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PosterBackground } from './poster-background';

vi.mock('@shared/utils/mobile-user-agent.util', () => ({
  mobileUserAgent: vi.fn(() => false),
}));

vi.mock('@shared/utils/prefer-coarse-pointer-util', () => ({
  getCoarsePointerBasedDebounceTime: vi.fn(() => 0),
}));

describe('PosterBackground component', () => {
  let fixture: ComponentFixture<PosterBackground>;
  let component: PosterBackground;
  let api: { getBackgroundImages: ReturnType<typeof vi.fn> };
  let randomSpy: ReturnType<typeof vi.spyOn>;
  let orientationTarget: EventTarget;
  let setImagesSpy: ReturnType<typeof vi.spyOn>;

  const createComponent = async () => {
    fixture = TestBed.createComponent(PosterBackground);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    randomSpy = vi.spyOn(randomIntUtil, 'randomInt').mockImplementation((min) => min);
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });
    Object.defineProperty(window, 'visualViewport', {
      value: { height: 800, width: 500 },
      writable: true,
      configurable: true,
    });
    orientationTarget = new EventTarget();
    Object.defineProperty(window.screen, 'orientation', {
      value: orientationTarget,
      writable: true,
      configurable: true,
    });

    (mobileUserAgentUtil.mobileUserAgent as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (coarsePointerUtil.getCoarsePointerBasedDebounceTime as unknown as ReturnType<typeof vi.fn>).mockReturnValue(0);

    api = {
      getBackgroundImages: vi.fn(() =>
        of({
          images: ['img-1', 'img-2'],
        })
      ),
    };

    setImagesSpy = vi.spyOn(PosterBackground.prototype as never, 'setImages' as never);

    TestBed.configureTestingModule({
      imports: [PosterBackground],
      providers: [{ provide: PublicApiService, useValue: api }, provideStore(initialApiState, apiStateToken)],
    });
  });

  afterEach(() => {
    randomSpy.mockRestore();
    setImagesSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps images empty when the API returns no images', async () => {
    api.getBackgroundImages.mockReturnValue(of({ images: [] }));
    await createComponent();

    expect(component['images']()).toEqual([]);
  });

  it('generates background images when API returns images', async () => {
    await createComponent();

    const images = component['images']();
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((image) => ['img-1', 'img-2'].includes(image.url))).toBe(true);
  });

  it('repeats a shuffled order without stacking the same poster in a column', async () => {
    await createComponent();

    const columnX = component['images']()[0].x;
    const columnUrls = component['images']()
      .filter((image) => image.x === columnX)
      .map((image) => image.url);

    expect(columnUrls.length).toBeGreaterThan(1);
    expect(columnUrls.every((url, index) => index === 0 || url !== columnUrls[index - 1])).toBe(true);
  });

  it('uses every unique source URL when tiling', async () => {
    api.getBackgroundImages.mockReturnValue(of({ images: ['a', 'b', 'c', 'd', 'e', 'f'] }));
    await createComponent();

    expect(new Set(component['images']().map((image) => image.url)).size).toBe(6);
  });

  it('drops duplicate source URLs before tiling', async () => {
    api.getBackgroundImages.mockReturnValue(of({ images: ['img-1', 'img-1', '', 'img-2'] }));
    await createComponent();

    expect(component['imageUrls']).toEqual(['img-2', 'img-1']);
  });

  it('loads background images once on creation', async () => {
    await createComponent();

    expect(api.getBackgroundImages).toHaveBeenCalledTimes(1);
  });

  it('reloads background images when the refresh trigger changes', async () => {
    await createComponent();

    fixture.componentRef.setInput('refreshTrigger', 1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(api.getBackgroundImages).toHaveBeenCalledTimes(2);
  });

  it('proxies external background image URLs', async () => {
    api.getBackgroundImages.mockReturnValue(
      of({
        images: ['https://images.example/poster.png'],
      })
    );
    TestBed.inject(apiStateToken).setState('apiUrl', '/api');
    await createComponent();

    expect(component['images']()[0].url).toBe(
      '/api/images/proxy?url=https%3A%2F%2Fimages.example%2Fposter.png&variant=background'
    );
  });

  it('recomputes images on resize', async () => {
    await createComponent();

    Object.assign(window.visualViewport as object, { height: 1200, width: 500 });
    Object.defineProperty(window, 'innerHeight', { value: 1200, writable: true });
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(500);

    expect(component['images']().length).toBeGreaterThan(0);
    expect(component['windowHeight']()).toBe(1200);
  });

  it('flags large height and width deltas for handling', async () => {
    await createComponent();
    component['lastViewportHeight'] = 800;
    component['lastViewportWidth'] = 500;

    expect(component['shouldHandleHeight'](950)).toBe(true);
    expect(component['shouldHandleWidth'](700)).toBe(true);
  });

  it('detects likely keyboard appearance from visual viewport shrink', async () => {
    await createComponent();
    Object.assign(window.visualViewport as object, { height: 650 });
    expect(component['isKeyboardLikely'](650)).toBe(true);
  });

  it('skips recompute when keyboard is likely open', async () => {
    await createComponent();
    setImagesSpy.mockClear();

    Object.assign(window.visualViewport as object, { height: 600, width: 500 });
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(component['windowHeight']()).toBe(600);
    expect(setImagesSpy).not.toHaveBeenCalled();
  });

  it('skips recompute when a text input is focused', async () => {
    await createComponent();
    setImagesSpy.mockClear();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    Object.assign(window.visualViewport as object, { height: 900, width: 520 });
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(setImagesSpy).not.toHaveBeenCalled();
    input.remove();
  });
});
