import { getArgv } from './argv/argv';
import { FOLDERS } from './main-const';
import dayjs from 'dayjs';
import { appendFile } from 'fs/promises';

const getLogFileName = (): string => `log-${dayjs().format('YYYY-MM-DD')}.txt`;

const isDebugEnabled = (): boolean => {
  const { debug } = getArgv();
  return debug || process.env.LOG_LEVEL?.toUpperCase() === 'DEBUG';
};

const formatLogMessage = (level: string, message: string): string =>
  `[ ${level} ][ ${dayjs().toISOString()} ] ${message}`;

const writeLog = async (message: string): Promise<void> => {
  const { dataFolder } = getArgv();
  try {
    await appendFile(`${dataFolder}/${FOLDERS.logs}/${getLogFileName()}`, `${message}\n`, { encoding: 'utf-8' });
  } catch {
    // log write failures must not propagate
  }
};

const infoLog = async (message: string): Promise<void> => {
  const formatted = formatLogMessage('info', message);
  if (isDebugEnabled()) console.log(formatted);
  await writeLog(formatted);
};

const warningLog = async (message: string): Promise<void> => {
  const formatted = formatLogMessage('warning', message);
  if (isDebugEnabled()) console.log(formatted);
  await writeLog(formatted);
};

const errorLog = async (message: string): Promise<void> => {
  const formatted = formatLogMessage('error', message);
  if (isDebugEnabled()) console.log(formatted);
  await writeLog(formatted);
};

const debugLog = async (message: string): Promise<void> => {
  if (!isDebugEnabled()) return;
  const formatted = formatLogMessage('debug', message);
  console.log(formatted);
  await writeLog(formatted);
};

export { debugLog, errorLog, infoLog, warningLog };
