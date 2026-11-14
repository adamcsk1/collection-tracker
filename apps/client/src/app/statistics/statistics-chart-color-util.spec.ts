import { describe, expect, it } from 'vitest';
import { STATISTICS_CHART_COLORS } from './statistics-chart-color-const';
import { statisticsChartColor } from './statistics-chart-color-util';

const luminance = (channels: number[]): number =>
  channels
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);

const hexLuminance = (hex: string): number =>
  luminance([1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255));

const hslLuminance = (color: string): number => {
  const [hue, saturation, lightness] = color.match(/-?\d+/g)!.map(Number);
  const normalizedHue = ((hue % 360) + 360) % 360;
  const lightnessFraction = lightness / 100;
  const amplitude = (saturation / 100) * Math.min(lightnessFraction, 1 - lightnessFraction);
  return luminance(
    [0, 8, 4].map((offset) => {
      const section = (offset + normalizedHue / 30) % 12;
      return lightnessFraction - amplitude * Math.max(-1, Math.min(section - 3, 9 - section, 1));
    })
  );
};

describe('statisticsChartColor', () => {
  it.each([false, true])('keeps every hue above 3:1 against the card with darkTheme=%s', (darkTheme) => {
    const card = STATISTICS_CHART_COLORS[darkTheme ? 'dark' : 'light'];
    const backgroundLuminance = hexLuminance(card.background);
    for (let hue = 0; hue < 360; hue++) {
      const color = statisticsChartColor(String.fromCharCode(hue), darkTheme);
      expect(color).toBe(`hsl(${hue}, 50%, ${darkTheme ? 70 : 30}%)`);
      const fillLuminance = hslLuminance(color);
      const contrast =
        (Math.max(fillLuminance, backgroundLuminance) + 0.05) / (Math.min(fillLuminance, backgroundLuminance) + 0.05);
      expect(contrast, `${color} against ${card.background}`).toBeGreaterThanOrEqual(3);
    }
    const textLuminance = hexLuminance(card.text);
    expect(
      (Math.max(textLuminance, backgroundLuminance) + 0.05) / (Math.min(textLuminance, backgroundLuminance) + 0.05)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps hashed label hues stable across themes', () => {
    expect(statisticsChartColor('Drama', false)).toBe('hsl(95, 50%, 30%)');
    expect(statisticsChartColor('Drama', true)).toBe('hsl(95, 50%, 70%)');
  });
});
