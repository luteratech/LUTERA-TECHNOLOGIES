export const BACKUP_CRON = "0 7 * * 1";
export const BACKUP_SCHEDULE =
  "Every Monday at 08:00 Africa/Lagos (every 7 days)";
export function nextScheduledBackup(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(7, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + ((1 - next.getUTCDay() + 7) % 7));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 7);
  return next.toISOString();
}
