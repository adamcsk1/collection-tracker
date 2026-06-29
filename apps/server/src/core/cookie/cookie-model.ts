import type { FastifyCookieOptions } from '@fastify/cookie';

export type CookieConfig = NonNullable<FastifyCookieOptions['parseOptions']> & { expires: Date };
