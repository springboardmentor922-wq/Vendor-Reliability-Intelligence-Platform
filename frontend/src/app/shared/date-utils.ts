/**
 * Formats a `Date` as `YYYY-MM-DD` in local time.
 *
 * `toISOString()` converts to UTC first, which shifts the calendar day for
 * anyone east or west of Greenwich — a date picked as the 3rd can arrive at
 * the API as the 2nd. These are plain calendar dates, so local parts are used.
 */
export function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}
