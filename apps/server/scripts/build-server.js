const { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '../../..');
const configuration = process.argv.includes('--configuration=development') ? 'development' : 'production';
const packageJson = require(join(root, 'package.json'));
const serverDependencyNames = [
  '@fastify/cookie',
  '@fastify/cors',
  '@fastify/formbody',
  '@fastify/helmet',
  '@fastify/rate-limit',
  '@fastify/swagger',
  '@fastify/swagger-ui',
  'better-sqlite3',
  'dayjs',
  'dotenv',
  'fastify',
  'js-yaml',
  'jsonwebtoken',
];

const resolveTsPath = (specifier) => {
  const aliases = [
    ['@server/', 'apps/server/src/'],
    ['@shared/', 'libs/shared/src/lib/'],
  ];
  const match = aliases.find(([alias]) => specifier.startsWith(alias));
  if (!match) return null;

  const basePath = join(root, match[1], specifier.slice(match[0].length));
  const candidates = [basePath, `${basePath}.ts`, join(basePath, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate)) || null;
};

const tsPathAliasPlugin = {
  name: 'ts-path-aliases',
  setup(build) {
    build.onResolve({ filter: /^@(server|shared)\// }, (importArgs) => {
      const path = resolveTsPath(importArgs.path);
      return path ? { path } : undefined;
    });
  },
};

const copyIfExists = (from, to) => {
  if (existsSync(from)) cpSync(from, to, { recursive: true });
};

const build = async () => {
  const esbuild = require('esbuild');
  const outputPath = join(root, 'dist/apps/server');
  rmSync(outputPath, { recursive: true, force: true });
  mkdirSync(outputPath, { recursive: true });

  await esbuild.build({
    entryPoints: [join(root, 'apps/server/src/bootstrap.ts')],
    outfile: join(outputPath, 'bootstrap.js'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    packages: 'external',
    sourcemap: configuration !== 'production',
    tsconfig: join(root, 'apps/server/tsconfig.app.json'),
    plugins: [tsPathAliasPlugin],
  });

  copyIfExists(join(root, 'apps/server/src/assets'), join(outputPath, 'assets'));
  copyIfExists(join(root, 'apps/server/public'), join(outputPath, 'public'));
  copyIfExists(join(root, 'apps/server/src/migrations'), join(outputPath, 'migrations'));

  writeFileSync(
    join(outputPath, 'package.json'),
    `${JSON.stringify(
      {
        name: 'collection-tracker-server',
        private: true,
        main: 'bootstrap.js',
        dependencies: Object.fromEntries(serverDependencyNames.map((name) => [name, packageJson.dependencies[name]])),
      },
      null,
      2
    )}\n`
  );

  copyIfExists(join(root, 'package-lock.json'), join(outputPath, 'package-lock.json'));
};

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
