import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { knownIMDbIdValidationFactory } from './known-imdb-id-validator';

describe('knownIMDbIdValidator', () => {
  it('returns error when IMDb id is already known', () => {
    const knownIMDbIdValidationError = knownIMDbIdValidationFactory(signal(true));

    expect(knownIMDbIdValidationError('tt1')).toEqual({ kind: 'knownIMDbId' });
  });

  it('returns undefined when IMDb id is new', () => {
    const knownIMDbIdValidationError = knownIMDbIdValidationFactory(signal(false));

    expect(knownIMDbIdValidationError('tt2')).toBeUndefined();
  });

  it('returns undefined when IMDb id is empty', () => {
    const knownIMDbIdValidationError = knownIMDbIdValidationFactory(signal(true));

    expect(knownIMDbIdValidationError(null)).toBeUndefined();
  });
});
