import { TestBed } from '@angular/core/testing';
import { NgxSimpleSignalStoreService, provideStore } from 'ngx-simple-signal-store';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  initialMainCollectionState,
  MainCollectionState,
  mainCollectionStateToken,
} from '../main/main-collection-store';
import { CollectionItemApiModel } from '@shared/models/api-model';
import { CollectionModel } from './collection-model';
import { CollectionService } from './collection-service';

describe('CollectionService', () => {
  let service: CollectionService;
  let mainCollectionState: NgxSimpleSignalStoreService<MainCollectionState>;

  const buildCollectionItem = (title: string, ownerShareCode = 'own-code'): CollectionItemApiModel => ({
    image: '',
    title,
    titleLower: title.toLowerCase(),
    genre: [],
    IMDbId: `tt-${title}`,
    externalProvider: 'omdb',
    externalItemId: `tt-${title}`,
    tags: [],
    year: null,
    rate: '',
    rottenTomatoesRate: '',
    metacriticRate: '',
    userRate: null,
    hash: '',
    actors: '',
    plot: '',
    listType: 'library',
    contentType: 'movie',
    favorite: false,
    watchedAt: null,
    ownerShareCode,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CollectionService, provideStore(initialMainCollectionState, mainCollectionStateToken)],
    });

    service = TestBed.inject(CollectionService);
    mainCollectionState = TestBed.inject(mainCollectionStateToken);
  });

  it('increments reload trigger', () => {
    const initial = mainCollectionState.state.reloadTrigger();

    service.triggerReload();

    expect(mainCollectionState.state.reloadTrigger()).toBe(initial + 1);
  });

  it('adds a collection item to the front when first flag is true', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem(buildCollectionItem('new'), true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('new'),
      buildCollectionItem('existing'),
    ]);
  });

  it('adds a collection item to the end when first flag is false', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('existing')]);

    service.addCollectionItem(buildCollectionItem('another'));

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('existing'),
      buildCollectionItem('another'),
    ]);
  });

  it('replaces an existing item with the same owner, list type, and provider identity', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('keep'), buildCollectionItem('target')]);

    service.addCollectionItem({ ...buildCollectionItem('updated'), externalItemId: 'tt-target' }, true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('keep'),
      { ...buildCollectionItem('updated'), externalItemId: 'tt-target' },
    ]);
  });

  it('adds an item without an owner share code', () => {
    const item = { ...buildCollectionItem('ownerless'), ownerShareCode: undefined };

    service.addCollectionItem(item);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([item]);
  });

  it('adds an item with the same provider identity but a different list type', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('same')]);

    service.addCollectionItem({ ...buildCollectionItem('same'), listType: 'up-next' }, true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      { ...buildCollectionItem('same'), listType: 'up-next' },
      buildCollectionItem('same'),
    ]);
  });

  it('adds an item with the same provider identity but a different owner', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('same', 'owner-one')]);

    service.addCollectionItem(buildCollectionItem('same', 'owner-two'), true);

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('same', 'owner-two'),
      buildCollectionItem('same', 'owner-one'),
    ]);
  });

  it('deletes a collection item by name', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('keep'), buildCollectionItem('remove')]);

    service.deleteCollectionItem(buildCollectionItem('remove'));

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('keep')]);
  });

  it('deletes only the matching shared-library item when provider identities overlap', () => {
    mainCollectionState.setState('collection', [
      buildCollectionItem('same', 'own-code'),
      buildCollectionItem('same', 'owner-code'),
    ]);

    service.deleteCollectionItem(buildCollectionItem('same'), 'owner-code');

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('same', 'own-code')]);
  });

  it('deletes only the matching list item when provider identities overlap', () => {
    mainCollectionState.setState('collection', [
      buildCollectionItem('same'),
      { ...buildCollectionItem('same'), listType: 'up-next' },
    ]);

    service.deleteCollectionItem(buildCollectionItem('same'), undefined, 'up-next');

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('same')]);
  });

  it('updates an existing collection item by name', () => {
    mainCollectionState.setState('collection', [buildCollectionItem('target')]);

    service.updateCollectionItem(buildCollectionItem('target'), buildCollectionItem('updated'));

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([buildCollectionItem('updated')]);
  });

  it('leaves the collection unchanged when the item to update does not exist', () => {
    const collection = [buildCollectionItem('existing')];
    mainCollectionState.setState('collection', collection);

    service.updateCollectionItem(buildCollectionItem('missing'), buildCollectionItem('updated'));

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>(collection);
  });

  it('updates only the matching shared-library item when provider identities overlap', () => {
    mainCollectionState.setState('collection', [
      buildCollectionItem('target', 'own-code'),
      buildCollectionItem('target', 'owner-code'),
    ]);

    service.updateCollectionItem(
      buildCollectionItem('target'),
      buildCollectionItem('updated', 'owner-code'),
      'owner-code'
    );

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('target', 'own-code'),
      buildCollectionItem('updated', 'owner-code'),
    ]);
  });

  it('updates only the matching list item when provider identities overlap', () => {
    mainCollectionState.setState('collection', [
      buildCollectionItem('target'),
      { ...buildCollectionItem('target'), listType: 'up-next' },
    ]);

    service.updateCollectionItem(
      { ...buildCollectionItem('target'), listType: 'up-next' },
      {
        ...buildCollectionItem('updated'),
        externalItemId: 'tt-target',
        listType: 'up-next',
      }
    );

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('target'),
      { ...buildCollectionItem('updated'), externalItemId: 'tt-target', listType: 'up-next' },
    ]);
  });

  it('replaces the old keyed item with the backend-returned item when legacy IMDb ID changes', () => {
    mainCollectionState.setState('collection', [
      buildCollectionItem('target'),
      { ...buildCollectionItem('target'), listType: 'tracking' },
    ]);

    service.updateCollectionItem(
      { ...buildCollectionItem('target'), listType: 'tracking' },
      { ...buildCollectionItem('updated'), IMDbId: 'tt-updated', listType: 'tracking' },
      undefined,
      'tracking'
    );

    expect(mainCollectionState.state.collection()).toEqual<CollectionModel>([
      buildCollectionItem('target'),
      { ...buildCollectionItem('updated'), IMDbId: 'tt-updated', listType: 'tracking' },
    ]);
  });
});
