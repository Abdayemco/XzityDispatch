import { DateTime } from "luxon";

/**
 * Converts an ISO string or Date in UTC to a formatted string in the destination time zone.
 * @param utcISO ISO string or Date in UTC
 * @param zone IANA time zone string, e.g. "Africa/Cairo"
 * @param format Format string, e.g. "yyyy-MM-dd HH:mm"
 * @returns formatted string in local time zone
 */
export function utcToLocal(
  utcISO: string | Date,
  zone: string,
  format = "yyyy-MM-dd HH:mm"
): string {
  return DateTime.fromISO(typeof utcISO === "string" ? utcISO : utcISO.toISOString(), { zone: "utc" })
    .setZone(zone)
    .toFormat(format);
}