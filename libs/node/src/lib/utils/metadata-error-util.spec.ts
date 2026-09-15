import { describe, expect, it } from 'vitest';
import { describeMetadataError } from './metadata-error-util';

describe('describeMetadataError', () => {
  it.each([
    'Invalid API key!',
    'Request limit reached!',
    'omdb responded with 503',
    'omdb replacement responded with 500',
    'omdb replacement returned an invalid rating',
    'Normalized external metadata response has invalid poster',
  ])('preserves known diagnostic: %s', (message) => {
    expect(describeMetadataError(new Error(message))).toBe(message);
  });

  it('categorizes timeout, network, and malformed JSON failures without leaking response text', () => {
    expect(describeMetadataError(new DOMException('secret', 'TimeoutError'))).toContain('timed out');
    expect(describeMetadataError(new TypeError('fetch failed'))).toContain('network');
    expect(
      describeMetadataError(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED', address: 'private' } }))
    ).toBe('Metadata network request failed (ECONNREFUSED)');
    expect(describeMetadataError(new TypeError('fetch failed', { cause: { code: 'secret' } }))).toBe(
      'Metadata network request failed'
    );
    expect(describeMetadataError(new SyntaxError('private response body'))).toContain('invalid JSON');
  });

  it.each([
    new Error('https://user:password@example.com/?apikey=secret'),
    new Error('Authorization: Bearer secret'),
    new Error('Invalid API key!\nsecret'),
    new Error('private response body'),
    'secret',
  ])('does not expose unknown error text: %s', (error) => {
    expect(describeMetadataError(error)).toMatch(/^(Unexpected|Unknown) metadata failure$/);
  });
});
