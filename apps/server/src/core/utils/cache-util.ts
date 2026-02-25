import { debugLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { unlink, writeFile } from 'fs/promises';

export const removeItem = async (fileName: string, folderName: string): Promise<void> => {
  void debugLog(`Removing item (${fileName}) from folder (${folderName})`);
  const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${folderName}`;
  await unlink(`${storeFolder}/${fileName}`);
  const cache = Store.getLastValue('cache');
  const checkKey = `${folderName}-${fileName}`;
  delete cache[checkKey];
  Store.set('cache', cache);
};

export const updateItem = async (fileName: string, folderName: string, content: string): Promise<void> => {
  void debugLog(`Updating item (${fileName}) in folder (${folderName})`);
  const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${folderName}`;
  await writeFile(`${storeFolder}/${fileName}`, content, { encoding: 'utf-8' });
  const cache = Store.getLastValue('cache');
  const checkKey = `${folderName}-${fileName}`;
  cache[checkKey] = content;
  Store.set('cache', cache);
};
