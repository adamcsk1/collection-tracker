import { TestBed } from '@angular/core/testing';
import { CollectionItemModel } from '../../collection-model';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '../../../main/main-collection-store';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import { knownIMDbIdValidationFactory } from './known-imdb-id-validator';

const buildItem = (IMDbId: string): CollectionItemModel => ({
  rawContent: '',
  rawContentLower: '',
  image: '',
  title: '',
  titleLower: '',
  genre: [],
  IMDbId,
  tags: [],
  name: '',
  year: null,
  rate: '',
  hash: '',
  plot: '',
});

describe('knownIMDbIdValidator', () => {
  let collectionState: NgxSimpleSignalStoreService<MainCollectionState>;
  let knownIMDbIdValidationError: (IMDbId: string | null) => { kind: 'knownIMDbId' } | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideStore(initialMainCollectionState, mainCollectionStateToken)] });
    collectionState = TestBed.inject(mainCollectionStateToken);
    collectionState.setState('collection', [buildItem('tt1')]);
    knownIMDbIdValidationError = TestBed.runInInjectionContext(() => knownIMDbIdValidationFactory());
  });

  it('returns error when IMDb id is already known', () => {
    expect(knownIMDbIdValidationError('tt1')).toEqual({ kind: 'knownIMDbId' });
  });

  it('returns undefined when IMDb id is new', () => {
    expect(knownIMDbIdValidationError('tt2')).toBeUndefined();
  });
});
