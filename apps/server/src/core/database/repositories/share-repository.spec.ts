import { getDatabase } from '../database';
import { insertShare, libraryGrants } from '../../../../test/mocks/share-mock';
import { describe, expect, it, vi } from 'vitest';
import { findSharesForUser } from './share-repository';

const insertUser = (usernameHash: string): void => {
  getDatabase()
    .prepare('INSERT INTO users (username_hash, user_token_hash, username) VALUES (?, ?, ?)')
    .run(usernameHash, `${usernameHash}-token`, usernameHash);
};

describe('share-repository', () => {
  it('loads and groups hundreds of incoming and outgoing shares', () => {
    const db = getDatabase();
    insertUser('viewer');
    db.transaction(() => {
      for (let shareIndex = 0; shareIndex < 150; shareIndex += 1) {
        const ownerHash = `owner-${shareIndex}`;
        const recipientHash = `recipient-${shareIndex}`;
        insertUser(ownerHash);
        insertUser(recipientHash);
        insertShare(
          db,
          ownerHash,
          'viewer',
          libraryGrants(shareIndex === 149 ? { canCreate: true } : { canRead: true })
        );
        insertShare(
          db,
          'viewer',
          recipientHash,
          libraryGrants(shareIndex === 149 ? { canDelete: true } : { canRead: true, canUpdate: true })
        );
      }
    })();

    const prepareSpy = vi.spyOn(db, 'prepare');
    const shares = findSharesForUser(db, 'viewer');
    const query = prepareSpy.mock.calls[0]?.[0];
    prepareSpy.mockRestore();
    expect(typeof query).toBe('string');
    if (typeof query !== 'string') throw new Error('Expected share query');
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${query}`).all('viewer', 'viewer') as Array<{ detail: string }>;

    expect(shares).toHaveLength(300);
    expect(shares.filter(({ direction }) => direction === 'incoming')).toHaveLength(150);
    expect(shares.filter(({ direction }) => direction === 'outgoing')).toHaveLength(150);
    expect(shares).toContainEqual(
      expect.objectContaining({
        direction: 'incoming',
        counterpartUsername: 'owner-149',
        grants: libraryGrants({ canCreate: true }),
      })
    );
    expect(shares).toContainEqual(
      expect.objectContaining({
        direction: 'outgoing',
        counterpartUsername: 'recipient-149',
        grants: libraryGrants({ canDelete: true }),
      })
    );
    expect(plan.some(({ detail }) => /SEARCH user_shares.*owner_username_hash=\?/.test(detail))).toBe(true);
    expect(plan.some(({ detail }) => /SEARCH user_shares.*shared_with_username_hash=\?/.test(detail))).toBe(true);
    expect(plan.some(({ detail }) => /SEARCH grants.*USING .*INDEX/.test(detail))).toBe(true);
  });
});
