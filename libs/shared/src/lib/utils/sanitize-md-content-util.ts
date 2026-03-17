const MARKDOWN_CLEANUP_REGEXP =
  /https?:\/\/\S+|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|```[\s\S]*?```|`[^`]*`|^#{1,6}\s+|^[-*_]{3,}\s*$|^[-*+]\s+|^\d+\.\s+|[*_~`>|]/gm;

export const sanitizeMdContent = (content: string): string =>
  content
    .replace(MARKDOWN_CLEANUP_REGEXP, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
