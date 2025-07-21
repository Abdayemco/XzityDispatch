import { DateTime } from "luxon";

/**
 * Convert a UTC ISO string to a local time string for a given IANA time zone
 * Example: utcToLocal("2025-07-21T17:05:00.000Z", "Asia/Kolkata")
 */
export function utcToLocal(utcString: string, timeZone: string): string {
  // utcString must be in ISO format, timeZone must be IANA string
  if (!utcString || !timeZone) return utcString;
  const dt = DateTime.fromISO(utcString, { zone: "utc" });
  return dt.setZone(timeZone).toFormat("yyyy-MM-dd HH:mm:ss");
}

/**
 * Convert a local time string (and time zone) to UTC ISO string
 * Example: localToUTC("2025-07-21T19:05", "Asia/Kolkata")
 */
export function localToUTC(localString: string, timeZone: string): string {
  if (!localString || !timeZone) return localString;
  const dt = DateTime.fromISO(localString, { zone: timeZone });
  return dt.toUTC().toISO();
}