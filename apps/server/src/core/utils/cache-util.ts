import { debugLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { readdir, readFile, stat, unlink, writeFile } from 'fs/promises';

export const CACHE_MAX = Number(process.env.CACHE_MAX) || 5000;

export const setCacheEntry = (cache: Record<string, string>, key: string, value: string): void => {
  delete cache[key]; // promote to MRU if already present
  cache[key] = value;
  const keys = Object.keys(cache);
  for (let i = 0; i < keys.length - CACHE_MAX; i++) {
    delete cache[keys[i]];
  }
};

export const readStoreFiles = async (
  storeFolder: string,
  usernameHash: string,
  offset?: number,
  limit?: number
): Promise<Array<{ name: string; content: string }>> => {
  const allFiles = await readdir(storeFolder);
  const withStats = await Promise.all(
    allFiles.map(async (fileName) => ({
      fileName,
      birthtimeMs: (await stat(`${storeFolder}/${fileName}`)).birthtimeMs,
    }))
  );

  let sortedFileList = withStats.sort((a, b) => b.birthtimeMs - a.birthtimeMs || b.fileName.localeCompare(a.fileName));
  if (Number.isFinite(offset) && Number.isFinite(limit)) {
    sortedFileList = sortedFileList.slice(offset, offset + limit);
  }
  const fileList = sortedFileList.map(({ fileName }) => fileName);

  const cache = Store.getLastValue('cache');
  const files = await Promise.all(
    fileList.map(async (file) => {
      const cacheKey = `${usernameHash}-${file}`;
      const content = cache[cacheKey] ?? (await readFile(`${storeFolder}/${file}`, 'utf-8'));
      setCacheEntry(cache, cacheKey, content);
      return { name: file, content };
    })
  );
  Store.set('cache', cache);
  return files;
};

export const removeItem = async (fileName: string, folderName: string): Promise<void> => {
  void debugLog(`Removing item (${fileName}) from folder (${folderName})`);
  const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${folderName}`;
  await unlink(`${storeFolder}/${fileName}`);
  const cache = Store.getLastValue('cache');
  delete cache[`${folderName}-${fileName}`];
  Store.set('cache', cache);
};

export const updateItem = async (fileName: string, folderName: string, content: string): Promise<void> => {
  void debugLog(`Updating item (${fileName}) in folder (${folderName})`);
  const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${folderName}`;
  await writeFile(`${storeFolder}/${fileName}`, content, { encoding: 'utf-8' });
  const cache = Store.getLastValue('cache');
  setCacheEntry(cache, `${folderName}-${fileName}`, content);
  Store.set('cache', cache);
};
