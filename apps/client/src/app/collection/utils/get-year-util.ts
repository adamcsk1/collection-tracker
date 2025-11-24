export const getYear = (content: string): number | null => {
  const match = /\*\*Year\*\*\n(.*)/g.exec(content)?.[1]?.trim();
  return match ? parseInt(match, 10) : null;
};
