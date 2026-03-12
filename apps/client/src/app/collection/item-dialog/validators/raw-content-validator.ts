import { getCollectionItem } from '@client/collection/utils/get-collection-item-util';

export type RawContentValidationError = {
  kind: 'badRawContent';
};

export const rawContentValidation = (content: string | null): RawContentValidationError | undefined => {
  const parsedItem = getCollectionItem({ name: 'TestName', content: content || '' });
  return Object.values(parsedItem).some((value) => value === '' || (Array.isArray(value) && value.length === 0))
    ? { kind: 'badRawContent' }
    : undefined;
};
