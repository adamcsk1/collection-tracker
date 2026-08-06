import { describe, expect, it } from 'vitest';
import { AiSearchCollectionItem } from '../database/repositories/collection';
import {
  applyStatusIntentFilter,
  detectAiSearchStatusIntent,
  getEffectiveStatusIntent,
  getStatusIntentMatchedIds,
  isPureStatusIntent,
} from './ai-search-intent-util';

const buildItem = (
  overrides: Partial<AiSearchCollectionItem> & Pick<AiSearchCollectionItem, 'IMDbId' | 'watchStatus' | 'completed'>
): AiSearchCollectionItem =>
  ({
    itemId: 1,
    title: 'Title',
    titleLower: 'title',
    genre: [],
    tags: [],
    year: null,
    rate: '',
    rottenTomatoesRate: '',
    metacriticRate: '',
    userRate: null,
    hash: 'hash',
    actors: '',
    plot: '',
    listType: 'tracking',
    contentType: 'series',
    favorite: false,
    watchedAt: null,
    externalProvider: 'imdb',
    externalItemId: overrides.IMDbId ?? 'tt1',
    aiSearchContentHash: 'hash',
    aiSearchText: 'text',
    completedEpisodes: null,
    totalEpisodes: null,
    progressPercent: null,
    ...overrides,
  }) as AiSearchCollectionItem;

describe('ai-search-intent-util', () => {
  it('detects unfinished status intents', () => {
    expect(detectAiSearchStatusIntent('unfinished series')).toBe('unfinished');
    expect(detectAiSearchStatusIntent('still watching shows')).toBe('unfinished');
    expect(detectAiSearchStatusIntent('not completed yet')).toBe('unfinished');
  });

  it('detects completed and favorite intents', () => {
    expect(detectAiSearchStatusIntent('completed series')).toBe('completed');
    expect(detectAiSearchStatusIntent('my favorites')).toBe('favorite');
  });

  it('gates unfinished and completed intents by list type', () => {
    expect(getEffectiveStatusIntent('unfinished', 'tracking')).toBe('unfinished');
    expect(getEffectiveStatusIntent('unfinished', 'library')).toBeNull();
    expect(getEffectiveStatusIntent('unfinished', 'watchlist')).toBeNull();
    expect(getEffectiveStatusIntent('completed', 'tracking')).toBe('completed');
    expect(getEffectiveStatusIntent('completed', 'tracking')).toBe('completed');
    expect(getEffectiveStatusIntent('completed', 'library')).toBeNull();
    expect(getEffectiveStatusIntent('favorite', 'library')).toBe('favorite');
  });

  it('detects pure status intents without extra filters', () => {
    expect(isPureStatusIntent('unfinished series', 'unfinished')).toBe(true);
    expect(isPureStatusIntent('completed', 'completed')).toBe(true);
    expect(isPureStatusIntent('unfinished sci-fi series', 'unfinished')).toBe(false);
  });

  it('filters unfinished and completed items by watch status', () => {
    const items = [
      buildItem({ IMDbId: 'tt1', watchStatus: 'unfinished', completed: false }),
      buildItem({ IMDbId: 'tt2', watchStatus: 'completed', completed: true, watchedAt: '2024-01-01' }),
      buildItem({
        IMDbId: 'tt3',
        watchStatus: 'completed',
        completed: true,
        listType: 'tracking',
        contentType: 'movie',
      }),
    ];

    expect(applyStatusIntentFilter(items, 'unfinished').map((item) => item.IMDbId)).toEqual(['tt1']);
    expect(applyStatusIntentFilter(items, 'completed').map((item) => item.IMDbId)).toEqual(['tt2', 'tt3']);
  });

  it('filters favorite items', () => {
    const items = [
      buildItem({ IMDbId: 'tt1', watchStatus: 'unfinished', completed: false, favorite: true }),
      buildItem({ IMDbId: 'tt2', watchStatus: 'unfinished', completed: false, favorite: false }),
    ];

    expect(applyStatusIntentFilter(items, 'favorite').map((item) => item.IMDbId)).toEqual(['tt1']);
  });

  it('maps filtered items to candidate ids', () => {
    const items = [
      buildItem({ IMDbId: 'tt9', watchStatus: 'unfinished', completed: false }),
      buildItem({
        IMDbId: undefined,
        externalProvider: 'openlibrary',
        externalItemId: '9780140328721',
        watchStatus: 'not-applicable',
        completed: null,
        listType: 'books',
        contentType: 'book',
      }),
    ];
    expect(getStatusIntentMatchedIds(items)).toEqual(['tt9', 'openlibrary:9780140328721']);
  });
});
