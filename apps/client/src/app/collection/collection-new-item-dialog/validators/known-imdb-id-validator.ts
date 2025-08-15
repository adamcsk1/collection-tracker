import { inject } from '@angular/core';
import { AbstractControl, ValidatorFn } from '@angular/forms';
import { mainCollectionStateToken } from '@client/main/main-collection-store';

export const knownIMDbIdValidator = (): ValidatorFn => {
  const mainCollectionState = inject(mainCollectionStateToken);

  return (control: AbstractControl) => {
    const collection = mainCollectionState.state.collection();

    return collection.find((collectionItem) => collectionItem.IMDbId === control.value) ? { knownIMDbId: true } : null;
  };
};
