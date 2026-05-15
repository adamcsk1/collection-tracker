import { CollectionItemChangeApiModel } from '@shared/models/api-model';
import { hashText } from '../crypto';

export const normalizeItem = (item: CollectionItemChangeApiModel): CollectionItemChangeApiModel | undefined => {
  const userRate = item?.userRate;
  if (
    typeof item?.title !== 'string' ||
    typeof item?.image !== 'string' ||
    typeof item?.IMDbId !== 'string' ||
    typeof item?.rate !== 'string' ||
    typeof item?.actors !== 'string' ||
    typeof item?.plot !== 'string' ||
    !Array.isArray(item?.genre) ||
    !Array.isArray(item?.tags) ||
    (typeof item?.year !== 'number' && item?.year !== null) ||
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
    tags: item.tags.map((tag) => `${tag}`.trim()).filter(Boolean),
    year: item.year,
    rate: item.rate.trim(),
    userRate,
    actors: item.actors.trim(),
    plot: item.plot.trim(),
  };

  if (!normalized.title || !normalized.IMDbId) return;
  return normalized;
};

export const getItemHash = (item: CollectionItemChangeApiModel): string => hashText(JSON.stringify(item));
