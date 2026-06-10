const IMDbIdRegexp = /(?:^|[^A-Za-z0-9])(?<id>tt\d{7,})(?![A-Za-z0-9])/i;
const IMDbIdsRegexp = /(?:^|[^A-Za-z0-9])(?<id>tt\d{7,})(?![A-Za-z0-9])/gi;

export const getIMDbId = (content: string): string =>
  IMDbIdRegexp.exec(`${content}`)?.groups?.['id']?.toLowerCase() ?? '';

export const getIMDbIds = (content: string): string[] => [
  ...new Set([...`${content}`.matchAll(IMDbIdsRegexp)].map((match) => match.groups?.['id']?.toLowerCase() ?? '')),
];
