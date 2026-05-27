import { CollectionItemApiModel, CollectionItemChangeApiModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { getUserShareCode } from '../user-repository';
import { CollectionItemRow } from './collection-types';

const getItemRelations = (db: Database.Database, itemId: number): { genre: string[]; tags: string[] } => ({
  genre: (
    db.prepare('SELECT genre FROM collection_item_genres WHERE item_id = ? ORDER BY genre').all(itemId) as Array<{
      genre: string;
    }>
  ).map((row) => row.genre),
  tags: (
    db.prepare('SELECT tag FROM collection_item_tags WHERE item_id = ? ORDER BY tag').all(itemId) as Array<{
      tag: string;
    }>
  ).map((row) => row.tag),
});

export const toApiItem = (db: Database.Database, row: CollectionItemRow): CollectionItemApiModel => {
  const relations = getItemRelations(db, row.id);
  const item: CollectionItemChangeApiModel = {
    image: row.image,
    title: row.title,
    genre: relations.genre,
    IMDbId: row.imdb_id,
    tags: relations.tags,
    year: row.year || null,
    rate: row.rate,
    userRate: row.user_rate,
    actors: row.actors,
    plot: row.plot,
  };

  return {
    ...item,
    titleLower: row.title_lower,
    hash: row.content_hash,
    listType: row.list_type,
    ownerShareCode: getUserShareCode(row.username_hash),
  };
};
