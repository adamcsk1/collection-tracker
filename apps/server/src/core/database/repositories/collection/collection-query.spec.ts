import { describe, expect, it } from 'vitest';
import { getDatabase } from '../../database';
import { buildReadableItemScope } from './collection-query';

describe('collection-query readable scope', () => {
  it.each([
    [undefined, 2],
    ['mine' as const, 1],
    ['shared' as const, 1],
  ])('keeps a fixed query shape for shared filter %s', (shared, expectedParameterCount) => {
    const scope = buildReadableItemScope('viewer', { shared });
    const sql = scope.where.join(' AND ');

    expect(scope.params).toHaveLength(expectedParameterCount);
    expect(sql.match(/user_share_grants/g) ?? []).toHaveLength(shared === 'mine' ? 0 : 1);
  });

  it.each([undefined, 'shared' as const])('uses an indexed grant lookup for shared filter %s', (shared) => {
    const scope = buildReadableItemScope('viewer', { shared });
    const plan = getDatabase()
      .prepare(`EXPLAIN QUERY PLAN SELECT id FROM collection_items WHERE ${scope.where.join(' AND ')}`)
      .all(...scope.params) as Array<{ detail: string }>;

    expect(plan.some(({ detail }) => /SEARCH readable_grant.*USING .*INDEX/.test(detail))).toBe(true);
  });
});
