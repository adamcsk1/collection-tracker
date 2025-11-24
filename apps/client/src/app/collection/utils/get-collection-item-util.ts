import { CollectionItemModel } from '@client/collection/collection-model';
import { getGenre } from '@client/collection/utils/get-genre-util';
import { getImage } from '@client/collection/utils/get-image-util';
import { getIMDbRate } from '@client/collection/utils/get-imdb-rate-util';
import { getTags } from '@client/collection/utils/get-tags-util';
import { getTitle } from '@client/collection/utils/get-title-util';
import { getYear } from '@client/collection/utils/get-year-util';
import { getIMDbId } from '@services/omdb/get-imdb-id-util';
import { GetAllApiResponseItemModel } from '@shared/models/api-model';

export const getCollectionItem = (item: Partial<GetAllApiResponseItemModel>): CollectionItemModel => {
  const safeItem: GetAllApiResponseItemModel = {
    content: item.content || '',
    name: item.name || '',
  };

  return {
    rawContent: safeItem.content,
    image: getImage(safeItem.content),
    title: getTitle(safeItem.content),
    genre: getGenre(safeItem.content),
    tags: getTags(safeItem.content),
    IMDbId: getIMDbId(safeItem.content),
    year: getYear(safeItem.content),
    rate: getIMDbRate(safeItem.content),
    name: safeItem.name,
  };
};
