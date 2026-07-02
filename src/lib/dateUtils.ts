/**
 * Centralized IST (Indian Standard Time) date utilities.
 * IST is UTC+5:30 — all admin/reporting dates should use these helpers
 * to ensure consistent timezone handling across the platform.
 */

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Get current Date shifted to IST (for extracting year/month/day in IST) */
export const getISTNow = (): Date => new Date(Date.now() + IST_OFFSET_MS);

/** Format a JS Date as YYYY-MM-DD in IST */
export const formatISTDate = (d: Date): string => {
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** Start of day in IST → UTC Date (00:00:00 IST) */
export const startOfDayIST = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const istMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  return new Date(istMidnight - IST_OFFSET_MS);
};

/** End of day in IST → UTC Date (23:59:59.999 IST) */
export const endOfDayIST = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const istEndOfDay = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  return new Date(istEndOfDay - IST_OFFSET_MS);
};

/** Get IST date string for N days ago from now */
export const getISTDateNDaysAgo = (daysAgo: number): string => {
  const pastDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return formatISTDate(pastDate);
};

/** Get 1st of current month in IST as ISO string (UTC) */
export const getMonthStartISO = (): string => {
  const istNow = getISTNow();
  const monthStartIST = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(monthStartIST - IST_OFFSET_MS).toISOString();
};

/** Get today start in IST as ISO string (UTC) */
export const getTodayStartISO = (): string => {
  return startOfDayIST(formatISTDate(new Date())).toISOString();
};

/** Format local date as YYYY-MM-DD */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
