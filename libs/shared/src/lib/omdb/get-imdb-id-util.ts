const IMDbIdRegexp = /(?<id>tt\d+)/;

export const getIMDbId = (content: string): string => IMDbIdRegexp.exec(`${content}`)?.groups?.['id'] ?? '';
