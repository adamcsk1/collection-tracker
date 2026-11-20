import { extractIsbn13, normalizeIsbn13 } from './isbn-util';
import { extractMbid, normalizeMbid } from './mbid-util';

export const normalizeWorkId = (value: string): string | null => {
  const id = value
    .trim()
    .replace(/^\/works\//i, '')
    .toUpperCase();
  return /^OL\d+W$/.test(id) ? id : null;
};

export const normalizeBookId = (value: string): string | null => normalizeWorkId(value) ?? normalizeIsbn13(value);

export const normalizeMusicId = (value: string): string | null => {
  const id = value.trim().toLowerCase();
  if (!id.startsWith('release-group:')) return normalizeMbid(id);
  const mbid = normalizeMbid(id.slice('release-group:'.length));
  return mbid ? `release-group:${mbid}` : null;
};

export const extractBookId = (value: string): string | null => {
  const work = value.trim().match(/^https?:\/\/openlibrary\.org\/works\/(OL\d+W)(?:[/?#]|$)/i)?.[1];
  return normalizeBookId(value) ?? (work ? normalizeWorkId(work) : extractIsbn13(value));
};

export const extractMusicId = (value: string): string | null => {
  const group = value.trim().match(/^https?:\/\/musicbrainz\.org\/release-group\/([^/?#]+)(?:[/?#]|$)/i)?.[1];
  if (group) return normalizeMusicId(`release-group:${group}`);
  if (value.trim().toLowerCase().startsWith('release-group:')) return normalizeMusicId(value);
  return normalizeMusicId(value) ?? extractMbid(value);
};
