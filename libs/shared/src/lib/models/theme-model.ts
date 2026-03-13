export const THEMES = ['system', 'dark', 'light'] as const;

export type ThemeModel = (typeof THEMES)[number];
