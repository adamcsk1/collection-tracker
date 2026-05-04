import { debugLog, errorLog } from '../core/logger';
import { FOLDERS } from '../core/main-const';
import { existsSync, mkdirSync } from 'fs';

export const initializeFolders = (dataFolder: string) => {
  try {
    const databaseFolder = `${dataFolder}/${FOLDERS.database}`;

    if (!existsSync(databaseFolder)) {
      mkdirSync(databaseFolder);
      debugLog(`Created database folder${databaseFolder}`);
    }

    if (!existsSync(`${dataFolder}/${FOLDERS.logs}`)) {
      mkdirSync(`${dataFolder}/${FOLDERS.logs}`);
      debugLog(`Created logs folder in ${dataFolder}/${FOLDERS.logs}`);
    }

    if (!existsSync(`${dataFolder}/${FOLDERS.cache}`)) {
      mkdirSync(`${dataFolder}/${FOLDERS.cache}`);
      debugLog(`Created cache folder in ${dataFolder}/${FOLDERS.cache}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Initialization unknown error (${error.message})`);
    process.exit(1);
  }
};
