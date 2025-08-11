import { CollectionItemModel } from '@client-app/collection/collection-model';
import { getGenre } from '@client-app/collection/utils/get-genre-util';
import { getImage } from '@client-app/collection/utils/get-image-util';
import { getTags } from '@client-app/collection/utils/get-tags-util';
import { getTitle } from '@client-app/collection/utils/get-title-util';
import { MemoModel } from '@services/memos/memos-model';
import { getIMDbId } from '@services/omdb/get-imdb-id-util';

export const getCollectionItem = (memo: Partial<MemoModel>): CollectionItemModel => {
  const safeMemo: MemoModel = {
    content: memo.content || '',
    name: memo.name || '',
    createTime: memo.createTime || '',
  };

  return {
    rawContent: safeMemo.content,
    image: getImage(safeMemo.content),
    title: getTitle(safeMemo.content),
    genre: getGenre(safeMemo.content),
    tags: getTags(safeMemo.content),
    IMDbId: getIMDbId(safeMemo.content),
    memoName: safeMemo.name,
    createTime: safeMemo.createTime,
  };
};
