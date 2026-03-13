export const SEARCH_MODES = ['standard', 'fuzzy'] as const;

export type SearchModeModel = (typeof SEARCH_MODES)[number];
