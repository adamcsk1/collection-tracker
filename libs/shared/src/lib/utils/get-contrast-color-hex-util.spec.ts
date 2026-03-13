import { describe, expect, it } from 'vitest';
import { getContrastColorHex } from './get-contrast-color-hex-util';

describe('getContrastColorHex', () => {
  it('returns null for transparent colors', () => {
    expect(getContrastColorHex('transparent')).toBeNull();
  });

  it('returns null for malformed hex strings', () => {
    expect(getContrastColorHex('#1234')).toBeNull();
    expect(getContrastColorHex('#12345')).toBeNull();
    expect(getContrastColorHex('#')).toBeNull();
  });

  it('expands short hex values before computing contrast', () => {
    expect(getContrastColorHex('#fff')).toBe('#000000');
  });

  it('chooses white text for dark backgrounds and black for bright backgrounds', () => {
    expect(getContrastColorHex('#000000')).toBe('#FFFFFF');
    expect(getContrastColorHex('#fefefe')).toBe('#000000');
  });
});
