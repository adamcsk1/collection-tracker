import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiService } from '@services/api/api-service';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import * as mobileUserAgentUtil from '@shared/utils/mobile-user-agent.util';
import * as coarsePointerUtil from '@shared/utils/prefer-coarse-pointer-util';
import * as randomIntUtil from '@shared/utils/random-int-util';
import { provideStore } from 'ngx-simple-signal-store';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Background } from './background';

vi.mock('@shared/utils/mobile-user-agent.util', () => ({
  mobileUserAgent: vi.fn(() => false),
}));

vi.mock('@shared/utils/prefer-coarse-pointer-util', () => ({
  getCoarsePointerBasedDebounceTime: vi.fn(() => 0),
}));

describe('Background component', () => {
  let fixture: ComponentFixture<Background>;
  let component: Background;
  let api: { getRandomImages: ReturnType<typeof vi.fn> };
  let randomSpy: ReturnType<typeof vi.spyOn>;
  let orientationTarget: EventTarget;
  let setImagesSpy: ReturnType<typeof vi.spyOn>;

  const createComponent = () => {
    fixture = TestBed.createComponent(Background);
    component = fixture.componentInstance;
    fixture.detectChanges();
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
      getRandomImages: vi.fn(() =>
        of({
          images: ['img-1', 'img-2'],
        })
      ),
    };

    setImagesSpy = vi.spyOn(Background.prototype as any, 'setImages');

    TestBed.configureTestingModule({
      imports: [Background],
      providers: [{ provide: ApiService, useValue: api }, provideStore(initialApiState, apiStateToken)],
    });
  });

  afterEach(() => {
    randomSpy.mockRestore();
    setImagesSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps images empty when the API returns no images', () => {
    api.getRandomImages.mockReturnValue(of({ images: [] }));
    createComponent();

    expect(component['images']()).toEqual([]);
  });

  it('generates background images when API returns images', () => {
    createComponent();

    const images = component['images']();
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((img: any) => ['img-1', 'img-2'].includes(img.url))).toBe(true);
  });

  it('proxies external background image URLs', () => {
    api.getRandomImages.mockReturnValue(
      of({
        images: ['https://images.example/poster.png'],
      })
    );
    TestBed.inject(apiStateToken).setState('apiUrl', '/api');
    createComponent();

    expect(component['images']()[0].url).toBe('/api/proxy/image?url=https%3A%2F%2Fimages.example%2Fposter.png');
  });

  it('recomputes images on resize', () => {
    createComponent();

    Object.assign(window.visualViewport as any, { height: 1200, width: 500 });
    Object.defineProperty(window, 'innerHeight', { value: 1200, writable: true });
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(500);

    expect(component['images']().length).toBeGreaterThan(0);
    expect(component['windowHeight']()).toBe(1200);
  });

  it('flags large height and width deltas for handling', () => {
    createComponent();
    component['lastViewportHeight'] = 800;
    component['lastViewportWidth'] = 500;

    expect((component as any).shouldHandleHeight(950)).toBe(true);
    expect((component as any).shouldHandleWidth(700)).toBe(true);
  });

  it('detects likely keyboard appearance from visual viewport shrink', () => {
    Object.assign(window.visualViewport as any, { height: 650 });
    expect((component as any).isKeyboardLikely(650)).toBe(true);
  });

  it('skips recompute when keyboard is likely open', () => {
    createComponent();
    setImagesSpy.mockClear();

    Object.assign(window.visualViewport as any, { height: 600, width: 500 });
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(component['windowHeight']()).toBe(600);
    expect(setImagesSpy).not.toHaveBeenCalled();
  });

  it('skips recompute when a text input is focused', () => {
    createComponent();
    setImagesSpy.mockClear();

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    Object.assign(window.visualViewport as any, { height: 900, width: 520 });
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(setImagesSpy).not.toHaveBeenCalled();
    input.remove();
  });
});
