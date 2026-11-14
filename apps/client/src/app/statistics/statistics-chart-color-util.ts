import { textToHexColor } from '@shared/utils/text-to-hex-color-util';

// Fixed lightness keeps every hue above 3:1 against the corresponding statistics card.
export const statisticsChartColor = (text: string, darkTheme: boolean): string =>
  textToHexColor(text, 50, darkTheme ? 70 : 30);
