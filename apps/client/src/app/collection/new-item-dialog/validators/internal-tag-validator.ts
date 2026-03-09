import { INTERNAL_USED_TAGS, VIRTUAL_TAGS } from '@shared/constants/tags-const';

export type InternalTagValidationError = {
  kind: 'usedInternalTag';
};

export const internalTagValidation = (tags: string | null): InternalTagValidationError | undefined =>
  [...VIRTUAL_TAGS, ...INTERNAL_USED_TAGS].some((internalTag) => `${tags}`.includes(internalTag))
    ? { kind: 'usedInternalTag' }
    : undefined;
