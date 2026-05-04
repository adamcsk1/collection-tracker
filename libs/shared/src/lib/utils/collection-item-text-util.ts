export const parseGenreText = (value: string): string[] =>
  value
    .split(',')
    .map((genre) => genre.trim())
    .filter(Boolean);

export const parseTagText = (value: string): string[] =>
  value
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
