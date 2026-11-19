import { CollectionItemContentTypeModel } from '../models/collection-item-model';
import { getIMDbId } from './imdb-id-util';
import { normalizeIsbn13 } from './isbn-util';
import { extractBarcode, normalizeMbid } from './mbid-util';

export const normalizePhotoImportIdentifier = (
  value: unknown,
  contentType: CollectionItemContentTypeModel
): string | null => {
  if (typeof value !== 'string' || value.length > 300) return null;
  if (contentType === 'movie' || contentType === 'series') return getIMDbId(value) || null;
  if (contentType === 'book') {
    const isbn = normalizeIsbn13(value);
    return isbn?.startsWith('978') || isbn?.startsWith('979') ? isbn : null;
  }
  const mbid = normalizeMbid(value);
  if (mbid) return mbid;
  const barcode = extractBarcode(value);
  if (!barcode || ![8, 12, 13, 14].includes(barcode.length) || /^0+$/.test(barcode)) return null;
  const sum = [...barcode]
    .reverse()
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return sum % 10 === 0 ? barcode : null;
};
