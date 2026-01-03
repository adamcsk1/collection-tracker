import { FuzzySearchResultModel } from '@shared/utils/fuzzy-search-model';

const levenshtein = (a: string, b: string): number => {
  const aLength = a.length;
  const bLength = b.length;

  const distances: Array<Array<number>> = Array.from({ length: aLength + 1 }, () => new Array(bLength + 1));

  for (let i = 0; i <= aLength; i++) distances[i][0] = i;
  for (let j = 0; j <= bLength; j++) distances[0][j] = j;

  for (let i = 1; i <= aLength; i++) {
    for (let j = 1; j <= bLength; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      distances[i][j] = Math.min(distances[i - 1][j] + 1, distances[i][j - 1] + 1, distances[i - 1][j - 1] + cost);
    }
  }

  return distances[aLength][bLength];
};

export const fuzzySearch = (pattern: string, text: string, maxDistance = 2): FuzzySearchResultModel => {
  const results = [];
  const patternLength = pattern.length;
  const textLength = text.length;

  for (let index = 0; index <= textLength - patternLength; index++) {
    const window = text.slice(index, index + patternLength);
    const distance = levenshtein(pattern, window);

    if (distance <= maxDistance) {
      results.push({
        match: window,
        index,
        distance,
      });
    }
  }

  return results.length ? results : null;
};

export const affordableFuzzySearch = (pattern: string): boolean => pattern.length <= 20 && pattern.length >= 3;
