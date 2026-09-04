import { getArgv } from './argv';

const isDebugEnabled = (): boolean => getArgv().debug || process.env.LOG_LEVEL?.toUpperCase() === 'DEBUG';

const formatLogMessage = (level: string, message: string): string =>
  `[ ${level} ][ ${new Date().toISOString()} ] ${message}`;

export const infoLog = async (message: string): Promise<void> => {
  const formatted = formatLogMessage('info', message);
  if (isDebugEnabled()) console.log(formatted);
};

export const errorLog = async (message: string): Promise<void> => {
  console.error(formatLogMessage('error', message));
};

export const debugLog = async (message: string): Promise<void> => {
  if (!isDebugEnabled()) return;
  console.log(formatLogMessage('debug', message));
};
