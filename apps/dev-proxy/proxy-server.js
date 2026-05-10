const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = 4200;
const API_PROXY_TIMEOUT_MS = 300000;
const TARGETS = {
  api: 'http://localhost:3000/api',
  login: 'http://localhost:4201/login',
  client: 'http://localhost:4202/client',
  health: 'http://localhost:4203/health',
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const httpProxy = (customs = {}) =>
  createProxyMiddleware({
    changeOrigin: true,
    xfwd: true,
    logLevel: 'warn',
    cookieDomainRewrite: { '*': '' },
    onError(err, req, res) {
      const msg = `[proxy] error for ${req?.method || 'WS'} ${req?.url}: ${err?.message || err}`;
      console.error(msg);
      if (res && !res.headersSent && typeof res.status === 'function') {
        res.status(502).send('Dev proxy error');
      }
    },
    ...customs,
  });

const wsProxy = (customs = {}) =>
  createProxyMiddleware({
    changeOrigin: true,
    ws: true,
    xfwd: true,
    logLevel: 'warn',
    onError(err, req, _res) {
      console.error(`[proxy] WS error for ${req?.url}: ${err?.message || err}`);
    },
    onProxyReqWs(proxyReq, req, _socket, options) {
      const targetStr = options?.target?.href || String(options?.target) || 'unknown';
      console.log(`[proxy] WS forwarded: ${req.url} -> ${proxyReq.path} on ${targetStr}`);
    },
    ...customs,
  });

const apiProxy = httpProxy({
  target: TARGETS.api,
  timeout: API_PROXY_TIMEOUT_MS,
  proxyTimeout: API_PROXY_TIMEOUT_MS,
  onProxyRes(proxyRes) {
    const setCookie = proxyRes.headers['set-cookie'];
    if (!setCookie) return;
    const rewritten = Array.isArray(setCookie) ? setCookie : [setCookie];
    proxyRes.headers['set-cookie'] = rewritten.map((cookie) => cookie.replace(/;\s*Secure/gi, ''));
  },
});

const loginProxy = httpProxy({ target: TARGETS.login });
const clientProxy = httpProxy({ target: TARGETS.client });
const healthProxy = httpProxy({ target: TARGETS.health });

// WS-only proxies to root targets (base path stripped in upgrade handler)
const loginWsProxy = wsProxy({ target: 'http://localhost:4201' });
const clientWsProxy = wsProxy({ target: 'http://localhost:4202' });
const healthWsProxy = wsProxy({ target: 'http://localhost:4203' });

app.use('/api', apiProxy);
app.use('/login', loginProxy);
app.use('/client', clientProxy);
app.use('/health', healthProxy);
app.get('/', (_request, response) => response.redirect(302, '/login'));

const server = app.listen(PORT, () => {
  console.log(`[proxy] Dev gateway ready at http://localhost:${PORT}`);
  console.log(`[proxy] /api    -> ${TARGETS.api}`);
  console.log(`[proxy] /login  -> ${TARGETS.login}`);
  console.log(`[proxy] /client -> ${TARGETS.client}`);
  console.log(`[proxy] /health -> ${TARGETS.health}`);
});

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

const tryUpgrade = (proxy, req, socket, head, targetLabel) => {
  socket.on('error', (err) => {
    console.error(`[proxy] Socket error for ${req.url}: ${err.message}`);
  });
  socket.on('close', (hadError) => {
    console.log(`[proxy] Socket closed for ${req.url} (hadError=${hadError})`);
  });

  try {
    console.log(`[proxy] WS upgrade: ${req.url} -> ${targetLabel}`);
    proxy.upgrade(req, socket, head);
  } catch (err) {
    console.error(`[proxy] WS upgrade failed for ${req.url}:`, err);
    socket.destroy();
  }
};

server.on('upgrade', (req, socket, head) => {
  const originalUrl = req.url || '';
  console.log(`[proxy] Raw WS upgrade: ${originalUrl}`);

  const fromReferer = pickAppFromReferer(req.headers?.referer);

  if (originalUrl.startsWith('/login') || fromReferer === 'login') {
    req.url = originalUrl.replace(/^\/login(\/|$)/, '/');
    return tryUpgrade(loginWsProxy, req, socket, head, 'ws://localhost:4201');
  }
  if (originalUrl.startsWith('/client') || fromReferer === 'client') {
    req.url = originalUrl.replace(/^\/client(\/|$)/, '/');
    return tryUpgrade(clientWsProxy, req, socket, head, 'ws://localhost:4202');
  }
  if (originalUrl.startsWith('/health') || fromReferer === 'health') {
    req.url = originalUrl.replace(/^\/health(\/|$)/, '/');
    return tryUpgrade(healthWsProxy, req, socket, head, 'ws://localhost:4203');
  }
  if (originalUrl.startsWith('/api')) {
    return tryUpgrade(apiProxy, req, socket, head, 'ws://localhost:3000');
  }

  if (originalUrl.includes('ng-cli-ws') || originalUrl.startsWith('/ng-cli-ws')) {
    if (fromReferer === 'login') {
      req.url = originalUrl.replace(/^\/login(\/|$)/, '/');
      return tryUpgrade(loginWsProxy, req, socket, head, 'ws://localhost:4201');
    }
    if (fromReferer === 'health') {
      req.url = originalUrl.replace(/^\/health(\/|$)/, '/');
      return tryUpgrade(healthWsProxy, req, socket, head, 'ws://localhost:4203');
    }
    req.url = originalUrl.replace(/^\/client(\/|$)/, '/');
    return tryUpgrade(clientWsProxy, req, socket, head, 'ws://localhost:4202');
  }

  console.log(`[proxy] Unhandled WS upgrade: ${originalUrl}`);
  socket.destroy();
});
