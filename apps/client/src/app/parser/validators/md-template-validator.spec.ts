import { describe, expect, it } from 'vitest';
import { mdTemplateValidationError } from './md-template-validator';

const REQUIRED_KEYS = [
  '{{Title}}',
  '{{imdbID}}',
  '{{imdbRating}}',
  '{{Plot}}',
  '{{Poster}}',
  '{{Year}}',
  '{{Director}}',
  '{{Genre}}',
  '{{Actors}}',
  '{{YoutubeQuery}}',
  '{{WebQuery}}',
  '{{Type}}',
  '{{Tags}}',
];

const VALID_TEMPLATE = REQUIRED_KEYS.join(' ');

describe('mdTemplateValidationError', () => {
  it('returns undefined for a template that contains all required keys', () => {
    expect(mdTemplateValidationError(VALID_TEMPLATE)).toBeUndefined();
  });

  it('returns an error with the single missing key', () => {
    const template = REQUIRED_KEYS.filter((key) => key !== '{{Title}}').join(' ');
    const result = mdTemplateValidationError(template);
    expect(result).toEqual({ kind: 'invalidMdTemplate', missingKeys: '{{Title}}' });
  });

  it('lists all required keys when the template is empty', () => {
    const result = mdTemplateValidationError('');
    expect(result?.kind).toBe('invalidMdTemplate');
    expect(result?.missingKeys).toBe(REQUIRED_KEYS.join(', '));
  });

  it('reports exactly which keys are missing and does not report present keys', () => {
    const template = '{{Title}} {{imdbID}}';
    const result = mdTemplateValidationError(template);
    const missing = result?.missingKeys.split(', ') ?? [];
    for (const key of REQUIRED_KEYS) {
      if (key === '{{Title}}' || key === '{{imdbID}}') {
        expect(missing).not.toContain(key);
      } else {
        expect(missing).toContain(key);
      }
    }
  });
});
