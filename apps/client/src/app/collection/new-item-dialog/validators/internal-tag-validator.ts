import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';

export type ForbiddenInternalTagValidationError = {
  kind: 'usedInternalTag';
};

export const forbiddenInternalTagValidation = (tags: string | null): ForbiddenInternalTagValidationError | undefined =>
  [...VIRTUAL_TAGS, ...INTERNAL_USED_TAGS].some((internalTag) => `${tags}`.includes(internalTag))
    ? { kind: 'usedInternalTag' }
    : undefined;
