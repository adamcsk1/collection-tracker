import { debugLog, errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { Store } from '@server/core/store/store';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

export const initializeFolders = () => {
  try {
    const dataFolder = Store.getLastValue('dataFolder');
    const databaseFolder = `${dataFolder}/${FOLDERS.database}`;

    if (!existsSync(databaseFolder)) {
      mkdirSync(databaseFolder);
      debugLog(`Created database folder${databaseFolder}`);
    }

    const usersFilePath = `${databaseFolder}/${DATABASE_FILES.users}`;
    if (!existsSync(usersFilePath)) {
      writeFileSync(usersFilePath, '{}', { encoding: 'utf-8' });
      debugLog(`Created initial ${usersFilePath} file in ${databaseFolder}`);
    }

    const parserConfigsFilePath = `${databaseFolder}/${DATABASE_FILES.parserConfigs}`;
    if (!existsSync(parserConfigsFilePath)) {
      writeFileSync(parserConfigsFilePath, '{}', { encoding: 'utf-8' });
      debugLog(`Created initial ${parserConfigsFilePath} file in ${databaseFolder}`);
    }

    const tagConfigsFilePath = `${databaseFolder}/${DATABASE_FILES.tagConfigs}`;
    if (!existsSync(tagConfigsFilePath)) {
      writeFileSync(tagConfigsFilePath, '{}', { encoding: 'utf-8' });
      debugLog(`Created initial ${tagConfigsFilePath} file in ${databaseFolder}`);
    }

    const userSettingsFilePath = `${databaseFolder}/${DATABASE_FILES.userSettings}`;
    if (!existsSync(userSettingsFilePath)) {
      writeFileSync(userSettingsFilePath, '{}', { encoding: 'utf-8' });
      debugLog(`Created initial ${userSettingsFilePath} file in ${databaseFolder}`);
    }

    if (!existsSync(`${dataFolder}/${FOLDERS.store}`)) {
      mkdirSync(`${dataFolder}/${FOLDERS.store}`);
      debugLog(`Created store folder in ${dataFolder}/${FOLDERS.store}`);
    }
    if (!existsSync(`${dataFolder}/${FOLDERS.logs}`)) {
      mkdirSync(`${dataFolder}/${FOLDERS.logs}`);
      debugLog(`Created logs folder in ${dataFolder}/${FOLDERS.logs}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error) errorLog(`Initialization unknown error (${error.message})`);
    process.exit(1);
  }
};
