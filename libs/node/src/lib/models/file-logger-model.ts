export interface FileLoggerConfig {
  getDataFolder: () => string;
  isDebugEnabled: () => boolean;
  filePrefix: string;
  label?: string;
}

export interface FileLogger {
  infoLog: (message: string) => Promise<void>;
  warningLog: (message: string) => Promise<void>;
  errorLog: (message: string) => Promise<void>;
  debugLog: (message: string) => Promise<void>;
}
