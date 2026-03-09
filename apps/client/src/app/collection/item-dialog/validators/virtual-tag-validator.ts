import { VIRTUAL_TAGS } from '@shared/constants/tags-const';

export type VirtualTagValidationError = {
  kind: 'usedVirtualTag';
};

export const virtualTagValidation = (content: string | null): VirtualTagValidationError | undefined =>
  VIRTUAL_TAGS.some((virtualTag) => `${content}`.includes(virtualTag)) ? { kind: 'usedVirtualTag' } : undefined;
