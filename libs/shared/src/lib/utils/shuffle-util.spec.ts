import { afterEach, describe, expect, it, vi } from 'vitest';
import * as randomIntUtil from './random-int-util';
import { shuffle } from './shuffle-util';

describe('shuffle', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a copy of a single-item list', () => {
    const items = ['only'];

    expect(shuffle(items)).toEqual(['only']);
    expect(shuffle(items)).not.toBe(items);
  });

  it('swaps using randomInt indexes', () => {
    vi.spyOn(randomIntUtil, 'randomInt').mockReturnValue(0);

    expect(shuffle(['a', 'b', 'c'])).toEqual(['b', 'c', 'a']);
  });
});
