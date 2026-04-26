import { GetAllApiResponseItemModel } from '../models/api-model';
import { CollectionItemModel } from '../models/collection-item-model';
import { getIMDbId } from '../omdb/get-imdb-id-util';
import { getContent } from '../parser/utils/get-content-util';
import { getGenre } from '../parser/utils/get-genre-util';
import { getImage } from '../parser/utils/get-image-util';
import { getIMDbRate } from '../parser/utils/get-imdb-rate-util';
import { getTags } from '../parser/utils/get-tags-util';
import { getTitle } from '../parser/utils/get-title-util';
import { getYear } from '../parser/utils/get-year-util';

export const getCollectionItem = (item: Partial<GetAllApiResponseItemModel>): CollectionItemModel => {
  const safeItem: GetAllApiResponseItemModel = {
    content: item.content || '',
    name: item.name || '',
    hash: item.hash || '',
  };

  const title = getTitle(safeItem.content);

  return {
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
    plot: getContent(safeItem.content),
    name: safeItem.name,
    hash: safeItem.hash,
  };
};
