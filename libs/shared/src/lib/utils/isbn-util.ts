const stripIsbnFormatting = (value: string): string | null => {
  const withoutPrefix = value.trim().replace(/^ISBN(?:-1[03])?:?\s*/i, '');
  if (!/^[\dXx\s-]+$/.test(withoutPrefix)) return null;
  return withoutPrefix.replace(/[\s-]/g, '').toUpperCase();
};

const isValidIsbn10 = (isbn: string): boolean => {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const sum = [...isbn].reduce(
    (total, character, index) => total + (character === 'X' ? 10 : Number(character)) * (10 - index),
    0
  );
  return sum % 11 === 0;
};

const isValidIsbn13 = (isbn: string): boolean => {
  if (!/^\d{13}$/.test(isbn)) return false;
  const sum = [...isbn.slice(0, 12)].reduce(
    (total, character, index) => total + Number(character) * (index % 2 === 0 ? 1 : 3),
    0
  );
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
};

const convertIsbn10To13 = (isbn10: string): string => {
  const body = `978${isbn10.slice(0, 9)}`;
  const sum = [...body].reduce((total, character, index) => total + Number(character) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
};

export const normalizeIsbn13 = (value: string): string | null => {
  const isbn = stripIsbnFormatting(value);
  if (!isbn) return null;
  if (isbn.length === 10 && isValidIsbn10(isbn)) return convertIsbn10To13(isbn);
  return isbn.length === 13 && isValidIsbn13(isbn) ? isbn : null;
};

const ISBN_CANDIDATE_REGEXP =
  /(?<![\dA-Za-z])(?:ISBN(?:-1[03])?:?\s*)?((?:\d[-\s]*){12}\d|(?:\d[-\s]*){9}[\dXx])(?![\dA-Za-z])/gi;

export const extractIsbn13 = (content: string): string | null => {
  const direct = normalizeIsbn13(content);
  if (direct) return direct;

  for (const match of `${content}`.matchAll(ISBN_CANDIDATE_REGEXP)) {
    const normalized = normalizeIsbn13(match[1] ?? '');
    if (normalized) return normalized;
  }
  return null;
};
