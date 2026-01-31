/**
 * 구조화된 로깅 시스템
 */

export interface LogContext {
  requestId?: string;
  method?: string;
  path?: string;
  duration?: number;
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  private log(level: LogLevel, message: string, context?: LogContext) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    if (this.isDev) {
      const emoji = {
        debug: '🔍',
        info: '📝',
        warn: '⚠️',
        error: '❌',
      }[level];
      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '');
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: error?.message,
      stack: this.isDev ? error?.stack : undefined,
    });
  }
}

export const logger = new Logger();
