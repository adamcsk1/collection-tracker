import { MOVIE_TAG, SERIES_TAG } from '@shared/constants/tags-const';

export type InternalTagValidationError = {
  kind: 'unusedInternalTag';
};

export const internalTagValidation = (content: string | null): InternalTagValidationError | undefined =>
  ![MOVIE_TAG, SERIES_TAG].some((internalTag) => `${content}`.includes(internalTag))
    ? { kind: 'unusedInternalTag' }
    : undefined;
