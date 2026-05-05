import { describe, expect, it } from 'vitest';
import { sanitizeFileName } from './sanitize-file-name-util';

describe('sanitizeFileName', () => {
  it('removes backslashes', () => {
    expect(sanitizeFileName('path\\to\\file')).toBe('pathtofile');
  });

  it('removes forward slashes', () => {
    expect(sanitizeFileName('path/to/file')).toBe('pathtofile');
  });

  it('removes both slash types', () => {
    expect(sanitizeFileName('a/b\\c')).toBe('abc');
  });

  it('returns the name unchanged when no slashes are present', () => {
    expect(sanitizeFileName('safe-name.txt')).toBe('safe-name.txt');
  });

  it('handles empty string', () => {
    expect(sanitizeFileName('')).toBe('');
  });

  it('handles string arrays by joining via toString', () => {
    expect(sanitizeFileName(['a', 'b'])).toBe('a,b');
  });
});
