import { errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

export const initializeFolders = () => {
  try {
    const dataFolder = Store.getLastValue('dataFolder');

    if (!existsSync(`${dataFolder}/${FOLDERS.database}`)) {
      const databaseFolder = `${dataFolder}/${FOLDERS.database}`;
      mkdirSync(databaseFolder);
      writeFileSync(`${databaseFolder}/${DATABASE_FILES.users}`, '{}', { encoding: 'utf-8' });
    }
    if (!existsSync(`${dataFolder}/${FOLDERS.store}`)) mkdirSync(`${dataFolder}/${FOLDERS.store}`);
    if (!existsSync(`${dataFolder}/${FOLDERS.logs}`)) mkdirSync(`${dataFolder}/${FOLDERS.logs}`);
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Initialization unknown error (${error.message})`);
    process.exit(1);
  }
};
