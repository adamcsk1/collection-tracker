import { CollectionListTypeModel } from '@shared/models/api-model';
import { AiSearchCollectionItem } from '../database/repositories/collection';

export type AiSearchStatusIntent = 'unfinished' | 'completed' | 'favorite';

const normalizeSearchText = (value: unknown): string =>
  `${value ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const UNFINISHED_PATTERNS = [
  /\bunfinished\b/,
  /\bincomplete\b/,
  /\bin progress\b/,
  /\bstill watching\b/,
  /\bstill reading\b/,
  /\bcurrently reading\b/,
  /\bnot (?:yet )?(?:finished|completed|done|read)\b/,
  /\buncompleted\b/,
  /\bongoing\b/,
  /\bpartial(?:ly)? (?:watched|read)\b/,
  /\bhalfway\b/,
  /\bbarely started\b/,
];

const COMPLETED_PATTERNS = [
  /\bcompleted\b/,
  /\bfinished\b/,
  /\bdone watching\b/,
  /\bdone reading\b/,
  /\bfully watched\b/,
  /\bfully read\b/,
  /\bwatched all\b/,
  /\ball episodes watched\b/,
  /\balready read\b/,
  /\bread books?\b/,
];

const FAVORITE_PATTERNS = [/\bfavo(?:u)?rites?\b/, /\bstarred\b/];

const STATUS_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'me',
  'i',
  'of',
  'in',
  'on',
  'for',
  'to',
  'and',
  'or',
  'with',
  'from',
  'list',
  'lists',
  'tracker',
  'trackers',
  'collection',
  'show',
  'shows',
  'series',
  'movie',
  'movies',
  'book',
  'books',
  'reading',
  'read',
  'tv',
  'item',
  'items',
  'please',
  'find',
  'show',
  'give',
  'get',
  'which',
  'what',
  'are',
  'is',
  'that',
  'those',
  'these',
  'all',
  'any',
  'only',
  'just',
  'unfinished',
  'incomplete',
  'progress',
  'still',
  'tracking',
  'currently',
  'not',
  'yet',
  'finished',
  'completed',
  'done',
  'uncompleted',
  'ongoing',
  'partial',
  'partially',
  'halfway',
  'barely',
  'started',
  'fully',
  'already',
  'episodes',
  'episode',
  'pages',
  'page',
  'favorite',
  'favorites',
  'favourite',
  'favourites',
  'starred',
]);

export const detectAiSearchStatusIntent = (prompt: string): AiSearchStatusIntent | null => {
  const normalizedPrompt = normalizeSearchText(prompt);
  if (!normalizedPrompt) return null;

  if (UNFINISHED_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) return 'unfinished';
  if (COMPLETED_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) return 'completed';
  if (FAVORITE_PATTERNS.some((pattern) => pattern.test(normalizedPrompt))) return 'favorite';
  return null;
};

/** Status pre-filter only when the active list has meaningful status fields. */
export const getEffectiveStatusIntent = (
  intent: AiSearchStatusIntent | null,
  listType: CollectionListTypeModel
): AiSearchStatusIntent | null => {
  if (!intent) return null;
  if (intent === 'favorite') return 'favorite';
  if (intent === 'unfinished') return listType === 'tracking' ? 'unfinished' : null;
  if (listType === 'tracking' || listType === 'finished') return 'completed';
  return null;
};

export const isPureStatusIntent = (prompt: string, intent: AiSearchStatusIntent | null): boolean => {
  if (!intent) return false;

  const remainingTokens = normalizeSearchText(prompt)
    .split(' ')
    .filter((token) => token && !STATUS_STOP_WORDS.has(token));

  return remainingTokens.length === 0;
};

export const applyStatusIntentFilter = (
  items: AiSearchCollectionItem[],
  intent: AiSearchStatusIntent | null
): AiSearchCollectionItem[] => {
  if (!intent) return items;

  if (intent === 'favorite') {
    return items.filter((item) => item.favorite);
  }

  if (intent === 'unfinished') {
    return items.filter((item) => item.watchStatus === 'unfinished' || item.completed === false);
  }

  return items.filter(
    (item) => item.watchStatus === 'completed' || item.completed === true || item.watchStatus === 'watched'
  );
};

export const getAiSearchCandidateId = (item: AiSearchCollectionItem): string =>
  item.IMDbId || (item.externalItemId ? `${item.externalProvider}:${item.externalItemId}` : '');

export const getStatusIntentMatchedIds = (items: AiSearchCollectionItem[]): string[] =>
  items.map(getAiSearchCandidateId).filter((candidateId): candidateId is string => !!candidateId);
