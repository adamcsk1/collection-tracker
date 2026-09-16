import { afterEach, vi } from 'vitest';
import { randomInt } from './random-int-util';

describe('randomInt', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns integer values at both inclusive boundaries', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.999999).mockReturnValueOnce(0.5);

    expect(randomInt(3, 5)).toBe(3);
    expect(randomInt(3, 5)).toBe(5);
    expect(Number.isInteger(randomInt(3, 5))).toBe(true);
  });
});
