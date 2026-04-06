// https://stackoverflow.com/a/35970186
export const getContrastColorHex = (hex: string): string | null => {
  if (hex === 'transparent') return null;

  let normalizedHex = hex.replace('#', '');

  // convert 3-digit hex to 6-digits.
  if (normalizedHex.length === 3) {
    normalizedHex =
      normalizedHex[0] + normalizedHex[0] + normalizedHex[1] + normalizedHex[1] + normalizedHex[2] + normalizedHex[2];
  }

  if (normalizedHex.length !== 6) return null;

  const r = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const g = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const b = Number.parseInt(normalizedHex.slice(4, 6), 16);

  // https://stackoverflow.com/a/3943023/112731
  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
};
