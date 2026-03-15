export type FilenamePatternValidationError = {
  kind: 'filenamePattern';
};

export const filenamePatternValidationError = (pattern: string): FilenamePatternValidationError | undefined => {
  if (!pattern.toLowerCase().endsWith('.md')) return { kind: 'filenamePattern' };
  return undefined;
};
