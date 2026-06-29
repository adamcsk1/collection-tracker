import { Signal } from '@angular/core';
import { KnownIMDbIdValidationError } from './known-imdb-id-validator-model';

export const knownIMDbIdValidationFactory = (knownIMDbIdExists: Signal<boolean>) => {
  return (IMDbId: string | null): KnownIMDbIdValidationError | undefined => {
    return IMDbId && knownIMDbIdExists() ? { kind: 'knownIMDbId' } : undefined;
  };
};
