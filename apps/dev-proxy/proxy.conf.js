/*
  Dev proxy config to mirror Docker/Nginx routing:
  - /api    -> Node server (localhost:3000)
  - /login  -> Login SPA dev server (localhost:4201), path rewritten to '/'
  - /client -> Current client dev server (localhost:4200) via bypass rewrite (no proxy loop)
  - '/'     -> 302 redirect to '/login/'

  Notes:
  - For clean sub-path hosting in dev, serve apps with matching base-href:
      nx serve client -- --base-href=/client/
      nx serve login  -- --base-href=/login/
*/

/** @type {import('http-proxy-middleware').Options | import('http-proxy-middleware').Options[]} */
const PROXY_CONFIG = [
  {
    context: ['/api', '/api/**'],
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
    // keep /api prefix as-is (server expects it)
    pathRewrite: {},
  },
  {
    context: ['/login', '/login/**'],
    target: 'http://localhost:4201',
    changeOrigin: true,
    secure: false,
    pathRewrite: {},
    logLevel: 'warn',
  },
  {
    context: ['/client', '/client/**'],
    target: 'http://localhost:4202',
    changeOrigin: true,
    secure: false,
    pathRewrite: {},
    logLevel: 'warn',
  },
  {
    // Root redirect to /login
    context: ['/'],
    bypass: function (req, res) {
      if (req.url === '/' || req.url === '') {
        res.writeHead(302, { Location: '/login/' });
        res.end();
        return true; // handled
      }
      return false;
    },
  },
];

module.exports = PROXY_CONFIG;
