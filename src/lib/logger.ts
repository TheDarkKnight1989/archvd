/**
 * Server-side logging utility
 * Logs to console in development, can be extended for production (Sentry, Supabase logs, etc.)
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext) {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatMessage('error', message, context));
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }

  /**
   * Log API request with duration
   */
  apiRequest(endpoint: string, params: LogContext, duration: number, extra?: LogContext) {
    this.info(`API ${endpoint}`, {
      ...params,
      duration_ms: duration,
      ...extra,
    });
  }
}

export const logger = new Logger();
