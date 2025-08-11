export const getIMDbId = (content: string) => /tt\d+/.exec(content)?.[0] || '';
