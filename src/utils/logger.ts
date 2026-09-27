type LogFields = Record<string, unknown>;

function log(level: 'info' | 'warn' | 'error', message: string, fields: LogFields = {}) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...fields,
  };

  console[level === 'error' ? 'error' : level](JSON.stringify(payload));
}

export const logger = {
  info: (message: string, fields?: LogFields) => log('info', message, fields),
  warn: (message: string, fields?: LogFields) => log('warn', message, fields),
  error: (message: string, fields?: LogFields) => log('error', message, fields),
};
