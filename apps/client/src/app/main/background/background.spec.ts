import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '@client/main/main-collection-store';
import * as mobileUserAgentUtil from '@shared/utils/mobile-user-agent.util';
import * as coarsePointerUtil from '@shared/utils/prefer-coarse-pointer-util';
import * as randomIntUtil from '@shared/utils/random-int-util';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
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
  let collectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let randomSpy: ReturnType<typeof vi.spyOn>;
  let orientationTarget: EventTarget;
  let setImagesSpy: ReturnType<typeof vi.spyOn>;

  const buildItem = (overrides: Partial<CollectionItemModel>): CollectionItemModel => ({
    rawContent: '',
    rawContentLower: ''.toLowerCase(),
    image: overrides.image || '',
    title: overrides.title || '',
    titleLower: (overrides.title || '').toLowerCase(),
    genre: [],
    IMDbId: '',
    tags: [],
    name: overrides.name || '',
    year: null,
    rate: '',
  });

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

    setImagesSpy = vi.spyOn(Background.prototype as any, 'setImages');

    TestBed.configureTestingModule({
      imports: [Background],
      providers: [provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    fixture = TestBed.createComponent(Background);
    component = fixture.componentInstance;
    collectionState = TestBed.inject(mainCollectionStateToken);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    setImagesSpy.mockRestore();
    vi.useRealTimers();
  });

  it('keeps images empty when there is no collection', () => {
    collectionState.setState('collection', []);

    fixture.detectChanges();

    expect(component['images']()).toEqual([]);
  });

  it('generates background images when collection exists', () => {
    collectionState.setState('collection', [
      buildItem({ name: 'one', image: 'img-1' }),
      buildItem({ name: 'two', image: 'img-2' }),
    ]);

    fixture.detectChanges();

    const images = component['images']();
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((img: any) => ['img-1', 'img-2'].includes(img.url))).toBe(true);
  });

  it('recomputes images on resize', () => {
    collectionState.setState('collection', [buildItem({ name: 'one', image: 'img-1' })]);
    fixture.detectChanges();

    Object.assign(window.visualViewport as any, { height: 1200, width: 500 });
    Object.defineProperty(window, 'innerHeight', { value: 1200, writable: true });
    window.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(500);

    expect(component['images']().length).toBeGreaterThan(0);
    expect(component['windowHeight']).toBe(1200);
  });

  it('flags large height and width deltas for handling', () => {
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
    collectionState.setState('collection', [buildItem({ name: 'one', image: 'img-1' })]);
    fixture.detectChanges();
    setImagesSpy.mockClear();

    Object.assign(window.visualViewport as any, { height: 600, width: 500 });
    window.dispatchEvent(new Event('resize'));
    vi.runAllTimers();

    expect(component['windowHeight']).toBe(600);
    expect(setImagesSpy).not.toHaveBeenCalled();
  });

  it('skips recompute when a text input is focused', () => {
    collectionState.setState('collection', [buildItem({ name: 'one', image: 'img-1' })]);
    fixture.detectChanges();
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
