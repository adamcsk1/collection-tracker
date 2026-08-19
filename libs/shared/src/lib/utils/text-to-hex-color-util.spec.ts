import { textToContrastColor, textToHexColor } from './text-to-hex-color-util';

describe('textToHexColor', () => {
  it('generates a deterministic HSL color for a string', () => {
    expect(textToHexColor('abc')).toBe('hsl(234, 50%, 50%)');
    expect(textToHexColor('abc', 60, 40)).toBe('hsl(234, 60%, 40%)');
  });

  it('chooses a deterministic WCAG contrast-safe foreground for generated backgrounds', () => {
    expect(textToContrastColor('abc')).toBe('#FFFFFF');
    expect(textToContrastColor('bright', 50, 90)).toBe('#000000');
    expect(textToContrastColor('dark', 50, 10)).toBe('#FFFFFF');
  });
});
