/** Duration formatting and DB timestamp parsing utilities. */

/**
 * Parse a DB timestamp that may be a Date (from driver) or string (SQLite).
 * SQLite stores UTC timestamps without `Z` suffix — parsing as local time
 * would be wrong. This function normalizes both cases to ms since epoch.
 */
export function parseDbTimestamp(value: Date | string): number {
  if (value instanceof Date) return value.getTime();
  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value.replace(" ", "T")}Z`).getTime();
}

/**
 * Format a millisecond duration as a short human-readable string.
 *
 * Examples: 500 → "1s", 65000 → "1m 5s", 3700000 → "1h 1m"
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";

  const totalSeconds = Math.max(1, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}
