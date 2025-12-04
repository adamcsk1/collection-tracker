import { textToHexColor } from './text-to-hex-color-util';

describe('textToHexColor', () => {
  it('generates a deterministic HSL color for a string', () => {
    expect(textToHexColor('abc')).toBe('hsl(234, 50%, 50%)');
    expect(textToHexColor('abc', 60, 40)).toBe('hsl(234, 60%, 40%)');
  });
});
