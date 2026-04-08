import { hashText } from '../crypto';
import { debugLog } from '../logger';
import { FOLDERS } from '../main-const';
import { Store } from '../store/store';
import { existsSync } from 'fs';
import { readdir, readFile, unlink, writeFile } from 'fs/promises';

const hashFilePath = (storeFolder: string, fileName: string): string => `${storeFolder}/${fileName}.hash`;

const hashMemoryKey = (usernameHash: string, fileName: string): string => `${usernameHash}-${fileName}`;

export const getMemoryHash = (usernameHash: string, fileName: string): string | undefined =>
  Store.getLastValue('fileHashes')[hashMemoryKey(usernameHash, fileName)];

export const hashFileExists = (storeFolder: string, fileName: string): boolean =>
  existsSync(hashFilePath(storeFolder, fileName));

export const setFileHash = async (
  storeFolder: string,
  usernameHash: string,
  fileName: string,
  content: string
): Promise<string> => {
  const hash = hashText(content);
  await writeFile(hashFilePath(storeFolder, fileName), hash, { encoding: 'utf-8' });
  const fileHashes = Store.getLastValue('fileHashes');
  fileHashes[hashMemoryKey(usernameHash, fileName)] = hash;
  Store.set('fileHashes', fileHashes);
  return hash;
};

export const removeFileHash = async (storeFolder: string, usernameHash: string, fileName: string): Promise<void> => {
  const hashPath = hashFilePath(storeFolder, fileName);
  if (existsSync(hashPath)) {
    await unlink(hashPath);
  }
  const fileHashes = Store.getLastValue('fileHashes');
  delete fileHashes[hashMemoryKey(usernameHash, fileName)];
  Store.set('fileHashes', fileHashes);
};

export const initializeFileHashes = async (): Promise<void> => {
  const dataFolder = Store.getLastValue('dataFolder');
  const storeFolderPath = `${dataFolder}/${FOLDERS.store}`;

  if (!existsSync(storeFolderPath)) return;

  const userFolders = await readdir(storeFolderPath);
  const fileHashes: Record<string, string> = {};

  for (const usernameHash of userFolders) {
    const userFolder = `${storeFolderPath}/${usernameHash}`;
    const files = await readdir(userFolder);
    const mdFiles = files.filter((fileName) => fileName.endsWith('.md'));

    for (const fileName of mdFiles) {
      const hashPath = hashFilePath(userFolder, fileName);
      let hash: string;

      if (existsSync(hashPath)) {
        hash = await readFile(hashPath, 'utf-8');
      } else {
        const content = await readFile(`${userFolder}/${fileName}`, 'utf-8');
        hash = hashText(content);
        await writeFile(hashPath, hash, { encoding: 'utf-8' });
        void debugLog(`Created missing hash for ${usernameHash}/${fileName}`);
      }

      fileHashes[hashMemoryKey(usernameHash, fileName)] = hash;
    }
  }

  Store.set('fileHashes', fileHashes);
};
