import { CollectionItemModel } from '@pages/collection/collection.model';
import { MemoModel } from '@services/memos.model';
import { getGenre } from './get-genre-util';
import { getImage } from './get-image-util';
import { getIMDbId } from './get-imdb-id.util';
import { getTags } from './get-tags.util';
import { getTitle } from './get-title-util';

export const getCollectionItem = (memo: MemoModel): CollectionItemModel => ({
  rawContent: memo.content,
  image: getImage(memo.content),
  title: getTitle(memo.content),
  genre: getGenre(memo.content),
  tags: getTags(memo.content),
  IMDbId: getIMDbId(memo.content),
  memoName: memo.name,
});
