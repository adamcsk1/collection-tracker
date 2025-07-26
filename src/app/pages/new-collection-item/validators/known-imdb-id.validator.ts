import { inject } from '@angular/core';
import { AbstractControl, ValidatorFn } from '@angular/forms';
import { collectionStateToken } from '@stores/collection-store';

export const knownIMDbIdValidator = (): ValidatorFn => {
  const collectionState = inject(collectionStateToken);

  return (control: AbstractControl) => {
    const collection = collectionState.state.collection();

    return collection.find((collectionItem) => collectionItem.IMDbId === control.value) ? { knownIMDbId: true } : null;
  };
};
