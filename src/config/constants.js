/**
 * Application Constants
 * Centralized location for all constant values used throughout the application
 */

/**
 * Status constants for different entities
 */
export const STATUS = {
  COLLECTOR: {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    ON_DUTY: 'On Duty',
    OFF_DUTY: 'Off Duty',
    ASSIGNED: 'Assigned',
  },
  ILLEGAL_DUMPING: {
    // Database constraint: status IN ('pending', 'verified', 'in_progress', 'completed')
    REPORTED: 'pending',
    VERIFIED: 'verified',
    CLEANUP_SCHEDULED: 'in_progress',
    CLEANED_UP: 'completed',
    // Note: No 'cancelled' in DB constraint - use 'completed' when updating DB
    // but keep unique display value for UI keys
    CANCELLED: 'cancelled',
  },
  ALERT: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
  },
  PICKUP_REQUEST: {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    SCHEDULED: 'Scheduled',
  },
  BAG: {
    GENERATED: 'Generated',
    DISTRIBUTED: 'Distributed',
    FILLED: 'Filled',
    COLLECTED: 'Collected',
    PROCESSED: 'Processed',
  },
};

/**
 * Log level constants
 */
export const LOG_LEVEL = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

/**
 * Log source constants
 */
export const LOG_SOURCE = {
  SYSTEM: 'System',
  USER: 'User',
  API: 'API',
  DATABASE: 'Database',
  AUTH: 'Authentication',
};

/**
 * Priority levels
 */
export const PRIORITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/**
 * Severity levels for illegal dumping
 */
export const SEVERITY = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/**
 * Waste type categories
 */
export const WASTE_TYPE = {
  MIXED: 'Mixed',
  HOUSEHOLD: 'Household',
  CONSTRUCTION: 'Construction',
  ELECTRONIC: 'Electronic',
  HAZARDOUS: 'Hazardous',
  GREEN: 'Green',
};

/**
 * Bag types
 */
export const BAG_TYPE = {
  GENERAL: 'General',
  RECYCLABLE: 'Recyclable',
  COMPOST: 'Compost',
};

/**
 * Bag sizes
 */
export const BAG_SIZE = {
  SMALL: 'Small',
  MEDIUM: 'Medium',
  LARGE: 'Large',
};

/**
 * Identifier prefixes
 */
export const ID_PREFIX = {
  BAG: 'TD-BAG',
  BATCH: 'TD-BATCH',
  COLLECTOR: 'TD-COL',
  REPORT: 'TD-REP',
  ALERT: 'TD-ALERT',
};

/**
 * Time periods for analytics
 */
export const TIME_PERIOD = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
};

/**
 * Table pagination options
 */
export const PAGINATION = {
  OPTIONS: [10, 25, 50, 100],
  DEFAULT: 25,
};

/**
 * All application constants grouped
 */
export const APP_CONSTANTS = {
  STATUS,
  LOG_LEVEL,
  LOG_SOURCE,
  PRIORITY,
  SEVERITY,
  WASTE_TYPE,
  BAG_TYPE,
  BAG_SIZE,
  ID_PREFIX,
  TIME_PERIOD,
  PAGINATION,
};

export default APP_CONSTANTS;
