import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { CollectionItemModel } from '@client/collection/collection-model';
import { initialMainCollectionState, mainCollectionStateToken } from '@client/main/main-collection-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { knownIMDbIdValidator } from './known-imdb-id-validator';

const buildItem = (IMDbId: string): CollectionItemModel => ({
  rawContent: '',
  image: '',
  title: '',
  genre: [],
  IMDbId,
  tags: [],
  name: '',
  year: null,
  rate: '',
});

describe('knownIMDbIdValidator', () => {
  let collectionState: NgxSimpleSignalStoreService<typeof initialMainCollectionState>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideStore(initialMainCollectionState, mainCollectionStateToken)] });
    collectionState = TestBed.inject(mainCollectionStateToken) as NgxSimpleSignalStoreService<
      typeof initialMainCollectionState
    >;
    collectionState.setState('collection', [buildItem('tt1')]);
  });

  it('returns error when IMDb id is already known', () => {
    TestBed.runInInjectionContext(() => {
      const validator = knownIMDbIdValidator();
      const control = new FormControl('tt1');

      expect(validator(control)).toEqual({ knownIMDbId: true });
    });
  });

  it('returns null when IMDb id is new', () => {
    TestBed.runInInjectionContext(() => {
      const validator = knownIMDbIdValidator();
      const control = new FormControl('tt2');

      expect(validator(control)).toBeNull();
    });
  });
});
