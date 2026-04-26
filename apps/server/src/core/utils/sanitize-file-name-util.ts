export const sanitizeFileName = (name: string | string[]): string => name.toString().replace(/\\|\//g, '');
