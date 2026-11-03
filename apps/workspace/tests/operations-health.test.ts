import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backupCopyStatus,
  backupDate,
  backupSize,
  latestBackup,
  type BackupRun,
} from "../src/lib/operations-health";
const run: BackupRun = {
  id: "fixture",
  status: "primary",
  created_at: "2026-11-03T09:30:00Z",
};
test("Drive health requires a complete state and a verified copy receipt", () => {
  assert.equal(backupCopyStatus(run, "primary").label, "Verified");
  assert.equal(backupCopyStatus(run, "drive").label, "Copy pending");
  assert.notEqual(
    backupCopyStatus({ ...run, status: "complete" }, "drive").tone,
    "success",
  );
  assert.equal(
    backupCopyStatus(
      { ...run, status: "complete", drive_verified: true },
      "drive",
    ).tone,
    "success",
  );
  assert.equal(
    backupCopyStatus(
      { ...run, status: "failed", drive_verified: true },
      "drive",
    ).tone,
    "warning",
  );
  assert.equal(
    backupCopyStatus({ ...run, status: "running" }, "primary").label,
    "Creating backup",
  );
  assert.equal(backupCopyStatus(null, "drive").label, "Not yet verified");
});
test("backup dates are Abuja-local and missing measurements are not reported as zero", () => {
  assert.match(backupDate("2026-11-03T23:30:00Z"), /4 Nov 2026.*00:30/);
  assert.equal(backupDate("not-a-date"), "Not available");
  assert.equal(backupSize(null), "—");
  assert.equal(backupSize(0), "0 B");
  assert.equal(backupSize(1024), "1.0 KB");
  assert.equal(backupSize(1024 * 1024), "1.0 MB");
});
test("current backup status never substitutes an older successful Drive copy", () => {
  const data = {
    health: { latest_backup: run },
    backup_runs: [{ ...run, status: "failed" }],
    latest_drive: { ...run, status: "complete", drive_verified: true },
  };
  assert.equal(latestBackup(data)?.status, "failed");
  assert.equal(backupCopyStatus(latestBackup(data), "drive").tone, "warning");
});
