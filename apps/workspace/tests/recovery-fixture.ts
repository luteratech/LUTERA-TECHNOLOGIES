import { readFile, writeFile } from "node:fs/promises";
import { recoverySQL } from "../scripts/restore-business";
import { encryptBackup, decryptBackup } from "../src/lib/backup";
import assert from "node:assert/strict";
async function main() {
  const [source, output] = process.argv.slice(2);
  const snapshot = JSON.parse(await readFile(source, "utf8"));
  const bytes = await encryptBackup(snapshot, "RESTORE-FIXTURE-PASSWORD-123!");
  const restored = await decryptBackup(bytes, "RESTORE-FIXTURE-PASSWORD-123!");
  assert.deepEqual(restored, snapshot);
  const users = snapshot.work_members
    .filter((r: { user_id: string }) => r.user_id)
    .map((r: { user_id: string; email: string }) => ({
      id: r.user_id,
      email: r.email,
      email_confirmed_at: new Date().toISOString(),
    }));
  const seed =
    "INSERT INTO auth.users SELECT * FROM jsonb_populate_recordset(NULL::auth.users,'" +
    JSON.stringify(users).replaceAll("'", "''") +
    "'::jsonb);\n";
  const expected = {
    customers: snapshot.work_customers.length,
    payments: snapshot.work_payments.length,
    invoices: snapshot.work_commercial.filter(
      (r: { kind: string }) => r.kind === "invoice",
    ).length,
    stock: snapshot.work_stock.length,
    counters: snapshot["private.work_counters"].length,
  };
  const legacyCompatible = structuredClone(snapshot);
  if (legacyCompatible.work_members.length) delete legacyCompatible.work_members[0].roles;
  const check = `DO $$BEGIN IF (SELECT count(*) FROM public.work_customers)<>${expected.customers} OR (SELECT count(*) FROM public.work_payments)<>${expected.payments} OR (SELECT count(*) FROM public.work_commercial WHERE kind='invoice')<>${expected.invoices} OR (SELECT count(*) FROM public.work_stock)<>${expected.stock} OR (SELECT count(*) FROM private.work_counters)<>${expected.counters} THEN RAISE EXCEPTION 'Restored records or counters did not reconcile';END IF;IF EXISTS(SELECT 1 FROM public.work_members WHERE active) OR EXISTS(SELECT 1 FROM public.work_portal_members WHERE active) THEN RAISE EXCEPTION 'Restored access was enabled prematurely';END IF;END;$$;\nSET ROLE anon;DO $$DECLARE t text;n bigint;BEGIN FOREACH t IN ARRAY ARRAY['work_customers','work_payments'] LOOP BEGIN EXECUTE format('SELECT count(*) FROM public.%I',t) INTO n;IF n>0 THEN RAISE EXCEPTION 'Restored access policies leaked business data';END IF;EXCEPTION WHEN insufficient_privilege THEN NULL;END;END LOOP;END;$$;RESET ROLE;`;
  await writeFile(
    output,
    seed +
      "SELECT set_config('lutera.isolated_restore','confirmed',false);\n" +
      recoverySQL(legacyCompatible) +
      "\n" +
      check,
    { mode: 0o600 },
  );
  console.log(
    "Prepared encrypted synthetic recovery fixture; expected record counts and counters captured.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
