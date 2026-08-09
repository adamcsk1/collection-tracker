import {
  isExternalItemIdentitySourceName,
  isExternalMetadataProviderName,
} from '@shared/utils/external-metadata-provider-util';
import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { hashText } from '../crypto';
import { normalizeIsbn13 } from './isbn-util';

const normalizeYear = (year: number | string | null): string | null => {
  if (typeof year === 'number') return Number.isInteger(year) ? `${year}` : `${year}`.replace(/^(\d{4})\.0$/, '$1');
  return year?.trim().replace(/^(\d{4})\.0$/, '$1') || null;
};

export const normalizeItem = (item: CollectionItemChangeApiModel): CollectionItemChangeApiModel | undefined => {
  const userRate = item?.userRate;
  const year = item?.year;
  const progressCurrent = item?.progressCurrent;
  const progressTotal = item?.progressTotal;
  const rawTags = Array.isArray(item?.tags) ? item.tags.map((tag) => `${tag}`.trim()).filter(Boolean) : [];
  const contentType = item?.contentType;
  const favorite = item?.favorite;
  if (
    typeof item?.title !== 'string' ||
    typeof item?.image !== 'string' ||
    (typeof item?.IMDbId !== 'string' && item?.IMDbId !== undefined) ||
    typeof item?.externalProvider !== 'string' ||
    typeof item?.externalItemId !== 'string' ||
    (item?.externalIds !== undefined &&
      (!Array.isArray(item.externalIds) ||
        item.externalIds.some(
          (externalId) => typeof externalId?.source !== 'string' || typeof externalId?.id !== 'string'
        ))) ||
    typeof item?.rate !== 'string' ||
    typeof item?.rottenTomatoesRate !== 'string' ||
    typeof item?.metacriticRate !== 'string' ||
    typeof item?.actors !== 'string' ||
    typeof item?.plot !== 'string' ||
    (contentType !== 'movie' && contentType !== 'series' && contentType !== 'book') ||
    typeof favorite !== 'boolean' ||
    !Array.isArray(item?.genre) ||
    !Array.isArray(item?.tags) ||
    (typeof year !== 'number' && typeof year !== 'string' && year !== null) ||
    (typeof userRate !== 'number' && userRate !== null) ||
    (typeof userRate === 'number' &&
      (!Number.isFinite(userRate) ||
        userRate < 0 ||
        userRate > 10 ||
        Math.abs(userRate * 10 - Math.round(userRate * 10)) > 1e-9)) ||
    (progressCurrent !== undefined &&
      progressCurrent !== null &&
      (!Number.isInteger(progressCurrent) || progressCurrent < 0)) ||
    (progressTotal !== undefined &&
      progressTotal !== null &&
      (!Number.isInteger(progressTotal) || progressTotal < 1)) ||
    (typeof progressCurrent === 'number' && typeof progressTotal === 'number' && progressCurrent > progressTotal)
  ) {
    return;
  }

  const externalProvider = item.externalProvider.trim().toLowerCase();
  if (!isExternalMetadataProviderName(externalProvider)) return;
  if (contentType === 'book' && externalProvider !== 'openlibrary') return;
  if (contentType !== 'book' && externalProvider === 'openlibrary') return;
  const externalIds = [
    ...(item.externalIds ?? []).flatMap((externalId) => {
      const source = externalId.source.trim().toLowerCase();
      const id = source === 'isbn' ? (normalizeIsbn13(externalId.id) ?? '') : externalId.id.trim();
      return source && id && isExternalItemIdentitySourceName(source) ? [{ source, id }] : [];
    }),
  ];
  const imdbId = contentType === 'book' ? undefined : item.IMDbId?.trim() || undefined;
  if (imdbId && !externalIds.some((externalId) => externalId.source === 'imdb' && externalId.id === imdbId)) {
    externalIds.push({ source: 'imdb', id: imdbId });
  }

  const externalItemId =
    externalProvider === 'openlibrary' ? (normalizeIsbn13(item.externalItemId) ?? '') : item.externalItemId.trim();
  if (externalProvider === 'openlibrary' && externalItemId) {
    const isbnIdentity = { source: 'isbn' as const, id: externalItemId };
    if (!externalIds.some((externalId) => externalId.source === 'isbn' && externalId.id === externalItemId)) {
      externalIds.push(isbnIdentity);
    }
  }

  const normalized: CollectionItemChangeApiModel = {
    image: item.image.trim(),
    title: item.title.trim(),
    genre: item.genre.map((genre) => `${genre}`.trim()).filter(Boolean),
    IMDbId: imdbId,
    externalProvider,
    externalItemId,
    externalIds: externalIds.length > 0 ? externalIds : undefined,
    tags: rawTags,
    year: normalizeYear(year),
    rate: item.rate.trim(),
    rottenTomatoesRate: item.rottenTomatoesRate.trim(),
    metacriticRate: item.metacriticRate.trim(),
    userRate,
    actors: item.actors.trim(),
    plot: item.plot.trim(),
    contentType,
    favorite,
    progressCurrent: progressCurrent === undefined ? undefined : progressCurrent,
    progressTotal: progressTotal === undefined ? undefined : progressTotal,
  };

  if (!normalized.title || !normalized.externalProvider || !normalized.externalItemId) return;
  return normalized;
};

export const getItemHash = (item: CollectionItemChangeApiModel): string => hashText(JSON.stringify(item));
