import { buildCollectionItemFilename } from '@services/parser/utils/filename-pattern-util';
import { describe, expect, it, vi } from 'vitest';

vi.mock('dayjs', () => ({
  default: () => ({
    toISOString: () => '2026-03-15T07:00:00.000Z',
  }),
}));

describe('filename-pattern-util', () => {
  const buildSelectedContent = () => ({
    Title: 'The Matrix',
    Type: 'movie',
    Year: '1999',
    imdbID: 'tt0133093',
    imdbRating: '8.7',
    Plot: 'Neo learns the truth.',
    Poster: 'https://example.com/poster.jpg',
    Director: 'Lana Wachowski & Lilly Wachowski',
    Genre: 'Action, Sci-Fi',
    Actors: 'Keanu Reeves, Carrie-Anne Moss',
  });

  it('builds a filename from dynamic moustache placeholders', () => {
    expect(
      buildCollectionItemFilename({
        pattern: '{{Year}}-{{Type}}-{{imdbID}}-{{ClearedName}}.md',
        selectedContent: buildSelectedContent(),
      }),
    ).toBe('1999-movie-tt0133093-The-Matrix.md');
  });

  it('normalizes special characters for every replaced value', () => {
    expect(
      buildCollectionItemFilename({
        pattern: '{{Director}}-{{ClearedName}}.md',
        selectedContent: {
          Title: 'Amelie: Le Fabuleux Destin!',
          Type: 'movie',
          Year: '2001',
          imdbID: 'tt0211915',
          imdbRating: '8.3',
          Plot: 'Plot',
          Poster: 'https://example.com/poster.jpg',
          Director: 'Jean-Pierre Jeunet',
          Genre: 'Comedy, Romance',
          Actors: 'Audrey Tautou',
        },
      }),
    ).toBe('Jean-Pierre-Jeunet-Amelie-Le-Fabuleux-Destin.md');
  });

  it('keeps unresolved placeholders unchanged for server-side handling', () => {
    expect(
      buildCollectionItemFilename({
        pattern: '{{Year}}-{{ClearedName}}-{{index}}.md',
        selectedContent: buildSelectedContent(),
      }),
    ).toBe('1999-The-Matrix-{{index}}.md');
  });
});
