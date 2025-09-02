export const getTags = (content: string): string[] =>
  /\*\*Tags\*\*\n(.*)/g
    .exec(content)?.[1]
    ?.split(' ')
    ?.map((tag) => tag.trim())
    ?.filter((tag) => !!tag) || [];
