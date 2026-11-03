export type BackupRun = {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string;
  bytes?: number | null;
  file_count?: number | null;
  drive_verified?: boolean;
  last_error?: string;
};
export type AutomationSettings = {
  id: number;
  version: number;
  invoice_reminders: boolean;
  maintenance_reminders: boolean;
  enquiry_reminders: boolean;
  warranty_reminders: boolean;
  visit_reminders: boolean;
  delivery_notices: boolean;
  interval_days: number;
};
export type OperationsHealth = {
  automation: AutomationSettings;
  health: Record<string, unknown>;
  backup_runs?: BackupRun[];
  latest_primary?: BackupRun | null;
  latest_drive?: BackupRun | null;
};
export type HealthStatus = {
  label: string;
  tone: "success" | "warning" | "danger" | "brand" | "neutral";
};
export function backupCopyStatus(
  run: BackupRun | null | undefined,
  destination: "primary" | "drive",
): HealthStatus {
  if (!run) return { label: "Not yet verified", tone: "neutral" };
  if (run.status === "failed")
    return destination === "primary"
      ? { label: "Failed", tone: "danger" }
      : { label: "Not copied", tone: "warning" };
  if (run.status === "running")
    return destination === "primary"
      ? { label: "Creating backup", tone: "brand" }
      : { label: "Waiting for backup", tone: "neutral" };
  const primary = run.status === "primary" || run.status === "complete";
  if (destination === "primary" && primary)
    return { label: "Verified", tone: "success" };
  if (
    destination === "drive" &&
    run.status === "complete" &&
    run.drive_verified
  )
    return { label: "Verified", tone: "success" };
  if (destination === "drive" && primary && run.last_error)
    return { label: "Copy failed", tone: "danger" };
  return {
    label:
      destination === "drive" && primary ? "Copy pending" : "Not yet verified",
    tone: primary ? "warning" : "neutral",
  };
}
export function backupDate(value: unknown): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function backupSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0 || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / (bytes < 1024 * 1024 ? 1024 : 1024 * 1024)).toFixed(1)} ${bytes < 1024 * 1024 ? "KB" : "MB"}`;
}
export function latestBackup(
  data: Pick<OperationsHealth, "health" | "backup_runs">,
): BackupRun | null {
  const value = data.backup_runs?.[0] ?? data.health.latest_backup;
  return value && typeof value === "object" && "status" in value
    ? (value as BackupRun)
    : null;
}
