import { describe, expect, it } from 'vitest';
import { extractBarcode, extractMbid, normalizeMbid } from './mbid-util';

describe('normalizeMbid', () => {
  it('normalizes UUID MBIDs to lowercase', () => {
    expect(normalizeMbid('F509C5FF-AD54-4DDE-B61E-24F750965835')).toBe('f509c5ff-ad54-4dde-b61e-24f750965835');
    expect(normalizeMbid('  f509c5ff-ad54-4dde-b61e-24f750965835  ')).toBe('f509c5ff-ad54-4dde-b61e-24f750965835');
  });

  it.each(['', 'not-a-uuid', 'f509c5ffad544ddeb61e24f750965835', 'f509c5ff-ad54-4dde-b61e-24f75096583'])(
    'rejects invalid MBID %s',
    (value) => {
      expect(normalizeMbid(value)).toBeNull();
    }
  );
});

describe('extractMbid', () => {
  it.each([
    ['f509c5ff-ad54-4dde-b61e-24f750965835', 'f509c5ff-ad54-4dde-b61e-24f750965835'],
    ['https://musicbrainz.org/release/f509c5ff-ad54-4dde-b61e-24f750965835', 'f509c5ff-ad54-4dde-b61e-24f750965835'],
    ['see release F509C5FF-AD54-4DDE-B61E-24F750965835 in catalog', 'f509c5ff-ad54-4dde-b61e-24f750965835'],
  ])('extracts MBID from %s', (value, expected) => {
    expect(extractMbid(value)).toBe(expected);
  });

  it.each(['', 'https://musicbrainz.org/artist/abc', 'Dark Side of the Moon'])(
    'returns null when no valid MBID in %s',
    (value) => {
      expect(extractMbid(value)).toBeNull();
    }
  );
});

describe('extractBarcode', () => {
  it.each([
    ['724383848429', '724383848429'],
    ['7 24383 84842 9', '724383848429'],
    ['72438384842', '72438384842'],
  ])('extracts barcode from %s', (value, expected) => {
    expect(extractBarcode(value)).toBe(expected);
  });

  it.each(['', 'Dark Side', '123', '72438384842912345', 'abc12345678'])(
    'returns null when no barcode in %s',
    (value) => {
      expect(extractBarcode(value)).toBeNull();
    }
  );
});
