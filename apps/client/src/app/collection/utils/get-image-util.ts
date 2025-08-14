export const getImage = (content: string) => /\[poster\|90]\((.*)\)/g.exec(content)?.[1] || '';
