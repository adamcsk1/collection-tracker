import { LANGUAGES } from '@shared/models/language-model';
import { THEMES } from '@shared/models/theme-model';
import { parseAllowedValue } from './parse-allowed-value-util';

describe('parseAllowedValue', () => {
  it('returns a typed value when it is in the allowed list', () => {
    expect(parseAllowedValue('dark', THEMES)).toBe('dark');
  });

  it('returns null when value is null or not allowed', () => {
    expect(parseAllowedValue(null, LANGUAGES)).toBeNull();
    expect(parseAllowedValue('es', LANGUAGES)).toBeNull();
  });
});
