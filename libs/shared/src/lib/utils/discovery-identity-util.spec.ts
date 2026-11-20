import { describe, expect, it } from 'vitest';
import {
  extractBookId,
  extractMusicId,
  normalizeBookId,
  normalizeMusicId,
  normalizeWorkId,
} from './discovery-identity-util';

const mbid = 'f509c5ff-ad54-4dde-b61e-24f750965835';

describe('discovery identities', () => {
  it('normalizes works and legacy ISBNs without inventing ISBN aliases', () => {
    expect(normalizeWorkId('/works/ol123w')).toBe('OL123W');
    expect(normalizeBookId('OL123W')).toBe('OL123W');
    expect(normalizeBookId('0-306-40615-2')).toBe('9780306406157');
    expect(normalizeBookId('OL123M')).toBeNull();
    expect(normalizeBookId('../OL123W')).toBeNull();
    expect(extractBookId('https://openlibrary.org/works/OL123W/Title')).toBe('OL123W');
    expect(extractBookId('  https://openlibrary.org/works/OL123W/Title  ')).toBe('OL123W');
  });

  it('keeps release and release-group namespaces distinct', () => {
    expect(normalizeMusicId(mbid.toUpperCase())).toBe(mbid);
    expect(normalizeMusicId(`RELEASE-GROUP:${mbid.toUpperCase()}`)).toBe(`release-group:${mbid}`);
    expect(extractMusicId(`https://musicbrainz.org/release-group/${mbid}`)).toBe(`release-group:${mbid}`);
    expect(extractMusicId(`  https://musicbrainz.org/release-group/${mbid}  `)).toBe(`release-group:${mbid}`);
    expect(extractMusicId(`https://musicbrainz.org/release/${mbid}`)).toBe(mbid);
    expect(normalizeMusicId('release-group:invalid')).toBeNull();
    expect(extractMusicId(`release-group:${mbid}/invalid`)).toBeNull();
  });
});
