export type AiSearchResult =
  { status: 'idle' } | { status: 'pending' } | { status: 'success'; matchedIds: string[] } | { status: 'error' };
