import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { encryptBackup, decryptBackup } from "./backup";
import { BACKUP_SCHEDULE, nextScheduledBackup } from "./backup-schedule";

export const BACKUP_FOLDER = "1M5R-up413YeEzlRudOPObu2f258gkktD";
const MAX_BYTES = 32 * 1024 * 1024;
function connection() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY,
    proof = process.env.BUSINESS_JOB_SECRET;
  if (!url || !key || !proof)
    throw new Error("Backup connection is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-lutera-backup-proof": proof } },
  });
}
async function control(c: Record<string, unknown>) {
  const result = await connection().rpc("work_backup_job", {
    proof: process.env.BUSINESS_JOB_SECRET,
    c,
  });
  if (result.error) throw new Error("Backup control request failed.");
  return result.data;
}
export function backupConfiguration() {
  return {
    encrypted_primary_backup: !!process.env.BACKUP_PASSPHRASE,
    automatic_primary_backup_configured: !!(
      process.env.BACKUP_PASSPHRASE &&
      process.env.CRON_SECRET &&
      process.env.BUSINESS_JOB_SECRET &&
      process.env.SUPABASE_URL &&
      process.env.SUPABASE_PUBLISHABLE_KEY
    ),
    primary_backup_schedule: BACKUP_SCHEDULE,
    next_scheduled_primary_backup: new Date(
      nextScheduledBackup(),
    ).toLocaleString("en-NG", {
      timeZone: "Africa/Lagos",
      dateStyle: "medium",
      timeStyle: "short",
    }),
    drive_copy_connection: !!process.env.DRIVE_BACKUP_SECRET,
  };
}
export async function runBusinessBackup() {
  const password = process.env.BACKUP_PASSPHRASE;
  if (!password) return { configured: false };
  const db = connection();
  const started = (await control({ action: "begin" })) as null | {
    id: string;
    path: string;
    snapshot: Record<string, unknown>;
    files: { bucket: string; path: string }[];
  };
  if (started) {
    try {
      let total = Buffer.byteLength(JSON.stringify(started.snapshot));
      const files: {
        bucket: string;
        path: string;
        data: string;
        sha256: string;
      }[] = [];
      for (const file of started.files) {
        const result = await db.storage.from(file.bucket).download(file.path);
        if (result.error || !result.data)
          throw new Error("A referenced private file could not be backed up.");
        const bytes = Buffer.from(await result.data.arrayBuffer());
        total += Math.ceil((bytes.length * 4) / 3);
        if (total > MAX_BYTES)
          throw new Error(
            "Backup exceeds the configured 32 MB safety limit. Arrange a streaming backup before increasing this limit.",
          );
        files.push({
          ...file,
          data: bytes.toString("base64"),
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
      const snapshot = { ...started.snapshot, storage_files: files };
      if (total > MAX_BYTES)
        throw new Error("Backup exceeds its configured safety limit.");
      const encrypted = await encryptBackup(snapshot, password);
      // Verify authenticated decryption before recording the primary copy.
      const verified = await decryptBackup(encrypted, password);
      if (verified.storage_files.length !== files.length)
        throw new Error("Backup verification failed.");
      const sha256 = createHash("sha256").update(encrypted).digest("hex");
      const uploaded = await db.storage
        .from("work-backups")
        .upload(started.path, encrypted, {
          contentType: "application/octet-stream",
          upsert: false,
        });
      if (uploaded.error) throw new Error("Primary backup upload failed.");
      await control({
        action: "primary",
        id: started.id,
        sha256,
        bytes: encrypted.length,
        file_count: files.length,
      });
    } catch (e) {
      await control({ action: "failure", id: started.id, stage: "primary" });
      throw e;
    }
  }
  const pending = (await control({ action: "pending" })) as {
    id: string;
    path: string;
    sha256: string;
  }[];
  return {
    configured: true,
    primary_created: !!started,
    offsite_pending: pending.length,
    copy_method:
      "Company Google Apps Script; confirm the Drive copy status in Backups & recovery.",
  };
}
