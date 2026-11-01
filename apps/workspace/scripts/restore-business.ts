/** Offline recovery into a fresh, isolated, migrated database. Never connects to
 * a database itself. An operator must recreate approved Auth users and provide
 * their old→new UUID map before importing this SQL and the private bucket files.
 * Password arrives on stdin; plaintext files are written with mode 0600.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { decryptBackup } from "../src/lib/backup";
export const restoreOrder = [
  "work_settings",
  "work_site_drafts",
  "work_public_site",
  "work_publications",
  "work_members",
  "work_profiles",
  "work_staff",
  "work_grants",
  "work_owner_setup",
  "work_responsibilities",
  "work_signature_profiles",
  "work_document_signatures",
  "work_ledger_accounts",
  "work_ledger_journals",
  "work_ledger_periods",
  "work_customers",
  "work_contacts",
  "work_enquiries",
  "work_opportunities",
  "work_suppliers",
  "work_items",
  "work_documents",
  "work_quotes",
  "work_commercial",
  "work_files",
  "work_payments",
  "work_allocations",
  "work_refunds",
  "work_cases",
  "work_tasks",
  "work_commercial_lines",
  "work_notes",
  "work_stock",
  "work_reservations",
  "work_assets",
  "work_expenses",
  "work_supplier_payments",
  "work_decisions",
  "work_messages",
  "work_bank_lines",
  "work_portal_members",
  "work_portal_shares",
  "work_portal_events",
  "work_offers",
  "work_automation",
  "work_portal_case_shares",
  "work_customer_merges",
  "work_calendar",
  "work_case_service",
  "work_case_templates",
  "work_case_events",
  "work_case_changes",
  "work_locations",
  "work_inspections",
  "work_stock_holds",
  "work_order_progress",
  "work_order_cancellations",
  "work_maintenance_visits",
  "work_supplier_bank",
  "work_cost_allocations",
  "work_operating_policy",
  "work_acceptance_requests",
  "work_portal_evidence",
  "work_shipments",
  "work_approval_rules",
  "work_audit",
];
const literal = (value: unknown) =>
  "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
export function recoverySQL(snapshot: Record<string, unknown>) {
  if (snapshot.format !== "lutera-business-records-v2")
    throw new Error(
      "Use a scheduled v2 business snapshot for this recovery tool.",
    );
  const commands = [
    "BEGIN;",
    "DO $$BEGIN IF current_setting('lutera.isolated_restore',true) IS DISTINCT FROM 'confirmed' THEN RAISE EXCEPTION 'Set lutera.isolated_restore=confirmed only on a fresh isolated restore database';END IF;END;$$;",
    "SET LOCAL session_replication_role='replica';",
  ];
  // The restore target must be empty except for explicit installation seeds.
  commands.push(
    "DO $$BEGIN IF EXISTS(SELECT 1 FROM public.work_documents) OR EXISTS(SELECT 1 FROM public.work_customers) OR EXISTS(SELECT 1 FROM public.work_staff) THEN RAISE EXCEPTION 'Restore target already contains business records';END IF;END;$$;",
  );
  const seedTables = [
    "work_owner_setup", "work_ledger_accounts", "work_ledger_periods",
    "work_settings",
    "work_site_drafts",
    "work_public_site",
    "work_members",
    "work_automation",
    "work_calendar",
    "work_operating_policy",
  ];
  for (const table of seedTables)
    if (Array.isArray(snapshot[table]))
      commands.push(`DELETE FROM public.${table};`);
  for (const table of restoreOrder) {
    if (!Array.isArray(snapshot[table])) continue;
    const records = structuredClone(snapshot[table]) as Record<
      string,
      unknown
    >[];
    for (const row of records) {
      if (table === "work_members" || table === "work_portal_members")
        row.active = false;
      if (table === "work_automation") {
        row.invoice_reminders = false;
        row.maintenance_reminders = false;
        row.enquiry_reminders = false;
        row.warranty_reminders = false;
        row.visit_reminders = false;
        row.delivery_notices = false;
      }
      if (
        table === "work_messages" &&
        ["queued", "sending", "failed"].includes(String(row.status))
      ) {
        row.status = "cancelled";
        row.last_error =
          "Restored snapshot; owner review required before any new communication.";
      }
    }
    commands.push(
      `INSERT INTO public.${table} OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::public.${table},${literal(records)});`,
    );
  }
  for (const table of [
    "work_counters",
    "work_requests",
    "work_ops_requests",
    "work_message_statements",
  ]) {
    const records = snapshot["private." + table];
    if (!Array.isArray(records)) continue;
    commands.push(
      `DELETE FROM private.${table}; INSERT INTO private.${table} SELECT * FROM jsonb_populate_recordset(NULL::private.${table},${literal(records)});`,
    );
  }
  commands.push("SET LOCAL session_replication_role='origin';");
  // Recreate and validate foreign keys: a disabled trigger alone would not
  // prove that a referenced Auth user, line, file or source record was restored.
  commands.push(
    "DO $$DECLARE r record;BEGIN FOR r IN SELECT conrelid::regclass t,conname,pg_get_constraintdef(oid) def FROM pg_constraint WHERE contype='f' AND conrelid IN (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'work\\_%' ESCAPE '\\') LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.t,r.conname);EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s NOT VALID',r.t,r.conname,regexp_replace(r.def,' NOT VALID$',''));EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I',r.t,r.conname);END LOOP;END;$$;",
  );
  commands.push(
    "SELECT setval(pg_get_serial_sequence('public.work_audit','id'),greatest(coalesce((SELECT max(id) FROM public.work_audit),0),1),(SELECT count(*)>0 FROM public.work_audit));",
    "COMMIT;",
  );
  return commands.join("\n");
}
async function main() {
  const [file, output] = process.argv.slice(2);
  if (!file || !output || process.stdin.isTTY)
    throw new Error(
      "Usage: password-manager-command | npx tsx scripts/restore-business.ts FILE.lutera EMPTY_OUTPUT_DIRECTORY",
    );
  let password = "";
  for await (const chunk of process.stdin) password += chunk;
  const snapshot = await decryptBackup(
    await readFile(file),
    password.replace(/\r?\n$/, ""),
  );
  const sql = recoverySQL(snapshot);
  await mkdir(output, { recursive: false, mode: 0o700 });
  await writeFile(path.join(output, "restore.sql"), sql, { mode: 0o600 });
  const files = snapshot.storage_files || [];
  for (const file of files) {
    if (
      ![
        "work-evidence",
        "work-staff",
        "work-avatars",
        "work-portal-evidence",
      ].includes(file.bucket) ||
      !file.path ||
      file.path.startsWith("/") ||
      file.path
        .split("/")
        .some((p: string) => !p || p === "." || p === ".." || p.includes("\\"))
    )
      throw new Error("Unsafe private file path in backup.");
    const target = path.join(output, "storage", file.bucket, file.path);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const bytes = Buffer.from(file.data, "base64");
    const { createHash } = await import("node:crypto");
    if (createHash("sha256").update(bytes).digest("hex") !== file.sha256)
      throw new Error("Private file checksum mismatch.");
    await writeFile(target, bytes, { mode: 0o600 });
  }
  await writeFile(
    path.join(output, "RECOVERY.txt"),
    "Isolated recovery only. Recreate approved Supabase Auth users with matching IDs or review UUID mapping before SQL import. Never restore passwords, sessions, MFA secrets or magic links. All staff/customer access and automated messages start disabled. Upload the private files through the Storage API; do not insert storage metadata without uploading the bytes. Reconfigure worker secrets, verify every count, counter, balance and file checksum, then separately approve access. Do not overwrite production after new transactions.\n",
    { mode: 0o600 },
  );
  console.log(
    "Recovery SQL and verified private files prepared. All restored access and automatic sending are disabled pending owner review.",
  );
}
if (process.argv[1]?.endsWith("restore-business.ts"))
  main().catch(() => {
    console.error(
      "Recovery preparation failed; inspect the backup format, password and empty output directory. No database was changed.",
    );
    process.exitCode = 1;
  });
