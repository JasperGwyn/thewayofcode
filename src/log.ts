/**
 * Logger utility for consistent logging throughout the application
 */

export interface Logger {
  info: (_message: string, ..._args: unknown[]) => void;
  warn: (_message: string, ..._args: unknown[]) => void;
  error: (_message: string, ..._args: unknown[]) => void;
}

const createLogger = (prefix: string = '[BreakTimer]'): Logger => {
  const formatMessage = (level: string, message: string): string => {
    const timestamp = new Date().toISOString();
    return `${timestamp} ${prefix} ${level}: ${message}`;
  };

  return {
    info: (message: string, ...args: unknown[]): void => {
      console.log(formatMessage('INFO', message), ...args);
    },
    warn: (message: string, ...args: unknown[]): void => {
      console.warn(formatMessage('WARN', message), ...args);
    },
    error: (message: string, ...args: unknown[]): void => {
      console.error(formatMessage('ERROR', message), ...args);
    },
  };
};

export const logger = createLogger();
