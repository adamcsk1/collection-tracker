import { describe, expect, it } from 'vitest';
import { validateEnvironment } from './environment-util';

describe('environment-util', () => {
  it.each(['JWT_SECRET', 'COOKIE_SECRET'] as const)('rejects a missing or blank %s', (variableName) => {
    const environment = { JWT_SECRET: 'jwt', COOKIE_SECRET: 'cookie', SALT: 'salt', [variableName]: ' ' };

    expect(() => validateEnvironment(environment)).toThrow(variableName);
  });

  it('rejects a missing salt', () => {
    expect(() => validateEnvironment({ JWT_SECRET: 'jwt', COOKIE_SECRET: 'cookie' })).toThrow('SALT');
  });

  it('accepts an explicitly empty legacy salt', () => {
    expect(() => validateEnvironment({ JWT_SECRET: 'jwt', COOKIE_SECRET: 'cookie', SALT: '' })).not.toThrow();
  });
});
