import { getArgv } from '@server/core/argv/argv';
import { FOLDERS } from '@server/core/main-const';
import dayjs from 'dayjs';
import { writeFileSync } from 'fs';

const getLogFileName = (): string => `log-${dayjs().format('YYYY-MM-DD')}.txt`;

const writeLog = (message: string): void => {
  const { dataFolder } = getArgv();
  writeFileSync(`${dataFolder}/${FOLDERS.logs}/${getLogFileName()}`, `${message}\n`, { encoding: 'utf-8', flag: 'a' });
};

const infoLog = (message: string): void => {
  const { debug } = getArgv();
  message = `[ info ] ${message}`;
  if (debug) console.log(message);
  writeLog(message);
};

const errorLog = (message: string): void => {
  const { debug } = getArgv();
  message = `[ error ] ${message}`;
  if (debug) console.log(message);
  writeLog(message);
};

const debugLog = (message: string): void => {
  const { debug } = getArgv();
  if (!debug) return;
  message = `[ debug ] ${message}`;
  console.log(message);
  writeLog(message);
};

export { debugLog, errorLog, infoLog };
