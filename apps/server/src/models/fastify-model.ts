import '@fastify/cookie';

declare module 'fastify' {
  interface FastifyRequest {
    username: string;
    usernameHash: string;
  }
}
