export const getTitle = (content: string) => /#{3} (.*)/g.exec(content)?.[1] || '';
