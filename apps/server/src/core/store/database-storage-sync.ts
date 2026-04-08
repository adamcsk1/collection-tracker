import { debugLog, errorLog } from '../logger';
import { DATABASE_FILES, FOLDERS } from '../main-const';
import { StoreModel } from './store-model';
import { dequal } from 'dequal';
import { writeFile } from 'fs/promises';
import { debounceTime, filter, map, pairwise, tap } from 'rxjs';

const serverStorage: StoreModel = global.__serverStorage;

serverStorage.users
  .pipe(
    pairwise(),
    filter(([previousUsers, nextUsers]) => !dequal(previousUsers, nextUsers)),
    map(([, nextUsers]) => nextUsers),
    tap(() => void debugLog('Users changed')),
    debounceTime(2500)
  )
  .subscribe(async (users) => {
    try {
      await debugLog('Users storage sync started');
      await writeFile(
        `${serverStorage.dataFolder.value}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );
      await debugLog('Users synced');
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Users storage sync error (${error.message})`);
    }
  });

serverStorage.parserConfigs
  .pipe(
    pairwise(),
    filter(([previousParserConfigs, nextParserConfigs]) => !dequal(previousParserConfigs, nextParserConfigs)),
    map(([, nextParserConfigs]) => nextParserConfigs),
    tap(() => void debugLog('Parser configs changed')),
    debounceTime(2500)
  )
  .subscribe(async (parserConfigs) => {
    try {
      await debugLog('Parser configs storage sync started');
      await writeFile(
        `${serverStorage.dataFolder.value}/${FOLDERS.database}/${DATABASE_FILES.parserConfigs}`,
        JSON.stringify(parserConfigs, null, 2),
        { encoding: 'utf-8' }
      );
      await debugLog('Parser configs synced');
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Parser configs storage sync error (${error.message})`);
    }
  });

serverStorage.tagConfigs
  .pipe(
    pairwise(),
    filter(([previousTagConfigs, nextTagConfigs]) => !dequal(previousTagConfigs, nextTagConfigs)),
    map(([, nextTagConfigs]) => nextTagConfigs),
    tap(() => void debugLog('Tag configs changed')),
    debounceTime(2500)
  )
  .subscribe(async (tagConfigs) => {
    try {
      await debugLog('Tag configs storage sync started');
      await writeFile(
        `${serverStorage.dataFolder.value}/${FOLDERS.database}/${DATABASE_FILES.tagConfigs}`,
        JSON.stringify(tagConfigs, null, 2),
        { encoding: 'utf-8' }
      );
      await debugLog('Tag configs synced');
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`Tag configs storage sync error (${error.message})`);
    }
  });

serverStorage.userSettings
  .pipe(
    pairwise(),
    filter(([previousUserSettings, nextUserSettings]) => !dequal(previousUserSettings, nextUserSettings)),
    map(([, nextUserSettings]) => nextUserSettings),
    tap(() => void debugLog('User settings changed')),
    debounceTime(2500)
  )
  .subscribe(async (userSettings) => {
    try {
      await debugLog('User settings storage sync started');
      await writeFile(
        `${serverStorage.dataFolder.value}/${FOLDERS.database}/${DATABASE_FILES.userSettings}`,
        JSON.stringify(userSettings, null, 2),
        { encoding: 'utf-8' }
      );
      await debugLog('User settings synced');
    } catch (error: unknown) {
      if (error instanceof Error) void errorLog(`User settings storage sync error (${error.message})`);
    }
  });
