import { describe, expect, it } from 'vitest';
import { sanitizeMdContent } from './sanitize-md-content-util';

describe('sanitizeMdContent', () => {
  it('removes HTTP URLs', () => {
    expect(sanitizeMdContent('Visit https://example.com now')).toBe('Visit  now');
  });

  it('removes markdown image links', () => {
    expect(sanitizeMdContent('![alt text](https://example.com/img.png)')).toBe('');
  });

  it('removes markdown hyperlinks', () => {
    expect(sanitizeMdContent('[link text](https://example.com)')).toBe('');
  });

  it('removes fenced code blocks', () => {
    expect(sanitizeMdContent('```\nsome code\n```')).toBe('');
  });

  it('removes inline code', () => {
    expect(sanitizeMdContent('Use `console.log()` here')).toBe('Use  here');
  });

  it('removes heading markers', () => {
    expect(sanitizeMdContent('## Heading')).toBe('Heading');
  });

  it('removes horizontal rules', () => {
    expect(sanitizeMdContent('---')).toBe('');
  });

  it('removes unordered list markers', () => {
    expect(sanitizeMdContent('- item one')).toBe('item one');
  });

  it('removes ordered list markers', () => {
    expect(sanitizeMdContent('1. first item')).toBe('first item');
  });

  it('removes bold asterisks', () => {
    expect(sanitizeMdContent('**bold**')).toBe('bold');
  });

  it('collapses multiple blank lines into a single newline', () => {
    expect(sanitizeMdContent('line1\n\n\nline2')).toBe('line1\nline2');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeMdContent('  hello  ')).toBe('hello');
  });

  it('leaves plain text unchanged', () => {
    expect(sanitizeMdContent('plain text content')).toBe('plain text content');
  });
});
