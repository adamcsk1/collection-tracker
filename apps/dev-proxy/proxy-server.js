const fastify = require('fastify');
const { createProxyServer } = require('http-proxy');

const PORT = 4200;
const API_PROXY_TIMEOUT_MS = 300000;
const TARGETS = {
  api: 'http://localhost:3000',
  login: 'http://localhost:4201',
  client: 'http://localhost:4202',
  health: 'http://localhost:4203',
};

const app = fastify({ logger: false, trustProxy: true });
const proxy = createProxyServer({ changeOrigin: true, xfwd: true });

proxy.on('proxyRes', (proxyResponse, request) => {
  if (!request.url?.startsWith('/api')) return;

  const setCookie = proxyResponse.headers['set-cookie'];
  if (!setCookie) return;

  const rewritten = Array.isArray(setCookie) ? setCookie : [setCookie];
  proxyResponse.headers['set-cookie'] = rewritten.map((cookie) =>
    cookie.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Secure/gi, '')
  );
});

proxy.on('error', (error, request, responseOrSocket) => {
  const message = `[proxy] error for ${request?.method || 'WS'} ${request?.url}: ${error?.message || error}`;
  console.error(message);

  if (!responseOrSocket) return;
  if (typeof responseOrSocket.writeHead === 'function') {
    if (!responseOrSocket.headersSent) responseOrSocket.writeHead(502, { 'content-type': 'text/plain' });
    responseOrSocket.end('Dev proxy error');
    return;
  }

  responseOrSocket.destroy();
});

const httpProxy = (target, request, reply) => {
  proxy.web(request.raw, reply.raw, {
    target,
    timeout: API_PROXY_TIMEOUT_MS,
    proxyTimeout: API_PROXY_TIMEOUT_MS,
  });
  reply.hijack();
};

app.addHook('onRequest', (request, reply, done) => {
  const requestUrl = request.raw.url || '';
  if (requestUrl === '/api' || requestUrl.startsWith('/api/')) return httpProxy(TARGETS.api, request, reply);
  if (requestUrl === '/login' || requestUrl.startsWith('/login/')) return httpProxy(TARGETS.login, request, reply);
  if (requestUrl === '/client' || requestUrl.startsWith('/client/')) return httpProxy(TARGETS.client, request, reply);
  if (requestUrl === '/health' || requestUrl.startsWith('/health/')) return httpProxy(TARGETS.health, request, reply);

  done();
});

app.get('/', (_request, reply) => reply.redirect('/login', 302));

const pickAppFromReferer = (referer = '') => {
  try {
    const { pathname = '' } = new URL(referer);
    if (pathname.startsWith('/login')) return 'login';
    if (pathname.startsWith('/client')) return 'client';
    if (pathname.startsWith('/health')) return 'health';
  } catch {
    // ignore bad referer
  }
  return null;
};

const tryUpgrade = (target, request, socket, head, targetLabel) => {
  socket.on('error', (error) => {
    console.error(`[proxy] Socket error for ${request.url}: ${error.message}`);
  });
  socket.on('close', (hadError) => {
    console.log(`[proxy] Socket closed for ${request.url} (hadError=${hadError})`);
  });

  try {
    console.log(`[proxy] WS upgrade: ${request.url} -> ${targetLabel}`);
    proxy.ws(request, socket, head, { target });
  } catch (error) {
    console.error(`[proxy] WS upgrade failed for ${request.url}:`, error);
    socket.destroy();
  }
};

app.server.on('upgrade', (request, socket, head) => {
  const originalUrl = request.url || '';
  console.log(`[proxy] Raw WS upgrade: ${originalUrl}`);

  const fromReferer = pickAppFromReferer(request.headers?.referer);

  if (originalUrl.startsWith('/login') || fromReferer === 'login') {
    request.url = originalUrl.replace(/^\/login(\/|$)/, '/');
    return tryUpgrade(TARGETS.login, request, socket, head, 'ws://localhost:4201');
  }
  if (originalUrl.startsWith('/client') || fromReferer === 'client') {
    request.url = originalUrl.replace(/^\/client(\/|$)/, '/');
    return tryUpgrade(TARGETS.client, request, socket, head, 'ws://localhost:4202');
  }
  if (originalUrl.startsWith('/health') || fromReferer === 'health') {
    request.url = originalUrl.replace(/^\/health(\/|$)/, '/');
    return tryUpgrade(TARGETS.health, request, socket, head, 'ws://localhost:4203');
  }
  if (originalUrl.startsWith('/api')) {
    return tryUpgrade(TARGETS.api, request, socket, head, 'ws://localhost:3000');
  }

  if (originalUrl.includes('ng-cli-ws') || originalUrl.startsWith('/ng-cli-ws')) {
    if (fromReferer === 'login') {
      request.url = originalUrl.replace(/^\/login(\/|$)/, '/');
      return tryUpgrade(TARGETS.login, request, socket, head, 'ws://localhost:4201');
    }
    if (fromReferer === 'health') {
      request.url = originalUrl.replace(/^\/health(\/|$)/, '/');
      return tryUpgrade(TARGETS.health, request, socket, head, 'ws://localhost:4203');
    }
    request.url = originalUrl.replace(/^\/client(\/|$)/, '/');
    return tryUpgrade(TARGETS.client, request, socket, head, 'ws://localhost:4202');
  }

  console.log(`[proxy] Unhandled WS upgrade: ${originalUrl}`);
  socket.destroy();
});

const start = async () => {
  try {
    await app.listen({ port: PORT, host: '127.0.0.1' });
    console.log(`[proxy] Dev gateway ready at http://localhost:${PORT}`);
    console.log(`[proxy] /api    -> ${TARGETS.api}/api`);
    console.log(`[proxy] /login  -> ${TARGETS.login}/login`);
    console.log(`[proxy] /client -> ${TARGETS.client}/client`);
    console.log(`[proxy] /health -> ${TARGETS.health}/health`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};

start();
