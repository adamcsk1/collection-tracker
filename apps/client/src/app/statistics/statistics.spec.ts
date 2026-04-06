import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '@client/main/main-collection-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { STORAGE_STATISTICS_SELECTED_TAGS } from '@shared/constants/storage-const';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Statistics } from './statistics';

const buildItem = (overrides: Partial<CollectionItemModel>): CollectionItemModel => ({
  rawContent: overrides.rawContent || '',
  rawContentLower: (overrides.rawContent || '').toLowerCase(),
  image: overrides.image || '',
  title: overrides.title || '',
  titleLower: (overrides.title || '').toLowerCase(),
  genre: overrides.genre || [],
  IMDbId: overrides.IMDbId || '',
  tags: overrides.tags || [],
  name: overrides.name || '',
  year: overrides.year || null,
  rate: overrides.rate || '',
  hash: '',
});

describe('Statistics component', () => {
  let component: Statistics;
  let collectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let webstorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    webstorage = { getItem: vi.fn(() => null), setItem: vi.fn() };

    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
      ],
    });

    TestBed.overrideComponent(Statistics, { set: { template: '' } });

    component = TestBed.createComponent(Statistics).componentInstance;
    collectionState = TestBed.inject(mainCollectionStateToken);

    // Set a mock chart so that onToggleTag → updateChartData() does not throw.
    component['chart'].set({ data: { labels: [], datasets: [] }, update: vi.fn() } as any);
  });

  it('computes movie and series summary from collection tags', () => {
    collectionState.setState('collection', [
      buildItem({ tags: ['#movie', '#action'], name: 'Movie One' }),
      buildItem({ tags: ['#series', '#drama'], name: 'Series One' }),
    ]);

    expect(component['summary']()).toEqual({
      movies: 1,
      series: 1,
      all: 2,
    });
  });

  it('computes deduplicated tags sorted by length ascending', () => {
    collectionState.setState('collection', [
      buildItem({ tags: ['#drama', '#action'] }),
      buildItem({ tags: ['#action', '#sci-fi'] }),
    ]);

    const tags = component['tags']();
    // #drama = 6 chars, #action and #sci-fi = 7 chars each; duplicates removed
    expect(tags).toEqual(['#drama', '#action', '#sci-fi']);
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('sets defaultOpenSelectedTags to true when no tags are stored', () => {
    webstorage.getItem = vi.fn(() => null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
      ],
    });
    TestBed.overrideComponent(Statistics, { set: { template: '' } });

    const freshComponent = TestBed.createComponent(Statistics).componentInstance;

    expect(freshComponent['defaultOpenSelectedTags']).toBe(true);
  });

  it('sets defaultOpenSelectedTags to false when tags are stored', () => {
    webstorage.getItem = vi.fn((key: string) => (key === STORAGE_STATISTICS_SELECTED_TAGS ? '["#action"]' : null));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: webstorage },
      ],
    });
    TestBed.overrideComponent(Statistics, { set: { template: '' } });

    const freshComponent = TestBed.createComponent(Statistics).componentInstance;

    expect(freshComponent['defaultOpenSelectedTags']).toBe(false);
  });

  it('adds a tag to selectedTags when toggling an unselected tag', () => {
    component['onToggleTag']('#action');

    expect(component['selectedTags']()).toContain('#action');
  });

  it('removes a tag from selectedTags when toggling an already selected tag', () => {
    component['onToggleTag']('#action');
    component['onToggleTag']('#action');

    expect(component['selectedTags']()).not.toContain('#action');
  });

  it('persists selected tags to webstorage when toggling', () => {
    component['onToggleTag']('#action');

    expect(webstorage.setItem).toHaveBeenCalledWith(STORAGE_STATISTICS_SELECTED_TAGS, JSON.stringify(['#action']));
  });
});
