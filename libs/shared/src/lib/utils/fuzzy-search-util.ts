import { FuzzySearchResultModel } from '@shared/utils/fuzzy-search-model';

const levenshtein = (a: string, b: string): number => {
  const aLength = a.length;
  const bLength = b.length;

  const previousRow = new Int16Array(aLength + 1);
  const currentRow = new Int16Array(aLength + 1);

  for (let i = 0; i <= aLength; i++) previousRow[i] = i;

  for (let j = 1; j <= bLength; j++) {
    currentRow[0] = j;
    const bChar = b.charCodeAt(j - 1);

    for (let i = 1; i <= aLength; i++) {
      const cost = a.charCodeAt(i - 1) === bChar ? 0 : 1;
      currentRow[i] = Math.min(previousRow[i] + 1, currentRow[i - 1] + 1, previousRow[i - 1] + cost);
    }

    previousRow.set(currentRow);
  }

  return previousRow[aLength];
};

export const FUZZY_CONTENT_MAX_LENGTH = 250;

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

export const hasFuzzyMatch = (pattern: string, text: string, maxDistance = 2): boolean => {
  const patternLength = pattern.length;
  const textLength = text.length;

  if (patternLength === 0) return true;
  if (patternLength > textLength) return false;
  if (maxDistance < 0) return false;
  const previousRow = new Int16Array(patternLength + 1);
  const currentRow = new Int16Array(patternLength + 1);
  const maxWindowStart = textLength - patternLength;

  for (let windowStart = 0; windowStart <= maxWindowStart; windowStart++) {
    const distance = levenshteinWithLimit(pattern, text, windowStart, previousRow, currentRow);

    if (distance <= maxDistance) return true;
  }

  return false;
};

const levenshteinWithLimit = (
  pattern: string,
  text: string,
  textOffset: number,
  previousRow: Int16Array,
  currentRow: Int16Array,
): number => {
  const patternLength = pattern.length;
  let previous = previousRow;
  let current = currentRow;

  for (let i = 0; i <= patternLength; i++) previous[i] = i;

  for (let j = 1; j <= patternLength; j++) {
    current[0] = j;
    const textChar = text.charCodeAt(textOffset + j - 1);

    for (let i = 1; i <= patternLength; i++) {
      const cost = pattern.charCodeAt(i - 1) === textChar ? 0 : 1;
      const distance = Math.min(previous[i] + 1, current[i - 1] + 1, previous[i - 1] + cost);
      current[i] = distance;
    }

    const temporaryRow = previous;
    previous = current;
    current = temporaryRow;
  }

  return previous[patternLength];
};

export const affordableFuzzySearch = (pattern: string): boolean => pattern.length <= 20 && pattern.length >= 3;
