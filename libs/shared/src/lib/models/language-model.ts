export const LANGUAGES = ['en'] as const;

export type LanguageModel = (typeof LANGUAGES)[number];
