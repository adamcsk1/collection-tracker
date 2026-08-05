import {
  DEFAULT_EXTERNAL_METADATA_PROVIDER,
  isExternalMetadataProviderName,
} from '@shared/constants/external-metadata-const';
import { CollectionItemApiModel } from '@shared/models/api-model';
import Database from 'better-sqlite3';
import { findExternalItemIdentitiesByCanonicalItemId } from '../external-item-identity-repository';
import { getUserShareCode } from '../user-repository';
import { CollectionItemRow } from './collection-model';

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

const hasCompletedTrackingTwin = (
  db: Database.Database,
  row: CollectionItemRow,
  viewerUsernameHash: string
): boolean => {
  if (row.list_type === 'tracking' && row.content_type === 'movie') return row.watched_at !== null;
  if (row.list_type === 'tracking' && row.content_type === 'book') return row.watched_at !== null;
  if (row.list_type !== 'library' && row.list_type !== 'books') return false;
  if (row.content_type !== 'movie' && row.content_type !== 'book') return false;
  const externalProvider = row.external_provider;
  const externalItemId = row.external_item_id ?? '';
  return Boolean(
    db
      .prepare(
        `SELECT 1
         FROM collection_items tracking_item
         LEFT JOIN collection_item_tracker_state tracker_state ON tracker_state.item_id = tracking_item.id
           WHERE tracking_item.username_hash = ?
             AND (
               (tracking_item.canonical_item_id IS NOT NULL AND tracking_item.canonical_item_id = ?)
               OR (tracking_item.external_provider = ? AND tracking_item.external_item_id = ?)
             )
             AND tracking_item.list_type = 'tracking'
             AND tracking_item.content_type = ?
             AND tracker_state.completed_at IS NOT NULL
           LIMIT 1`
      )
      .get(viewerUsernameHash, row.canonical_item_id, externalProvider, externalItemId, row.content_type)
  );
};

export const toApiItem = (
  db: Database.Database,
  row: CollectionItemRow,
  viewerUsernameHash = row.username_hash
): CollectionItemApiModel => {
  const relations = getItemRelations(db, row.id);
  const externalProvider = isExternalMetadataProviderName(row.external_provider)
    ? row.external_provider
    : DEFAULT_EXTERNAL_METADATA_PROVIDER;
  const item: CollectionItemApiModel = {
    image: row.image,
    title: row.title,
    genre: relations.genre,
    IMDbId: row.imdb_id ?? undefined,
    externalProvider,
    externalItemId: row.external_item_id ?? '',
    externalIds: row.canonical_item_id
      ? findExternalItemIdentitiesByCanonicalItemId(db, row.username_hash, row.canonical_item_id)
      : undefined,
    canonicalItemId: row.canonical_item_id ?? undefined,
    tags: relations.tags,
    year: row.year || null,
    rate: row.rate,
    rottenTomatoesRate: row.rotten_tomatoes_rate ?? '',
    metacriticRate: row.metacritic_rate ?? '',
    userRate: row.user_rate,
    actors: row.actors,
    plot: row.plot,
    contentType: row.content_type,
    favorite: row.favorite === 1,
    titleLower: row.title_lower,
    hash: row.content_hash,
    listType: row.list_type,
    watched: hasCompletedTrackingTwin(db, row, viewerUsernameHash),
    watchedAt: row.watched_at,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total,
    ownerShareCode: getUserShareCode(row.username_hash),
  };

  return item;
};
