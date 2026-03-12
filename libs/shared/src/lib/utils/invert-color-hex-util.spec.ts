import { describe, expect, it } from 'vitest';
import { invertColorHex } from './invert-color-hex-util';

describe('invertColorHex', () => {
  it('returns null for transparent colors', () => {
    expect(invertColorHex('transparent')).toBeNull();
  });

  it('returns null for malformed hex strings', () => {
    expect(invertColorHex('#1234')).toBeNull();
    expect(invertColorHex('#12345')).toBeNull();
    expect(invertColorHex('#')).toBeNull();
  });

  it('expands short hex values before computing contrast', () => {
    expect(invertColorHex('#fff')).toBe('#000000');
  });

  it('chooses white text for dark backgrounds and black for bright backgrounds', () => {
    expect(invertColorHex('#000000')).toBe('#FFFFFF');
    expect(invertColorHex('#fefefe')).toBe('#000000');
  });
});
