import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import * as randomIntUtil from '@shared/utils/random-int-util';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { Background } from './background';

describe('Background component', () => {
  let fixture: ComponentFixture<Background>;
  let component: Background;
  let collectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;

  const buildItem = (overrides: Partial<CollectionItemModel>): CollectionItemModel => ({
    rawContent: '',
    image: overrides.image || '',
    title: overrides.title || '',
    genre: [],
    IMDbId: '',
    tags: [],
    name: overrides.name || '',
    year: null,
    rate: '',
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(randomIntUtil, 'randomInt').mockImplementation((min) => min);
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 500, writable: true });

    TestBed.configureTestingModule({
      imports: [Background],
      providers: [provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    fixture = TestBed.createComponent(Background);
    component = fixture.componentInstance;
    collectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
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

    Object.defineProperty(window, 'innerHeight', { value: 1200, writable: true });
    window.dispatchEvent(new Event('resize'));
    jest.advanceTimersByTime(500);

    expect(component['images']().length).toBeGreaterThan(0);
    expect(component['windowHeight']).toBe(1200);
  });
});
