/**
 * Logger Utility
 * 
 * Centralized logging that respects environment settings.
 * In production, only errors are logged to prevent console pollution.
 * In development, all logs are shown for debugging.
 * 
 * Usage:
 *   import logger from './utils/logger';
 *   logger.log('Debug message');
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message'); // Always logged
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugEnabled = process.env.REACT_APP_DEBUG === 'true';

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Current log level based on environment
const currentLevel = isDevelopment || isDebugEnabled ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

/**
 * Format log message with timestamp and optional prefix
 */
const formatMessage = (level, ...args) => {
  if (isDevelopment) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return [`[${timestamp}] [${level}]`, ...args];
  }
  return args;
};

const logger = {
  /**
   * Debug level logging - only in development
   */
  debug: (...args) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(...formatMessage('DEBUG', ...args));
    }
  },

  /**
   * General logging - only in development
   * Alias for debug to replace console.log calls
   */
  log: (...args) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(...formatMessage('LOG', ...args));
    }
  },

  /**
   * Info level logging - only in development
   */
  info: (...args) => {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.info(...formatMessage('INFO', ...args));
    }
  },

  /**
   * Warning level logging - only in development
   */
  warn: (...args) => {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(...formatMessage('WARN', ...args));
    }
  },

  /**
   * Error level logging - ALWAYS logged (including production)
   */
  error: (...args) => {
    // Errors are always logged
    console.error(...formatMessage('ERROR', ...args));
  },

  /**
   * Group logging for related messages
   */
  group: (label, fn) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.group(label);
      fn();
      console.groupEnd();
    }
  },

  /**
   * Table logging for structured data
   */
  table: (data) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.table(data);
    }
  },

  /**
   * Time tracking for performance debugging
   */
  time: (label) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.timeEnd(label);
    }
  },

  /**
   * Check if logging is enabled at a specific level
   */
  isEnabled: (level = 'DEBUG') => {
    return currentLevel <= LOG_LEVELS[level];
  },
};

export default logger;

// Named exports for convenience
export const { log, debug, info, warn, error, group, table, time, timeEnd } = logger;
