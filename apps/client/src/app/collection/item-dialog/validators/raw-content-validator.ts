import { getCollectionItem } from '@shared/utils/get-collection-item-util';

export type RawContentValidationError = {
  kind: 'badRawContent';
};

export const rawContentValidation = (content: string | null): RawContentValidationError | undefined => {
  const parsedItem = getCollectionItem({ name: 'TestName', content: content || '', hash: 'TestHash' });

  const { rawContent, image, title, IMDbId, name, rate, genre, tags } = parsedItem;
  const hasEmptyString = [rawContent, image, title, IMDbId, name, rate].some((value) => value === '');
  const hasEmptyArray = [genre, tags].some((value) => value.length === 0);

  return hasEmptyString || hasEmptyArray ? { kind: 'badRawContent' } : undefined;
};
