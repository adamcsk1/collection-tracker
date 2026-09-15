import { createFileLogger } from '@node/utils/file-logger';
import { getArgv } from './argv';

const { debugLog, errorLog, infoLog } = createFileLogger({
  getDataFolder: () => getArgv().dataFolder,
  isDebugEnabled: () => getArgv().debug || process.env.LOG_LEVEL?.toUpperCase() === 'DEBUG',
  filePrefix: 'metadata-provider',
  label: 'metadata-provider',
});

export { debugLog, errorLog, infoLog };
