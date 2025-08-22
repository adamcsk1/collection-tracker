import { debugLog } from '@server/core/logger';
import { FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { unlinkSync, writeFileSync } from 'fs';

export const removeItem = (fileName: string, folderName: string): void => {
  debugLog(`Removing item (${fileName}) from folder (${folderName})`);
  const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${folderName}`;
  unlinkSync(`${storeFolder}/${fileName}`);
  const cache = Store.getLastValue('cache');
  const checkKey = `${folderName}-${fileName}`;
  delete cache[checkKey];
  Store.set('cache', cache);
};

export const updateItem = (fileName: string, folderName: string, content: string): void => {
  debugLog(`Updating item (${fileName}) in folder (${folderName})`);
  const storeFolder = `${Store.getLastValue('dataFolder')}/${FOLDERS.store}/${folderName}`;
  writeFileSync(`${storeFolder}/${fileName}`, content, { encoding: 'utf-8' });
  const cache = Store.getLastValue('cache');
  const checkKey = `${folderName}-${fileName}`;
  cache[checkKey] = content;
  Store.set('cache', cache);
};
