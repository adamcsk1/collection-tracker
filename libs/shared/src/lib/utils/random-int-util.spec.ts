import { randomInt } from './random-int-util';

describe('randomInt', () => {
  it('returns values within the inclusive range', () => {
    const min = 3;
    const max = 5;

    for (let i = 0; i < 50; i++) {
      const value = randomInt(min, max);
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(max);
    }
  });
});
