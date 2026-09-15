import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { FileLogger, FileLoggerConfig } from '../models/file-logger-model';

const formatLogMessage = (level: string, message: string, label?: string): string => {
  const sanitized = message.replace(/[\r\n]/g, ' ');
  const timestamp = new Date().toISOString();
  return label ? `[ ${level} ][ ${timestamp} ][ ${label} ] ${sanitized}` : `[ ${level} ][ ${timestamp} ] ${sanitized}`;
};

export const createFileLogger = (config: FileLoggerConfig): FileLogger => {
  const writeLog = async (message: string): Promise<void> => {
    try {
      const directory = join(config.getDataFolder(), 'logs');
      await mkdir(directory, { recursive: true });
      await appendFile(
        join(directory, `${config.filePrefix}-${new Date().toISOString().slice(0, 10)}.txt`),
        `${message}\n`,
        'utf8'
      );
    } catch {
      // Logging failures must not fail requests.
    }
  };

  const persist = async (level: string, message: string, echo?: (formatted: string) => void): Promise<void> => {
    const formatted = formatLogMessage(level, message, config.label);
    echo?.(formatted);
    await writeLog(formatted);
  };

  return {
    infoLog: async (message) => {
      await persist('info', message, config.isDebugEnabled() ? (formatted) => console.log(formatted) : undefined);
    },
    warningLog: async (message) => {
      await persist('warning', message, config.isDebugEnabled() ? (formatted) => console.log(formatted) : undefined);
    },
    errorLog: async (message) => {
      await persist('error', message, (formatted) => console.error(formatted));
    },
    debugLog: async (message) => {
      if (!config.isDebugEnabled()) return;
      await persist('debug', message, (formatted) => console.log(formatted));
    },
  };
};
