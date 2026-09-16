import { describe, expect, it } from 'vitest';
import { extractBarcode, extractMbid, normalizeMbid } from './mbid-util';

describe('normalizeMbid', () => {
  it('normalizes UUID MBIDs to lowercase', () => {
    expect(normalizeMbid('F509C5FF-AD54-4DDE-B61E-24F750965835')).toBe('f509c5ff-ad54-4dde-b61e-24f750965835');
    expect(normalizeMbid('  f509c5ff-ad54-4dde-b61e-24f750965835  ')).toBe('f509c5ff-ad54-4dde-b61e-24f750965835');
  });

  it('rejects an invalid MBID', () => {
    expect(normalizeMbid('not-a-uuid')).toBeNull();
  });
});

describe('extractMbid', () => {
  it.each([
    ['f509c5ff-ad54-4dde-b61e-24f750965835', 'f509c5ff-ad54-4dde-b61e-24f750965835'],
    ['https://musicbrainz.org/release/f509c5ff-ad54-4dde-b61e-24f750965835', 'f509c5ff-ad54-4dde-b61e-24f750965835'],
    ['see release F509C5FF-AD54-4DDE-B61E-24F750965835 in catalog', 'f509c5ff-ad54-4dde-b61e-24f750965835'],
  ])('extracts MBID from %s', (value, expected) => {
    expect(extractMbid(value)).toBe(expected);
  });

  it('returns null when no valid MBID is present', () => {
    expect(extractMbid('Dark Side of the Moon')).toBeNull();
  });
});

describe('extractBarcode', () => {
  it.each([
    ['724383848429', '724383848429'],
    ['7 24383 84842 9', '724383848429'],
    ['72438384842', '72438384842'],
  ])('extracts barcode from %s', (value, expected) => {
    expect(extractBarcode(value)).toBe(expected);
  });

  it('returns null when no barcode is present', () => {
    expect(extractBarcode('Dark Side')).toBeNull();
  });
});
