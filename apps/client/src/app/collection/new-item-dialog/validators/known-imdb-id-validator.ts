import { inject } from '@angular/core';
import { mainCollectionStateToken } from '../../../main/main-collection-store';

export type KnownIMDbIdValidationError = {
  kind: 'knownIMDbId';
};

export const knownIMDbIdValidationFactory = () => {
  const mainCollectionState = inject(mainCollectionStateToken);

  return (IMDbId: string | null): KnownIMDbIdValidationError | undefined => {
    const collection = mainCollectionState.state.collection();

    return collection.find((collectionItem) => collectionItem.IMDbId === IMDbId) ? { kind: 'knownIMDbId' } : undefined;
  };
};
