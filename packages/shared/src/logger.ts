export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createLogger(minLevel: LogLevel = 'info'): Logger {
  const threshold = levels[minLevel];

  function log(level: LogLevel, message: string, meta?: unknown): void {
    if (levels[level] < threshold) {
      return;
    }

    const payload = {
      level,
      message,
      ...(meta === undefined ? {} : { meta })
    };

    console[level === 'debug' ? 'log' : level](JSON.stringify(payload));
  }

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta)
  };
}
