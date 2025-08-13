import { CollectionItemModel } from '@client-app/collection/collection-model';
import { getGenre } from '@client-app/collection/utils/get-genre-util';
import { getImage } from '@client-app/collection/utils/get-image-util';
import { getTags } from '@client-app/collection/utils/get-tags-util';
import { getTitle } from '@client-app/collection/utils/get-title-util';
import { ApiGetAllItemModel } from '@services/api/api-model';
import { getIMDbId } from '@services/omdb/get-imdb-id-util';

export const getCollectionItem = (item: Partial<ApiGetAllItemModel>): CollectionItemModel => {
  const safeItem: ApiGetAllItemModel = {
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
    name: safeItem.name,
  };
};
