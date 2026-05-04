import Database from 'better-sqlite3';
import { TagConfigsApiResponseModel, TagConfigApiModel } from '@shared/models/api-model';

export const findTagConfigs = (db: Database.Database, usernameHash: string): TagConfigsApiResponseModel => {
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
      }) as TagConfigApiModel
  );
};

export const upsertTagConfigs = (
  db: Database.Database,
  usernameHash: string,
  configs: TagConfigsApiResponseModel
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
