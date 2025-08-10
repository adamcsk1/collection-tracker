import { inject } from '@angular/core';
import { AbstractControl, ValidatorFn } from '@angular/forms';
import { appCollectionStateToken } from '@appCollectionStore';

export const knownIMDbIdValidator = (): ValidatorFn => {
  const appCollectionState = inject(appCollectionStateToken);

  return (control: AbstractControl) => {
    const collection = appCollectionState.state.collection();

    return collection.find((collectionItem) => collectionItem.IMDbId === control.value) ? { knownIMDbId: true } : null;
  };
};
