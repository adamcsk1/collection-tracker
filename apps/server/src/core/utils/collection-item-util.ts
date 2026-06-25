import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { hashText } from '../crypto';

const normalizeYear = (year: number | string | null): string | null => {
  if (typeof year === 'number') return Number.isInteger(year) ? `${year}` : `${year}`.replace(/^(\d{4})\.0$/, '$1');
  return year?.trim().replace(/^(\d{4})\.0$/, '$1') || null;
};

export const normalizeItem = (item: CollectionItemChangeApiModel): CollectionItemChangeApiModel | undefined => {
  const userRate = item?.userRate;
  const year = item?.year;
  const rawTags = Array.isArray(item?.tags) ? item.tags.map((tag) => `${tag}`.trim()).filter(Boolean) : [];
  const contentType = item?.contentType;
  const favorite = item?.favorite;
  if (
    typeof item?.title !== 'string' ||
    typeof item?.image !== 'string' ||
    typeof item?.IMDbId !== 'string' ||
    typeof item?.rate !== 'string' ||
    typeof item?.rottenTomatoesRate !== 'string' ||
    typeof item?.metacriticRate !== 'string' ||
    typeof item?.actors !== 'string' ||
    typeof item?.plot !== 'string' ||
    (contentType !== 'movie' && contentType !== 'series') ||
    typeof favorite !== 'boolean' ||
    !Array.isArray(item?.genre) ||
    !Array.isArray(item?.tags) ||
    (typeof year !== 'number' && typeof year !== 'string' && year !== null) ||
    (typeof userRate !== 'number' && userRate !== null) ||
    (typeof userRate === 'number' &&
      (!Number.isFinite(userRate) ||
        userRate < 0 ||
        userRate > 10 ||
        Math.abs(userRate * 10 - Math.round(userRate * 10)) > 1e-9))
  ) {
    return;
  }

  const normalized: CollectionItemChangeApiModel = {
    image: item.image.trim(),
    title: item.title.trim(),
    genre: item.genre.map((genre) => `${genre}`.trim()).filter(Boolean),
    IMDbId: item.IMDbId.trim(),
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
  };

  if (!normalized.title || !normalized.IMDbId) return;
  return normalized;
};

export const getItemHash = (item: CollectionItemChangeApiModel): string => hashText(JSON.stringify(item));
