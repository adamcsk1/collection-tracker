import { describe, expect, it } from 'vitest';
import { affordableFuzzySearch, fuzzySearch } from './fuzzy-search-util';

describe('fuzzy-search-util', () => {
  it('returns matches within max distance', () => {
    const result = fuzzySearch('spc', 'space drama');

    expect(result).not.toBeNull();
    expect(result?.some(({ match }) => match === 'spa' || match === 'pac')).toBe(true);
    expect(result?.every(({ distance }) => distance <= 2)).toBe(true);
  });

  it('returns null when no window is close enough', () => {
    const result = fuzzySearch('alpha', 'zzzzzz', 1);

    expect(result).toBeNull();
  });

  it('checks affordability based on length bounds', () => {
    expect(affordableFuzzySearch('abc')).toBe(true);
    expect(affordableFuzzySearch('ab')).toBe(false);
    expect(affordableFuzzySearch('a'.repeat(21))).toBe(false);
  });
});
