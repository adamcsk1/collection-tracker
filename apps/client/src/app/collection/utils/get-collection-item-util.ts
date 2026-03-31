import { CollectionItemModel } from '@client/collection/collection-model';
import { getIMDbId } from '@services/omdb/get-imdb-id-util';
import { getGenre } from '@services/parser/utils/get-genre-util';
import { getImage } from '@services/parser/utils/get-image-util';
import { getIMDbRate } from '@services/parser/utils/get-imdb-rate-util';
import { getTags } from '@services/parser/utils/get-tags-util';
import { getTitle } from '@services/parser/utils/get-title-util';
import { getYear } from '@services/parser/utils/get-year-util';
import { GetAllApiResponseItemModel } from '@shared/models/api-model';

export const getCollectionItem = (item: Partial<GetAllApiResponseItemModel>): CollectionItemModel => {
  const safeItem: GetAllApiResponseItemModel = {
    content: item.content || '',
    name: item.name || '',
    hash: item.hash || '',
  };

  const title = getTitle(safeItem.content);

  const collectionItem = {
    rawContent: safeItem.content,
    rawContentLower: safeItem.content.toLowerCase(),
    image: getImage(safeItem.content),
    title,
    titleLower: title.toLowerCase(),
    genre: getGenre(safeItem.content),
    tags: getTags(safeItem.content),
    IMDbId: getIMDbId(safeItem.content),
    year: getYear(safeItem.content),
    rate: getIMDbRate(safeItem.content),
    name: safeItem.name,
    hash: safeItem.hash,
  };

  return collectionItem;
};
