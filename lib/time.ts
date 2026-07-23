export const DAILY_TIME_ZONE = "America/New_York";

/** Returns YYYY-MM-DD for the calendar date in New York, including DST. */
export function newYorkDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DAILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
