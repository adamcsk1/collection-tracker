import { CollectionItemChangeApiModel } from '../models/api-model';
import { CollectionItemModel } from '../models/collection-item-model';

export const toCollectionItemChange = (item: CollectionItemModel): CollectionItemChangeApiModel => ({
  image: item.image,
  title: item.title,
  genre: item.genre,
  IMDbId: item.IMDbId,
  tags: item.tags,
  year: item.year,
  rate: item.rate,
  userRate: item.userRate,
  actors: item.actors,
  plot: item.plot,
});
