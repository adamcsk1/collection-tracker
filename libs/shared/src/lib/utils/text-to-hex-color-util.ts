type Rgb = readonly [number, number, number];
type ContrastColor = '#000000' | '#FFFFFF';

const textToHue = (text: string): number => {
  let hash = 0;
  for (let index = 0; index < text.length; index++) {
    hash = text.charCodeAt(index) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return hash % 360;
};

const hueSectionToRgb = (hueSection: number, chroma: number, secondary: number): Rgb => {
  const hueRgbBySection: ReadonlyArray<Rgb> = [
    [chroma, secondary, 0],
    [secondary, chroma, 0],
    [0, chroma, secondary],
    [0, secondary, chroma],
    [secondary, 0, chroma],
    [chroma, 0, secondary],
  ];
  return hueRgbBySection[Math.min(Math.floor(hueSection), hueRgbBySection.length - 1)];
};

const hslToSrgb = (hue: number, saturation: number, lightness: number): Rgb => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const lightnessMatch = lightness - chroma / 2;
  const [red, green, blue] = hueSectionToRgb(hueSection, chroma, secondary);
  return [red + lightnessMatch, green + lightnessMatch, blue + lightnessMatch];
};

const linearizeSrgbChannel = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const relativeLuminance = ([red, green, blue]: Rgb): number =>
  0.2126 * linearizeSrgbChannel(red) + 0.7152 * linearizeSrgbChannel(green) + 0.0722 * linearizeSrgbChannel(blue);

const contrastAgainstWhite = (luminance: number): number => 1.05 / (luminance + 0.05);

const contrastAgainstBlack = (luminance: number): number => (luminance + 0.05) / 0.05;

export const textToHexColor = (text: string, saturation = 50, lightness = 50): string =>
  `hsl(${textToHue(text)}, ${saturation}%, ${lightness}%)`;

export const textToContrastColor = (text: string, saturation = 50, lightness = 50): ContrastColor => {
  const hue = ((textToHue(text) % 360) + 360) % 360;
  const luminance = relativeLuminance(hslToSrgb(hue, saturation / 100, lightness / 100));
  return contrastAgainstBlack(luminance) >= contrastAgainstWhite(luminance) ? '#000000' : '#FFFFFF';
};
