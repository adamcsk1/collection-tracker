import { createFileLogger } from '@node/utils/file-logger';
import { getArgv } from './argv/argv';

const { debugLog, errorLog, infoLog, warningLog } = createFileLogger({
  getDataFolder: () => getArgv().dataFolder,
  isDebugEnabled: () => getArgv().debug || process.env.LOG_LEVEL?.toUpperCase() === 'DEBUG',
  filePrefix: 'log',
});

export { debugLog, errorLog, infoLog, warningLog };
