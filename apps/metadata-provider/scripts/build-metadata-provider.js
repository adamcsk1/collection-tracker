const { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '../../..');
const configuration = process.argv.includes('--configuration=development') ? 'development' : 'production';
const packageJson = require(join(root, 'package.json'));
const dependencyNames = ['dotenv', 'fastify'];

const resolveTsPath = (specifier) => {
  const aliases = [
    ['@node/', 'libs/node/src/lib/'],
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
    build.onResolve({ filter: /^@(shared|node)\// }, (importArgs) => {
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
  const outputPath = join(root, 'dist/apps/metadata-provider');
  rmSync(outputPath, { recursive: true, force: true });
  mkdirSync(outputPath, { recursive: true });

  await esbuild.build({
    entryPoints: [join(root, 'apps/metadata-provider/src/bootstrap.ts')],
    outfile: join(outputPath, 'bootstrap.js'),
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    packages: 'external',
    sourcemap: configuration !== 'production',
    tsconfig: join(root, 'apps/metadata-provider/tsconfig.app.json'),
    plugins: [tsPathAliasPlugin],
  });

  writeFileSync(
    join(outputPath, 'package.json'),
    `${JSON.stringify(
      {
        name: 'collection-tracker-metadata-provider',
        private: true,
        main: 'bootstrap.js',
        dependencies: Object.fromEntries(dependencyNames.map((name) => [name, packageJson.dependencies[name]])),
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
