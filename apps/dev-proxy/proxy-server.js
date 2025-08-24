const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PORT = 4200;
const TARGETS = {
  api: 'http://localhost:3000/api',
  login: 'http://localhost:4201/login',
  client: 'http://localhost:4202/client',
};

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

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

app.use('/api', apiProxy);
app.use('/login', loginProxy);
app.use('/client', clientProxy);
app.get('/health', (_req, res) => res.status(200).send('ok'));
app.get('/', (_req, res) => res.redirect(302, '/login'));

const server = app.listen(PORT, () => {
  console.log(`[proxy] Dev gateway ready at http://localhost:${PORT}`);
  console.log(`[proxy] /api    -> ${TARGETS.api}`);
  console.log(`[proxy] /login  -> ${TARGETS.login}`);
  console.log(`[proxy] /client -> ${TARGETS.client}`);
});

server.on('upgrade', (req, socket, head) => {
  const url = req.url || '';
  if (url.startsWith('/login')) return loginProxy.upgrade(req, socket, head);
  if (url.startsWith('/client')) return clientProxy.upgrade(req, socket, head);
  if (url.startsWith('/api')) return apiProxy.upgrade(req, socket, head);
});
