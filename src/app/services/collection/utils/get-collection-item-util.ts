import { MemoModel } from '@lib/services/memos/memos-model';
import { CollectionItemModel } from '@pages/collection/collection.model';
import { getGenre } from './get-genre-util';
import { getImage } from './get-image-util';
import { getIMDbId } from './get-imdb-id.util';
import { getTags } from './get-tags.util';
import { getTitle } from './get-title-util';

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
