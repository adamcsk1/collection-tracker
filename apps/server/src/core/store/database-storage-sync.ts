import { debugLog, errorLog } from '@server/core/logger';
import { DATABASE_FILES, FOLDERS } from '@server/core/main-const';
import { StoreModel } from '@server/core/store/store-model';
import { dequal } from 'dequal';
import { writeFileSync } from 'fs';
import { debounceTime, filter, map, pairwise, tap } from 'rxjs';

(global.__serverStorage as StoreModel).users
  .pipe(
    pairwise(),
    filter(([previousUsers, nextUsers]) => !dequal(previousUsers, nextUsers)),
    map(([, nextUsers]) => nextUsers),
    tap(() => debugLog('Users changed')),
    debounceTime(2500)
  )
  .subscribe((users) => {
    try {
      debugLog('Users storage sync started');
      writeFileSync(
        `${global.__serverStorage.dataFolder.value}/${FOLDERS.database}/${DATABASE_FILES.users}`,
        JSON.stringify(users, null, 2),
        { encoding: 'utf-8' }
      );
      debugLog('Users synced');
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Users storage sync error (${error.message})`);
    }
  });

(global.__serverStorage as StoreModel).parserConfigs
  .pipe(
    pairwise(),
    filter(([previousParserConfigs, nextParserConfigs]) => !dequal(previousParserConfigs, nextParserConfigs)),
    map(([, nextParserConfigs]) => nextParserConfigs),
    tap(() => debugLog('Parser configs changed')),
    debounceTime(2500)
  )
  .subscribe((parserConfigs) => {
    try {
      debugLog('Parser configs storage sync started');
      writeFileSync(
        `${global.__serverStorage.dataFolder.value}/${FOLDERS.database}/${DATABASE_FILES.parserConfigs}`,
        JSON.stringify(parserConfigs, null, 2),
        { encoding: 'utf-8' }
      );
      debugLog('Parser configs synced');
    } catch (error: unknown) {
      if (error instanceof Error) errorLog(`Parser configs storage sync error (${error.message})`);
    }
  });
