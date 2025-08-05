export const getTags = (content: string): string[] => /\*\*Tags\*\*\n(.*)/g.exec(content)?.[1]?.split(' ') || [];
