export const getTags = (content: string) => /\*\*Tags\*\*\n(.*)/g.exec(content)?.[1]?.split(' ') || '';
