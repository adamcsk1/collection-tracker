const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = 4200;
const TARGETS = {
  api: 'http://localhost:3000/api',
  login: 'http://localhost:4201/login',
  client: 'http://localhost:4202/client',
  health: 'http://localhost:4203/health',
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const REFRESH_THRESHOLD = 3;
const REFRESH_WINDOW_MS = 2000;
const refreshTracker = new Map();

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  const acceptsHtml = (req.headers?.accept || '').includes('text/html');
  if (!acceptsHtml) return next();

  const path = req.path || req.originalUrl || '/';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const key = `${ip}|${path}`;
  const now = Date.now();
  const recent = (refreshTracker.get(key) || []).filter((ts) => now - ts < REFRESH_WINDOW_MS);
  recent.push(now);
  refreshTracker.set(key, recent);

  if (recent.length >= REFRESH_THRESHOLD) {
    refreshTracker.set(key, []);
    return res.redirect(302, `http://localhost:${PORT}/`);
  }

  return next();
});

const commonProxy = (customs = {}) => ({
  changeOrigin: true,
  ws: true,
  xfwd: true,
  logLevel: 'warn',
  cookieDomainRewrite: { '*': '' },
  onError(err, req, res) {
    console.error(`[proxy] error for ${req?.method} ${req?.url}:`, err?.stack || err);
    if (!res.headersSent) {
      res.status(502).send('Dev proxy error');
    }
  },
  ...customs,
});

const apiProxy = createProxyMiddleware(
  commonProxy({
    target: TARGETS.api,
    onProxyRes(proxyRes) {
      const setCookie = proxyRes.headers['set-cookie'];
      if (!setCookie) return;
      const rewritten = Array.isArray(setCookie) ? setCookie : [setCookie];
      proxyRes.headers['set-cookie'] = rewritten.map((cookie) => cookie.replace(/;\s*Secure/gi, ''));
    },
  })
);

const loginProxy = createProxyMiddleware(
  commonProxy({
    target: TARGETS.login,
    pathRewrite: {
      '^/login(/|$)': '',
    },
  })
);

const clientProxy = createProxyMiddleware(
  commonProxy({
    target: TARGETS.client,
    pathRewrite: { '^/client': '' },
  })
);

const healthProxy = createProxyMiddleware(
  commonProxy({
    target: TARGETS.health,
    pathRewrite: { '^/health': '' },
  })
);

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

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  const fromReferer = pickAppFromReferer(req.headers?.referer);

  if (url.startsWith('/login') || fromReferer === 'login') return loginProxy.upgrade(req, socket, head);
  if (url.startsWith('/client') || fromReferer === 'client') return clientProxy.upgrade(req, socket, head);
  if (url.startsWith('/health') || fromReferer === 'health') return healthProxy.upgrade(req, socket, head);
  if (url.startsWith('/api')) return apiProxy.upgrade(req, socket, head);

  if (url.includes('ng-cli-ws') || url.startsWith('/ng-cli-ws')) {
    if (fromReferer === 'login') return loginProxy.upgrade(req, socket, head);
    if (fromReferer === 'health') return healthProxy.upgrade(req, socket, head);
    return clientProxy.upgrade(req, socket, head);
  }
});
