import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';

export type MissingInternalTagValidationError = {
  kind: 'unusedInternalTag';
};

export const missingInternalTagValidation = (content: string | null): MissingInternalTagValidationError | undefined =>
  ![MOVIE_TAG, SERIES_TAG].some((internalTag) => `${content}`.includes(internalTag))
    ? { kind: 'unusedInternalTag' }
    : undefined;
