import '@testing-library/jest-dom/vitest';
import Module, { createRequire } from 'module';
import fs from 'node:fs';
import path from 'node:path';
import { TextDecoder, TextEncoder } from 'node:util';
import ts from 'typescript';
import { vi } from 'vitest';

(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;
(globalThis as any).Uint8Array = Uint8Array;

if (typeof window !== 'undefined' && window.location) {
  try {
    window.location.assign = vi.fn();
  } catch {
    //
  }
}

const requireFn = createRequire(import.meta.url);
const tsconfig = requireFn('./tsconfig.json');
const baseUrl = path.resolve(__dirname, tsconfig?.compilerOptions?.baseUrl ?? '.');

const tryResolvePath = (candidate: string): string | null => {
  const candidates = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    `${candidate}.js`,
    `${candidate}.mjs`,
    `${candidate}.cjs`,
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }
  for (const dirPath of candidates) {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const indexCandidate = tryResolvePath(path.join(dirPath, 'index'));
      if (indexCandidate) {
        return indexCandidate;
      }
    }
  }
  return null;
};

const resolveWithPaths = (request: string): string => {
  const paths: Record<string, string[]> = tsconfig?.compilerOptions?.paths ?? {};
  for (const [alias, targets] of Object.entries(paths)) {
    if (alias.endsWith('/*')) {
      const prefix = alias.slice(0, -2);
      if (!request.startsWith(prefix)) {
        continue;
      }
      const suffix = request.slice(prefix.length);
      for (const target of targets) {
        const mapped = target.replace('*', suffix);
        const resolved = tryResolvePath(path.resolve(baseUrl, mapped));
        if (resolved) {
          return resolved;
        }
      }
      continue;
    }

    if (request === alias) {
      for (const target of targets) {
        const resolved = tryResolvePath(path.resolve(baseUrl, target));
        if (resolved) {
          return resolved;
        }
      }
    }
  }
  return request;
};

const aliasedRequire: NodeJS.Require = ((id: string) => requireFn(resolveWithPaths(id))) as unknown as NodeJS.Require;
(aliasedRequire as any).resolve = (id: string) => requireFn.resolve(resolveWithPaths(id));
(aliasedRequire as any).cache = requireFn.cache;
(aliasedRequire as any).main = requireFn.main;

const moduleExtensions = Module as unknown as typeof Module & {
  _extensions: Record<string, (module: any, filename: string) => any>;
  _resolveFilename: (...args: any[]) => any;
};

(aliasedRequire as any).extensions = moduleExtensions._extensions;

const originalResolveFilename = moduleExtensions._resolveFilename.bind(Module);
moduleExtensions._resolveFilename = (request, parent, isMain, options) => {
  const mapped = resolveWithPaths(request as string);
  return originalResolveFilename(mapped, parent, isMain, options);
};

// Allow require() to load TypeScript files via a lightweight TypeScript transpile.
moduleExtensions._extensions['.ts'] = (module: any, filename: string) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      sourceMap: true,
      inlineSources: true,
    },
    fileName: filename,
  });
  module._compile(outputText, filename);
};
