export const getGenre = (content: string): string[] =>
  /\*\*Genre\*\*\n(.*)\n\*\*Actors\*\*/g.exec(content)?.[1]?.split(', ') || [];
