const IMDbIdRegexp = /(?:^|[^A-Za-z0-9])(?<id>tt\d{7,})(?![A-Za-z0-9])/i;
const IMDbIdsRegexp = /(?:^|[^A-Za-z0-9])(?<id>tt\d{7,})(?![A-Za-z0-9])/gi;

export const getIMDbId = (content: string): string =>
  IMDbIdRegexp.exec(`${content}`)?.groups?.['id']?.toLowerCase() ?? '';

export const getIMDbIds = (content: string): string[] => [
  ...new Set([...`${content}`.matchAll(IMDbIdsRegexp)].map((match) => match.groups?.['id']?.toLowerCase() ?? '')),
];

export const resolveImdbId = (content: string): string => {
  const extracted = getIMDbId(content);
  if (extracted) return extracted;
  const trimmed = `${content}`.trim();
  return /^tt\d+$/i.test(trimmed) ? trimmed.toLowerCase() : '';
};
