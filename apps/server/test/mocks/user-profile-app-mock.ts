import fastifyCookie from '@fastify/cookie';
import fastify, { type FastifyInstance } from 'fastify';
import { vi } from 'vitest';
import { hashText } from '../../src/core/crypto';
import { getDatabase } from '../../src/core/database/database';
import { getUserShareCode, insertAccessToken, insertUser } from '../../src/core/database/repositories/user-repository';
import { generateAccessToken } from '../../src/core/jwt';
import { apiResponseHook } from '../../src/core/utils/api-response-util';

export const buildUserProfileTestApp = async (register: (app: FastifyInstance) => void): Promise<FastifyInstance> => {
  vi.stubEnv('JWT_SECRET', 'user-profile-test-secret');
  const app = fastify();
  await app.register(fastifyCookie);
  app.addHook('onSend', apiResponseHook);
  register(app);
  await app.ready();
  return app;
};

export const insertUserProfileTestUser = async (username: string, storedUsername: string | null = username) => {
  const db = getDatabase();
  const usernameHash = hashText(username);
  insertUser(db, usernameHash, `${username}-token`, username);
  db.prepare('UPDATE users SET username = ? WHERE username_hash = ?').run(storedUsername, usernameHash);
  const token = await generateAccessToken(username);
  insertAccessToken(db, usernameHash, {
    tokenHash: hashText(token),
    createdAt: new Date().toISOString(),
    userAgent: 'test',
    expiresAt: null,
  });
  return { usernameHash, shareCode: getUserShareCode(usernameHash), headers: { authorization: `Bearer ${token}` } };
};
