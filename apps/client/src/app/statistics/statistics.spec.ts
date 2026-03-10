import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '@client/collection/collection-model';
import { mainCollectionStateToken, initialMainCollectionState } from '@client/main/main-collection-store';
import { apiStateToken, initialApiState } from '@services/api/api-store';
import { WebstorageService } from '@services/webstorage/webstorage-service';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { NgxSignalTranslateService } from 'ngx-signal-translate';
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
});

describe('Statistics component', () => {
  let component: Statistics;
  let collectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Statistics],
      providers: [
        provideStore(initialMainCollectionState, mainCollectionStateToken),
        provideStore(initialApiState, apiStateToken),
        { provide: NgxSignalTranslateService, useValue: { translate: (value: string) => value } },
        { provide: WebstorageService, useValue: { getItem: vi.fn(() => null), setItem: vi.fn() } },
      ],
    });

    component = TestBed.createComponent(Statistics).componentInstance;
    collectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
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
});
