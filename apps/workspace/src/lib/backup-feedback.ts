export type BackupResult = {
  configured: boolean;
  primary_created?: boolean;
  offsite_pending?: number;
  latest?: {
    id: string;
    day: string;
    status: string;
    created_at: string;
    bytes: number | null;
    file_count: number | null;
  } | null;
};
export function backupFeedback(
  result: BackupResult,
  day = new Date().toISOString().slice(0, 10),
): { tone: "success" | "info" | "error"; title: string; message: string } {
  if (!result.configured)
    return {
      tone: "error",
      title: "Backup not configured",
      message:
        "Backup encryption is not configured. Complete the company backup setup before relying on scheduled copies.",
    };
  const pending = Number(result.offsite_pending || 0) > 0;
  const latest = result.latest;
  if (result.primary_created)
    return {
      tone: "success",
      title: "Backup saved to Supabase",
      message:
        "Your encrypted primary backup was created and verified." +
        (pending
          ? " The Google Drive copy is still pending."
          : " Check the latest Drive receipt in backup health."),
    };
  if (latest?.day === day && ["primary", "complete"].includes(latest.status))
    return {
      tone: "success",
      title: "Today's backup already exists",
      message:
        "A verified primary backup already exists for today; no duplicate was created." +
        (latest.status === "complete"
          ? " Its Google Drive copy has a recorded receipt."
          : " Its Google Drive copy is still pending."),
    };
  if (latest?.status === "running")
    return {
      tone: "info",
      title: "Backup already running",
      message:
        "Another backup is still processing. Check the latest status before trying again.",
    };
  return {
    tone: "info",
    title: "Backup status checked",
    message:
      "This request did not create a new backup. Review the latest backup date and status in Operations health before relying on it.",
  };
}
