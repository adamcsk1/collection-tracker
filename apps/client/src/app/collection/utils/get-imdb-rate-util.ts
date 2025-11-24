export const getIMDbRate = (content: string): string =>
  /\[IMDb \(tt\d+\)\]\([^)]*\) \(\*\*(\d+(?:\.\d+)?)\*\* \/ \d+(?:\.\d+)?\)/g.exec(content)?.[1] || '';
