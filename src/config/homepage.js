/**
 * Homepage settings. Everything here is shown to the public.
 */

const num = (v, fallback) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : fallback);

// The map's "Cleanup rate" and "Avg response" tiles stay hidden until the live
// numbers reach these. Override per deploy with the REACT_APP_ variables.
export const PUBLIC_STAT_THRESHOLDS = {
  minCleanupRatePct: num(process.env.REACT_APP_MIN_CLEANUP_RATE_PCT, 50),
  maxAvgResponseDays: num(process.env.REACT_APP_MAX_AVG_RESPONSE_DAYS, 7),
};
