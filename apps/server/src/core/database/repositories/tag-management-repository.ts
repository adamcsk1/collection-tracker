import Database from 'better-sqlite3';
import {
  RenameTagApiResponseModel,
  TagManagementApiResponseModel,
  TagManagementApiModel,
} from '@shared/models/api-model';
import { toCollectionItemChange } from '@shared/utils/collection-item-change-util';
import { getItemHash } from '../../utils/collection-item-util';
import { toApiItem } from './collection/collection-mapper';
import { collectionItemProjection, CollectionItemRow } from './collection/collection-model';

export const findTagManagement = (db: Database.Database, usernameHash: string): TagManagementApiResponseModel => {
  const rows = db
    .prepare(
      `SELECT tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight
       FROM tag_configs
       WHERE username_hash = ?
       ORDER BY weight DESC, tag ASC`
    )
    .all(usernameHash) as Array<{
    tag: string;
    color: string | null;
    use_for_image_border: number;
    use_for_text_color: number;
    use_for_image_badge: number;
    weight: number;
  }>;

  return rows.map(
    (row) =>
      ({
        tag: row.tag,
        color: row.color,
        useForImageBorder: row.use_for_image_border === 1,
        useForTextColor: row.use_for_text_color === 1,
        useForImageBadge: row.use_for_image_badge === 1,
        weight: row.weight,
      }) as TagManagementApiModel
  );
};

export const upsertTagManagement = (
  db: Database.Database,
  usernameHash: string,
  configs: TagManagementApiResponseModel
): void => {
  db.prepare('DELETE FROM tag_configs WHERE username_hash = ?').run(usernameHash);

  for (const config of configs) {
    db.prepare(
      `INSERT INTO tag_configs
       (username_hash, tag, color, use_for_image_border, use_for_text_color, use_for_image_badge, weight)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      usernameHash,
      config.tag,
      config.color,
      config.useForImageBorder ? 1 : 0,
      config.useForTextColor ? 1 : 0,
      config.useForImageBadge ? 1 : 0,
      config.weight
    );
  }
};

export const deleteTagManagement = (db: Database.Database, usernameHash: string): void => {
  db.prepare('DELETE FROM tag_configs WHERE username_hash = ?').run(usernameHash);
};

export const renameTag = (
  db: Database.Database,
  usernameHash: string,
  oldTag: string,
  newTag: string
): RenameTagApiResponseModel => {
  let renamedItemCount = 0;
  const rename = db.transaction(() => {
    const affectedItems = db
      .prepare(
        `SELECT ${collectionItemProjection()}
         FROM collection_items
         INNER JOIN collection_item_tags ON collection_item_tags.item_id = collection_items.id
         WHERE collection_items.username_hash = ?
           AND collection_item_tags.tag = ?`
      )
      .all(usernameHash, oldTag) as CollectionItemRow[];
    renamedItemCount = affectedItems.length;
    if (renamedItemCount === 0) return;

    db.prepare(
      `INSERT OR IGNORE INTO collection_item_tags (item_id, tag)
       SELECT collection_item_tags.item_id, ?
       FROM collection_item_tags
       INNER JOIN collection_items ON collection_items.id = collection_item_tags.item_id
       WHERE collection_items.username_hash = ?
         AND collection_item_tags.tag = ?`
    ).run(newTag, usernameHash, oldTag);

    db.prepare(
      `DELETE FROM collection_item_tags
       WHERE tag = ?
         AND item_id IN (SELECT id FROM collection_items WHERE username_hash = ?)`
    ).run(oldTag, usernameHash);

    const targetConfigExists = Boolean(
      db.prepare('SELECT 1 FROM tag_configs WHERE username_hash = ? AND tag = ? LIMIT 1').get(usernameHash, newTag)
    );

    if (targetConfigExists) {
      db.prepare('DELETE FROM tag_configs WHERE username_hash = ? AND tag = ?').run(usernameHash, oldTag);
    } else {
      db.prepare('UPDATE tag_configs SET tag = ? WHERE username_hash = ? AND tag = ?').run(
        newTag,
        usernameHash,
        oldTag
      );
    }

    for (const item of affectedItems) {
      const updatedItem = toApiItem(db, item);
      const hash = getItemHash(toCollectionItemChange(updatedItem));
      db.prepare('UPDATE collection_items SET content_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        hash,
        item.id
      );
    }
  });

  rename();
  return {
    renamedItemCount,
    tagManagement: findTagManagement(db, usernameHash),
  };
};
