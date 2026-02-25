import { getArgv } from '@server/core/argv/argv';
import { FOLDERS } from '@server/core/main-const';
import dayjs from 'dayjs';
import { appendFile } from 'fs/promises';

const getLogFileName = (): string => `log-${dayjs().format('YYYY-MM-DD')}.txt`;

const writeLog = async (message: string): Promise<void> => {
  const { dataFolder } = getArgv();
  await appendFile(`${dataFolder}/${FOLDERS.logs}/${getLogFileName()}`, `${message}\n`, { encoding: 'utf-8' });
};

const infoLog = async (message: string): Promise<void> => {
  const { debug } = getArgv();
  message = `[ info ] ${message}`;
  if (debug) console.log(message);
  await writeLog(message);
};

const errorLog = async (message: string): Promise<void> => {
  const { debug } = getArgv();
  message = `[ error ] ${message}`;
  if (debug) console.log(message);
  await writeLog(message);
};

const debugLog = async (message: string): Promise<void> => {
  const { debug } = getArgv();
  if (!debug) return;
  message = `[ debug ] ${message}`;
  console.log(message);
  await writeLog(message);
};

export { debugLog, errorLog, infoLog };
