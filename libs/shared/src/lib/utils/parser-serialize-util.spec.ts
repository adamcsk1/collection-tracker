import { describe, expect, it } from 'vitest';
import { restoreSerializedParserRegexp, serializeParserRegexp } from './parser-serialize-util';

describe('serializeParserRegexp', () => {
  it('serializes a regexp with no flags', () => {
    expect(serializeParserRegexp(/hello/)).toBe('/hello/');
  });

  it('serializes a regexp with flags', () => {
    expect(serializeParserRegexp(/hello/gi)).toBe('/hello/gi');
  });

  it('serializes a regexp with a complex pattern', () => {
    expect(serializeParserRegexp(/\d{4}-\d{2}/)).toBe('/\\d{4}-\\d{2}/');
  });
});

describe('restoreSerializedParserRegexp', () => {
  it('restores a serialized regexp with no flags', () => {
    const result = restoreSerializedParserRegexp('/hello/');
    expect(result.source).toBe('hello');
    expect(result.flags).toBe('');
  });

  it('restores a serialized regexp with flags', () => {
    const result = restoreSerializedParserRegexp('/hello/gi');
    expect(result.source).toBe('hello');
    expect(result.flags).toBe('gi');
  });

  it('treats a plain string as a regexp pattern when not in serialized format', () => {
    const result = restoreSerializedParserRegexp('hello');
    expect(result).toEqual(new RegExp('hello'));
  });
});

describe('serializeParserRegexp and restoreSerializedParserRegexp roundtrip', () => {
  it('preserves source and flags through serialize and restore', () => {
    const original = /\d{4}-\d{2}/gim;
    const serialized = serializeParserRegexp(original);
    const restored = restoreSerializedParserRegexp(serialized);
    expect(restored.source).toBe(original.source);
    expect(restored.flags).toBe(original.flags);
  });
});
