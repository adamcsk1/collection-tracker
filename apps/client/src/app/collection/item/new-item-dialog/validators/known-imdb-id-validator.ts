import { Signal } from '@angular/core';

export type KnownIMDbIdValidationError = {
  kind: 'knownIMDbId';
};

export const knownIMDbIdValidationFactory = (knownIMDbIdExists: Signal<boolean>) => {
  return (IMDbId: string | null): KnownIMDbIdValidationError | undefined => {
    return IMDbId && knownIMDbIdExists() ? { kind: 'knownIMDbId' } : undefined;
  };
};
