import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from '../database';

const { hashTextMock } = vi.hoisted(() => ({
  hashTextMock: vi.fn((value: string) => value.padEnd(16, '_')),
}));

vi.mock('../../crypto', () => ({ hashText: hashTextMock }));

import { findUserByShareCode, getUserShareCode } from './user-repository';

describe('user-repository share codes', () => {
  beforeEach(() => {
    hashTextMock.mockClear();
  });

  it('characterizes one hash operation per user during share-code lookup', () => {
    const db = getDatabase();
    const insertUser = db.prepare('INSERT INTO users (username_hash, user_token_hash) VALUES (?, ?)');
    db.transaction(() => {
      for (let userIndex = 0; userIndex < 1_000; userIndex += 1) {
        const usernameHash = `user-${String(userIndex).padStart(4, '0')}`;
        insertUser.run(usernameHash, `${usernameHash}-token`);
      }
    })();
    const shareCode = getUserShareCode('user-0999');
    hashTextMock.mockClear();

    expect(findUserByShareCode(db, shareCode)).toEqual(expect.objectContaining({ username_hash: 'user-0999' }));
    expect(hashTextMock).toHaveBeenCalledTimes(1_000);
  });
});
