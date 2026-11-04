import { after } from "next/server";
import { dispatchBusinessMail, job } from "@/lib/business-mail";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { documentSignatures } from "@/lib/signatures";
import { statementPDF, type StatementSnapshot } from "@/lib/statement";
import { scannerStatus, AttachmentScanError } from "@/lib/evidence-scan";
import { checkBouncer } from "@/lib/bouncer-scan";
import { normalizeEvidence } from "@/lib/evidence";
import {
  businessIdentity,
  boundedJSON,
  checked,
  BusinessError,
} from "@/lib/business-server";
import {
  documentSchema,
  assertOrigin,
  type BusinessDocument,
  type Settings,
} from "@/lib/contracts";
import { workspaceOrigin } from "@/lib/origin";
import { recordOption, stockAvailable } from "@/lib/workspace-display";
import {
  schemas,
  commercialSchema,
  paymentSchema,
  expenseSchema,
  listSchema,
  csv,
  type Entity,
  type Row,
  type Access,
} from "@/lib/business";
import { bankFingerprint } from "@/lib/bank-fingerprint";
import { bankRows, parseCSV } from "@/lib/business-csv";
import { financialExport } from "@/lib/exports";
import { backupConfiguration, runBusinessBackup } from "@/lib/business-backup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const ok = (data: unknown) =>
  Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
function fail(error: unknown) {
  const requestId = randomUUID();
  if (!(error instanceof z.ZodError) && !(error instanceof BusinessError))
    console.error(
      JSON.stringify({
        event: "business_api_error",
        request_id: requestId,
        type: error instanceof Error ? error.name : "unknown",
      }),
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")
          .slice(0, 600),
      },
      { status: 400 },
    );
  return Response.json(
    {
      error:
        error instanceof BusinessError
          ? error.message
          : "The operation could not be completed. Please retry or contact the owner.",
    },
    { status: error instanceof BusinessError ? error.status : 500 },
  );
}
const searchFields: Partial<Record<Entity, string>> = {
  documents: "payload->customer->>name",
  commercial_lines: "description",
  customers: "name",
  contacts: "name",
  enquiries: "subject",
  opportunities: "title",
  suppliers: "name",
  items: "name",
  commercial: "title",
  cases: "title",
  tasks: "title",
  notes: "body",
  expenses: "title",
  messages: "subject",
  bank_lines: "reference",
  files: "name",
  assets: "serial",
};
const parentFields: Partial<Record<Entity, string>> = {
  commercial_lines: "record_id",
  contacts: "customer_id",
  opportunities: "customer_id",
  quotes: "customer_id",
  commercial: "customer_id",
  cases: "customer_id",
  tasks: "case_id",
  notes: "customer_id",
  payments: "customer_id",
  allocations: "invoice_id",
  refunds: "payment_id",
  assets: "customer_id",
  supplier_payments: "expense_id",
};
export async function GET(
  request: Request,
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    const action = (await context.params).action.join("/");
    const { db, user } = await businessIdentity();
    if (action === "inventory-overview") {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      checked(await db.from("work_items").select("id").eq("id", id).single());
      const [balances, movements, assets] = await Promise.all([
        db.from("work_stock_balances").select("*").eq("item_id", id).limit(100),
        db
          .from("work_stock")
          .select("id,kind,quantity,serial,created_at,order_id")
          .eq("item_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        db
          .from("work_assets")
          .select("id,serial,site,warranty_until")
          .eq("item_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      return ok({
        balances: checked(balances).map((r) => ({
          ...r,
          available: stockAvailable(r),
        })),
        movements: checked(movements),
        assets: checked(assets),
      });
    }
    if (action === "payment-overview") {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      const payment = checked(
        await db
          .from("work_payments")
          .select("id,amount_minor,currency,status")
          .eq("id", id)
          .single(),
      );
      const [allocations, refunds] = await Promise.all([
        db
          .from("work_allocations")
          .select("id,invoice_id,amount_minor")
          .eq("payment_id", id)
          .is("reversed_at", null),
        db.from("work_refunds").select("amount_minor").eq("payment_id", id),
      ]);
      const rows = checked(allocations);
      const allocated = rows.reduce((n, r) => n + Number(r.amount_minor), 0);
      const refunded = checked(refunds).reduce(
        (n, r) => n + Number(r.amount_minor),
        0,
      );
      const invoices = rows.length
        ? checked(
            await db
              .from("work_commercial")
              .select("id,number")
              .in(
                "id",
                rows.map((r) => r.invoice_id),
              ),
          )
        : [];
      return ok({
        allocated,
        refunded,
        available:
          payment.status === "confirmed"
            ? Number(payment.amount_minor) - allocated - refunded
            : 0,
        invoices: rows.map((r) => ({
          ...r,
          number:
            invoices.find((i) => i.id === r.invoice_id)?.number || "Invoice",
        })),
      });
    }
    if (action === "bank-candidates") {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      const line = checked(
        await db
          .from("work_bank_lines")
          .select("amount_minor,currency")
          .eq("id", id)
          .single(),
      );
      if (Number(line.amount_minor) < 0) return ok({ rows: [] });
      return ok({
        rows: checked(
          await db
            .from("work_payments")
            .select("id,reference,amount_minor,currency,paid_on")
            .eq("amount_minor", line.amount_minor)
            .eq("currency", line.currency)
            .eq("status", "confirmed")
            .eq("reconciled", false)
            .limit(20),
        ),
      });
    }
    if (action === "references") {
      const raw = new URL(request.url).searchParams.get("values") || "[]";
      if (raw.length > 6000)
        throw new BusinessError("Too many linked references.", 400);
      const requests = z
        .array(
          z.object({
            key: z.string().regex(/^[a-z0-9_]{1,60}$/),
            id: z.uuid(),
            entity: z.enum([
              "customers",
              "suppliers",
              "cases",
              "tasks",
              "commercial",
              "expenses",
              "payments",
              "items",
              "quotes",
              "enquiries",
              "contacts",
              "assets",
              "stock",
              "reservations",
              "offers",
              "commercial_lines",
              "portal_shares",
              "documents",
              "person",
            ]),
          }),
        )
        .max(20)
        .parse(
          (() => {
            try {
              return JSON.parse(raw);
            } catch {
              throw new BusinessError("Invalid linked references.", 400);
            }
          })(),
        );
      const resolved = await Promise.all(
        requests.map(async (ref) => {
          if (ref.entity === "person") {
            const people = checked(await db.rpc("work_business_people")) as {
              id: string;
              name: string;
            }[];
            const person = people.find((p) => p.id === ref.id);
            return person
              ? ([
                  ref.key,
                  { label: person.name, entity: "person", id: ref.id },
                ] as const)
              : null;
          }
          const result = await db
            .from("work_" + ref.entity)
            .select("*")
            .eq(ref.entity === "quotes" ? "document_id" : "id", ref.id)
            .maybeSingle();
          if (result.error || !result.data) return null;
          const row = result.data as Record<string, unknown>;
          return [
            ref.key,
            {
              label: recordOption(row),
              entity:
                ref.entity === "commercial_lines" ? "commercial" : ref.entity,
              id:
                ref.entity === "commercial_lines"
                  ? String(row.record_id)
                  : ref.id,
              ...(row.kind ? { kind: String(row.kind) } : {}),
            },
          ] as const;
        }),
      );
      return ok({
        references: Object.fromEntries(resolved.flatMap((r) => (r ? [r] : []))),
      });
    }
    if (action === "legacy-document") {
      return ok(
        checked(
          await db
            .from("work_documents")
            .select("*")
            .eq(
              "id",
              z.uuid().parse(new URL(request.url).searchParams.get("id")),
            )
            .single(),
        ),
      );
    }
    if (action === "health") {
      if (!checked(await db.rpc("work_has_access", { area: "members" })))
        throw new BusinessError("Owner access required.", 403);
      const automation = checked(
        await db.from("work_automation").select("*").eq("id", 1).single(),
      );
      let counts = {};
      try {
        counts = await job({ action: "health" });
      } catch {}
      const fields =
        "id,status,created_at,updated_at,bytes,file_count,last_error,drive_id";
      const [history, primary, drive] = await Promise.all([
        db
          .from("work_backup_runs")
          .select(fields)
          .order("created_at", { ascending: false })
          .limit(12),
        db
          .from("work_backup_runs")
          .select(fields)
          .in("status", ["primary", "complete"])
          .order("created_at", { ascending: false })
          .limit(1),
        db
          .from("work_backup_runs")
          .select(fields)
          .eq("status", "complete")
          .not("drive_id", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1),
      ]);
      const view = (row: {
        id: string;
        status: string;
        created_at: string;
        updated_at: string;
        bytes: number | null;
        file_count: number | null;
        last_error: string;
        drive_id: string | null;
      }) => {
        const { drive_id, ...record } = row;
        return {
          ...record,
          drive_verified: record.status === "complete" && !!drive_id,
        };
      };
      const backupRuns = checked(history).map(view);
      return ok({
        automation,
        backup_runs: backupRuns,
        latest_primary: checked(primary).map(view).at(0) || null,
        latest_drive: checked(drive).map(view).at(0) || null,
        health: {
          public_site_publishing: !!process.env.PUBLIC_SITE_DEPLOY_HOOK,
          attachment_malware_scanner: scannerStatus().configured,
          attachment_scanner_provider: scannerStatus().provider,
          business_email: !!process.env.BUSINESS_MAIL_KEY,
          signed_delivery_events: !!process.env.BUSINESS_MAIL_WEBHOOK_SECRET,
          background_jobs: !!process.env.BUSINESS_JOB_SECRET,
          ...backupConfiguration(),
          ...counts,
          latest_backup: backupRuns.at(0) || null,
        },
      });
    }
    if (action === "delivery-calendar")
      return ok(
        checked(
          await db.from("work_calendar").select("*").eq("id", 1).single(),
        ),
      );
    if (action === "delivery-work") {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      const queries = await Promise.all([
        db.from("work_cases").select("id").eq("id", id).single(),
        db
          .from("work_case_service")
          .select("*")
          .eq("case_id", id)
          .maybeSingle(),
        db
          .from("work_case_changes")
          .select("*")
          .eq("case_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        db
          .from("work_case_events")
          .select("*")
          .eq("case_id", id)
          .order("created_at", { ascending: false })
          .limit(100),
        db
          .from("work_case_templates")
          .select("case_id")
          .eq("case_id", id)
          .maybeSingle(),
      ]);
      const [record, service, changes, events, template] = queries.map(checked);
      return ok({ record, service, changes, events, template });
    }
    if (action === "quote-settings")
      return ok(checked(await db.rpc("work_quote_settings")));
    if (action === "config")
      return ok({
        owner: checked(await db.rpc("work_has_access", { area: "members" })),
        legacy_documents: checked(
          await db.rpc("work_has_access", { area: "finance" }),
        ),
        me: user.id,
        access: checked(await db.rpc("work_business_access")),
        people: checked(await db.rpc("work_business_people")),
      });
    if (action === "dashboard") {
      const u = new URL(request.url);
      return ok(
        checked(
          await db.rpc("work_business_dashboard_filtered", {
            owner_id: u.searchParams.get("owner")
              ? z.uuid().parse(u.searchParams.get("owner"))
              : null,
            service: u.searchParams.get("service")?.slice(0, 100) || "",
            start_date: u.searchParams.get("from") || null,
            end_date: u.searchParams.get("to") || null,
          }),
        ),
      );
    }
    if (action === "stock-balances") {
      const rows = checked(
        await db.from("work_stock_balances").select("*").limit(500),
      );
      const ids = [...new Set(rows.map((r) => r.item_id))];
      const items = ids.length
        ? checked(
            await db.from("work_items").select("id,name,sku").in("id", ids),
          )
        : [];
      return ok(
        rows.map((row) => ({
          ...row,
          item_name:
            items.find((i) => i.id === row.item_id)?.name || "Unavailable item",
          sku: items.find((i) => i.id === row.item_id)?.sku || "",
          available: stockAvailable(row),
        })),
      );
    }
    if (action === "reports")
      return ok(checked(await db.rpc("work_business_reports")));
    if (action === "balances")
      return ok(
        checked(
          await db
            .from("work_invoice_balances")
            .select("*")
            .order("due_date")
            .limit(500),
        ),
      );
    if (action === "file") {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      const file = checked(
        await db.from("work_files").select("*").eq("id", id).single(),
      );
      const blob = checked(
        await db.storage.from("work-evidence").download(file.path),
      );
      checked(
        await db.rpc("work_log_file_read", { kind: "staff-evidence", fid: id }),
      );
      return new Response(await blob.arrayBuffer(), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="evidence-${id}.${file.content_type === "application/pdf" ? "pdf" : "jpg"}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "sandbox; default-src 'none'",
        },
      });
    }
    if (action === "related") {
      const u = new URL(request.url),
        id = z.uuid().parse(u.searchParams.get("id")),
        entity = z
          .enum(["customers", "cases", "enquiries"])
          .parse(u.searchParams.get("entity"));
      checked(
        await db
          .from("work_" + entity)
          .select("id")
          .eq("id", id)
          .single(),
      );
      const groups =
        entity === "customers"
          ? [
              "commercial",
              "cases",
              "payments",
              "contacts",
              "opportunities",
              "quotes",
            ]
          : entity === "cases"
            ? ["tasks"]
            : ["opportunities"];
      const results = await Promise.all(
        groups.map(async (name) => ({
          entity: name,
          rows: checked(
            await db
              .from("work_" + name)
              .select("*")
              .eq(
                entity === "customers"
                  ? "customer_id"
                  : entity === "cases"
                    ? "case_id"
                    : "enquiry_id",
                id,
              )
              .order("created_at", { ascending: false })
              .limit(12),
          ),
        })),
      );
      return ok(results);
    }
    if (action === "detail") {
      const u = new URL(request.url);
      const id = z.uuid().parse(u.searchParams.get("id"));
      const entity = z
        .enum([
          "commercial",
          "customers",
          "cases",
          "enquiries",
          "expenses",
          "payments",
          "items",
          "tasks",
          "opportunities",
          "contacts",
          "suppliers",
          "quotes",
          "allocations",
          "refunds",
          "assets",
          "bank_lines",
          "stock",
          "reservations",
          "offers",
          "supplier_payments",
        ] as const)
        .parse(u.searchParams.get("entity"));
      if (entity === "commercial" && u.searchParams.get("fulfilment") === "1")
        return ok(
          checked(
            await db.rpc("work_fulfilment", { c: { action: "order", id } }),
          ),
        );
      const record = checked(
        await db
          .from("work_" + entity)
          .select("*")
          .eq(entity === "quotes" ? "document_id" : "id", id)
          .single(),
      );
      let lines: unknown[] = [];
      if (entity === "commercial")
        lines = checked(
          await db
            .from("work_commercial_lines")
            .select("*")
            .eq("record_id", id)
            .order("position"),
        );
      return ok({ record, lines });
    }
    if (action === "audit") {
      const u = new URL(request.url),
        page = z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .parse(u.searchParams.get("page") || 0),
        query = z
          .string()
          .max(100)
          .parse(u.searchParams.get("query") || "");
      let q = db
        .from("work_audit")
        .select("*")
        .order("id", { ascending: false })
        .range(page * 50, page * 50 + 50);
      if (query) q = q.ilike("entity", `%${query.replace(/[\\%_]/g, "\\$&")}%`);
      const actor = u.searchParams.get("actor");
      if (actor) q = q.eq("actor", z.uuid().parse(actor));
      const from = u.searchParams.get("from"),
        to = u.searchParams.get("to");
      if (from)
        q = q.gte("created_at", z.iso.date().parse(from) + "T00:00:00+01:00");
      if (to)
        q = q.lte("created_at", z.iso.date().parse(to) + "T23:59:59.999+01:00");
      const rows = checked(await q);
      const auditRecords = new Map<string, { label: string; kind?: string }>();
      const allowedAuditEntities = new Set([
        "customers",
        "commercial",
        "payments",
        "expenses",
        "suppliers",
        "cases",
        "tasks",
        "items",
        "enquiries",
        "assets",
        "bank_lines",
      ]);
      const tables = [...new Set(rows.map((r) => String(r.entity)))].filter(
        (table) => allowedAuditEntities.has(table.replace(/^work_/, "")),
      );
      await Promise.all(
        tables.map(async (table) => {
          const ids = rows
            .filter(
              (r) =>
                r.entity === table &&
                /^[a-f0-9-]{36}$/.test(String(r.entity_id)),
            )
            .map((r) => String(r.entity_id));
          if (!ids.length) return;
          const entity = table.replace(/^work_/, "");
          const result = await db
            .from("work_" + entity)
            .select("*")
            .in("id", ids);
          for (const record of result.data || [])
            auditRecords.set(table + ":" + record.id, {
              label: recordOption(record),
              ...(record.kind ? { kind: String(record.kind) } : {}),
            });
        }),
      );
      const actors = checked(await db.rpc("work_business_people")) as {
        id: string;
        name: string;
      }[];
      return ok({
        rows: rows.slice(0, 50).map((r) => ({
          ...r,
          record_label: auditRecords.get(r.entity + ":" + r.entity_id)?.label,
          record_kind: auditRecords.get(r.entity + ":" + r.entity_id)?.kind,
          actor_name:
            actors.find((p) => p.id === r.actor)?.name ||
            "Former workspace member",
        })),
        actors,
        more: rows.length > 50,
      });
    }
    throw new BusinessError("Not found.", 404);
  } catch (error) {
    return fail(error);
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    try {
      assertOrigin(request, workspaceOrigin());
    } catch {
      throw new BusinessError("Invalid request origin or content type.", 403);
    }
    const action = (await context.params).action.join("/");
    const { db, user } = await businessIdentity();
    const raw = await boundedJSON(request);
    if (action === "scanner-check") {
      z.object({}).strict().parse(raw);
      if (!checked(await db.rpc("work_has_access", { area: "members" })))
        throw new BusinessError("Owner access required.", 403);
      if (scannerStatus().provider !== "bouncer")
        throw new BusinessError(
          "Add the Bouncer key in the private hosting settings first.",
        );
      try {
        return ok({
          provider: "bouncer",
          allowance: await checkBouncer(process.env.BOUNCER_API_KEY),
        });
      } catch (error) {
        throw new BusinessError(
          (error as Error).message,
          error instanceof AttachmentScanError ? error.status : 503,
        );
      }
    }
    if (action === "grant-areas") {
      const b = z
        .object({
          email: z.email(),
          areas: z
            .array(
              z.enum([
                "sales",
                "finance",
                "procurement",
                "inventory",
                "projects",
                "support",
                "reports",
              ]),
            )
            .min(1)
            .max(7),
          approvals: z
            .array(
              z.enum([
                "sales",
                "finance",
                "procurement",
                "inventory",
                "projects",
                "support",
                "reports",
              ]),
            )
            .max(7),
          scope: z.enum(["assigned", "all"]),
          edit: z.boolean(),
        })
        .strict()
        .parse(raw);
      checked(
        await db.rpc("work_set_grant_areas", {
          email_address: b.email,
          areas: b.areas,
          approvals: b.approvals,
          record_scope: b.scope,
          edit: b.edit,
        }),
      );
      return ok({ success: true });
    }
    if (
      action === "backup-run" ||
      action === "backup-recovery-key" ||
      action === "backup-drive-setup"
    ) {
      if (!checked(await db.rpc("work_has_access", { area: "backup" })))
        throw new BusinessError("Owner access required.", 403);
      z.object({ confirmed: z.literal(true) })
        .strict()
        .parse(raw);
      if (action === "backup-run") {
        const result = await runBusinessBackup();
        const latest = await db
          .from("work_backup_runs")
          .select("id,day,status,created_at,bytes,file_count")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return ok({ ...result, latest: latest.error ? null : latest.data });
      }
      if (action === "backup-drive-setup") {
        if (!process.env.DRIVE_BACKUP_SECRET)
          throw new BusinessError(
            "Drive copy connection is not configured.",
            503,
          );
        return new Response(
          JSON.stringify(
            {
              LUTERA_BACKUP_URL: workspaceOrigin() + "/api/backups/drive",
              LUTERA_BACKUP_TOKEN: process.env.DRIVE_BACKUP_SECRET,
            },
            null,
            2,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Content-Disposition":
                'attachment; filename="lutera-drive-connection.json"',
              "Cache-Control": "private, no-store",
            },
          },
        );
      }
      if (!process.env.BACKUP_PASSPHRASE)
        throw new BusinessError(
          "Scheduled backup encryption is not configured.",
          503,
        );
      checked(
        await db.rpc("work_log_export", {
          table_name: "backup",
          record_id: "recovery-key",
          export_action: "export_backup",
        }),
      );
      return new Response(
        "Lutera Technology Ltd — scheduled backup recovery\nKeep this key in a company password manager, separate from backup files.\nNever email or upload it to the backup folder.\n\n" +
          process.env.BACKUP_PASSPHRASE +
          "\n",
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="lutera-backup-recovery-key.txt"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (action === "quote-draft") {
      const b = z
        .object({ customer_id: z.uuid(), id: z.uuid().optional() })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { command: "quote_create", ...b },
          }),
        ),
      );
    }
    if (action === "delivery-work") {
      const base = z
        .object({
          action: z.enum([
            "calendar",
            "template",
            "service",
            "change",
            "decide",
          ]),
          case_id: z.uuid().optional(),
          request_key: z.uuid().optional(),
          id: z.uuid().optional(),
          version: z.number().int().min(0).optional(),
          data: z.unknown().optional(),
          decision: z.enum(["approved", "rejected", "applied"]).optional(),
          reason: z.string().trim().min(5).max(500).optional(),
          replacement_order_id: z.union([z.uuid(), z.literal("")]).optional(),
          task_id: z.union([z.uuid(), z.literal("")]).optional(),
        })
        .strict()
        .parse(raw);
      if (base.action !== "calendar" && !base.case_id)
        throw new BusinessError("Work record is required.");
      if (base.action === "calendar")
        base.data = z
          .object({
            days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
            start_minute: z.number().int().min(0).max(1439),
            end_minute: z.number().int().min(1).max(1440),
            holidays: z.array(z.iso.date()).max(100),
          })
          .strict()
          .parse(base.data);
      if (base.action === "service")
        base.data = z
          .object({
            asset_id: z.union([z.uuid(), z.literal("")]).default(""),
            agreed_response_minutes: z.union([
              z.literal(""),
              z.coerce.number().int().min(1).max(86400),
            ]),
            coverage: z.string().max(4000),
            pause_reason: z.string().max(1000),
            resolution: z.string().max(4000),
            site_ready: z.boolean(),
            equipment_checked: z.boolean(),
            commissioning_complete: z.boolean(),
            handover_complete: z.boolean(),
            training_complete: z.boolean(),
          })
          .strict()
          .parse(base.data);
      if (base.action === "change")
        base.data = z
          .object({
            summary: z.string().trim().min(5).max(200),
            details: z.string().trim().min(10).max(4000),
            amount_minor: z.number().int().min(-1e12).max(1e12),
            currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
            revised_due_on: z.union([z.iso.date(), z.literal("")]),
            evidence_id: z.union([z.uuid(), z.literal("")]),
          })
          .strict()
          .parse(base.data);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { ...base, command: "delivery_work" },
          }),
        ),
      );
    }
    if (action === "customer-import") {
      const b = z
        .object({
          csv: z.string().max(200000),
          confirm: z.boolean(),
          request_key: z.uuid(),
        })
        .strict()
        .parse(raw);
      let rows;
      try {
        rows = parseCSV(b.csv).map((r) =>
          schemas.customers.parse({
            name: r.name,
            email: r.email || "",
            phone: r.phone || "",
            address: r.address || "",
            sector: r.sector || "",
            assigned_to: user.id,
          }),
        );
      } catch (e) {
        throw new BusinessError(
          e instanceof z.ZodError
            ? "Check the name, email and field lengths in every row."
            : (e as Error).message,
        );
      }
      if (!b.confirm)
        return ok({
          rows: checked(await db.rpc("work_customer_import_preview", { rows })),
        });
      return ok(
        checked(
          await db.rpc("work_business", {
            c: {
              command: "customers_bulk",
              action: "import",
              rows,
              request_key: b.request_key,
            },
          }),
        ),
      );
    }
    if (action === "customer-merge") {
      const b = z
        .object({
          source_id: z.uuid(),
          target_id: z.uuid(),
          reason: z.string().trim().min(5).max(500),
          reviewed: z.literal(true),
          request_key: z.uuid(),
        })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { command: "customers_bulk", action: "merge", ...b },
          }),
        ),
      );
    }
    if (action === "bank-import") {
      const b = z
        .object({
          csv: z.string().max(200000),
          confirm: z.boolean(),
          account: z.string().trim().min(1).max(80).default("primary"),
        })
        .strict()
        .parse(raw);
      let rows;
      try {
        rows = bankRows(b.csv);
      } catch (e) {
        throw new BusinessError((e as Error).message);
      }
      if (!b.confirm) {
        // Match the database's jsonb-array fingerprint, including its separator spacing.
        const fingerprints = rows.map((r) => bankFingerprint(b.account, r));
        const existing = checked(
          await db
            .from("work_bank_lines")
            .select("fingerprint")
            .in("fingerprint", fingerprints),
        );
        const seen = new Set(existing.map((r) => r.fingerprint));
        return ok({
          rows: rows.map((row, i) => {
            const duplicate = seen.has(fingerprints[i]);
            seen.add(fingerprints[i]);
            return { ...row, duplicate };
          }),
        });
      }
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { command: "bank", action: "import", rows, account: b.account },
          }),
        ),
      );
    }
    if (action === "bank-match") {
      const b = z
        .object({
          id: z.uuid(),
          payment_id: z.uuid(),
          request_key: z.uuid().optional(),
        })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { command: "bank", action: "match", ...b },
          }),
        ),
      );
    }
    if (action === "statement") {
      const b = z
        .object({
          format: z.enum(["pdf", "csv"]).default("csv"),
          customer_id: z.uuid(),
          from: z.union([z.literal(""), z.iso.date()]),
          to: z.union([z.literal(""), z.iso.date()]),
          currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
        })
        .strict()
        .parse(raw);
      const statement = checked(
        await db.rpc("work_customer_statement", {
          cid: b.customer_id,
          from_date: b.from || null,
          to_date: b.to || null,
          ccy: b.currency,
        }),
      );
      if (b.from && b.to && b.from > b.to)
        throw new BusinessError("Choose a valid statement date range.");
      if (b.format === "pdf") {
        const company = checked(
          await db.from("work_settings").select("payload").eq("id", 1).single(),
        ).payload;
        const bytes = await statementPDF({
          ...statement,
          company,
          from: b.from,
          to: b.to,
        } as StatementSnapshot);
        return new Response(new Uint8Array(bytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition":
              'attachment; filename="Lutera-customer-statement.pdf"',
            "Cache-Control": "private, no-store",
          },
        });
      }
      const data = statement as {
        opening_minor: number;
        events: Record<string, unknown>[];
      };
      let balance = Number(data.opening_minor);
      const rows = [
        {
          date: b.from || "",
          type: "opening",
          reference: "Opening balance",
          currency: b.currency,
          debit_minor: 0,
          credit_minor: 0,
          balance_minor: balance,
        },
        ...data.events.map((e) => {
          balance += Number(e.debit_minor) - Number(e.credit_minor);
          return {
            date: e.posted_on,
            type: e.kind,
            reference: e.reference,
            currency: b.currency,
            debit_minor: e.debit_minor,
            credit_minor: e.credit_minor,
            balance_minor: balance,
          };
        }),
      ];
      return new Response(
        csv(rows, [
          "date",
          "type",
          "reference",
          "currency",
          "debit_minor",
          "credit_minor",
          "balance_minor",
        ]),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="lutera-customer-statement.csv"',
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    if (action === "automation") {
      const b = z
        .object({
          id: z.literal(1),
          version: z.number().int().min(1),
          invoice_reminders: z.boolean(),
          maintenance_reminders: z.boolean(),
          enquiry_reminders: z.boolean().optional(),
          warranty_reminders: z.boolean().optional(),
          visit_reminders: z.boolean().optional(),
          delivery_notices: z.boolean().optional(),

          interval_days: z.number().int().min(1).max(90),
          updated_at: z.string().optional(),
        })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", { c: { command: "automation", ...b } }),
        ),
      );
    }
    if (action === "quote-save" || action === "quote-status") {
      const b = z
        .object({
          id: z.uuid(),
          version: z.number().int().min(1),
          payload: documentSchema.optional(),
          action: z.enum(["issue", "void", "delete"]).optional(),
          reason: z.string().trim().min(5).max(500).optional(),
        })
        .strict()
        .parse(raw);
      if (action === "quote-save" && !b.payload)
        throw new BusinessError("Quotation details required.");
      return ok(
        checked(
          await db.rpc("work_business", {
            c: {
              command: "quote_mutate",
              ...b,
              action: action === "quote-save" ? "save" : b.action,
            },
          }),
        ),
      );
    }
    if (action === "quote-export" || action === "receipt-export") {
      const b = z
        .object({
          id: z.uuid(),
          format: z.enum(["pdf", "docx", "png"]),
          entity: z.literal("document").optional(),
          template: z.string().optional(),
          side: z.string().optional(),
        })
        .strict()
        .parse(raw);
      const d = checked(
        await db.from("work_documents").select("*").eq("id", b.id).single(),
      ) as BusinessDocument;
      if ((d.kind === "receipt") !== (action === "receipt-export"))
        throw new BusinessError("Document access required.", 403);
      const settings =
        d.payload.company ||
        (checked(await db.rpc("work_quote_settings")) as Settings);
      const bytes = await financialExport(
        d,
        settings,
        b.format,
        await documentSignatures(db, "work_documents", d.id),
      );
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${d.number || "draft-" + d.id}.${b.format}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    if (action === "portal-admin") {
      const c = z.record(z.string(), z.unknown()).parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { ...c, command: "portal_admin" },
          }),
        ),
      );
    }
    if (action === "queue-message") {
      const b = z
        .object({
          customer_id: z.uuid(),
          record_id: z.union([z.literal(""), z.uuid()]).default(""),
          document_id: z.union([z.literal(""), z.uuid()]).default(""),
          recipient: z.email().max(254),
          subject: z.string().trim().min(1).max(200),
          body: z.string().trim().min(1).max(6000),
          request_key: z.uuid(),
        })
        .strict()
        .parse(raw);
      const result = checked(
        await db.rpc("work_business", { c: { command: "queue", ...b } }),
      );
      after(() =>
        dispatchBusinessMail()
          .then(() => {})
          .catch(() => {}),
      );
      return ok(result);
    }
    if (action === "retry-mail") {
      const caps = checked(await db.rpc("work_business_access")) as Access;
      if (!caps.sales.approve && !caps.finance.approve)
        throw new BusinessError("Approval access required.", 403);
      return ok(await dispatchBusinessMail());
    }
    if (action === "list" || action === "csv") {
      const body = listSchema.parse(raw);
      if (action === "list" && body.entity === "quotes") {
        const rows = checked(
          await db.rpc("work_quote_list", {
            q: body.query,
            page: body.page,
            outcome: body.kind,
          }),
        ) as Row[];
        return ok({ rows: rows.slice(0, 50), more: rows.length > 50 });
      }

      if (
        action === "list" &&
        body.entity === "commercial" &&
        body.status === "fulfilment"
      )
        return ok({
          rows: checked(
            await db.rpc("work_fulfilment", {
              c: {
                action: "lookup",
                kind: body.kind,
                query: body.query,
                page: body.page,
              },
            }),
          ),
          more: false,
        });
      if (
        action === "list" &&
        body.entity === "commercial_lines" &&
        body.parent
      ) {
        const caps = checked(await db.rpc("work_business_access")) as Access;
        if (caps.inventory.read)
          return ok({
            rows: checked(
              await db.rpc("work_fulfilment", {
                c: { action: "lines", id: body.parent },
              }),
            ),
            more: false,
          });
      }

      let q = db
        .from("work_" + body.entity)
        .select("*")
        .order(
          body.entity === "grants"
            ? "email"
            : body.entity === "commercial_lines"
              ? "position"
              : "created_at",
          {
            ascending: false,
          },
        );
      if (body.query) {
        const field =
          body.query.toUpperCase().startsWith("LUT-") &&
          ["commercial", "enquiries", "cases", "documents"].includes(
            body.entity,
          )
            ? ["commercial", "documents"].includes(body.entity)
              ? "number"
              : "reference"
            : searchFields[body.entity];
        if (field)
          q = q.ilike(field, `%${body.query.replace(/[\\%_]/g, "\\$&")}%`);
      }
      if (
        body.owner &&
        [
          "customers",
          "enquiries",
          "opportunities",
          "commercial",
          "cases",
          "tasks",
        ].includes(body.entity)
      )
        q = q.eq("assigned_to", body.owner);
      if (body.service && body.entity === "enquiries")
        q = q.contains("services", [body.service]);
      if (body.service && body.entity === "cases")
        q = q.eq(
          "category",
          (
            {
              ai: "ai-automation",
              support: "installation-labs",
              cloud: "cloud-integration",
            } as Record<string, string>
          )[body.service] || body.service,
        );
      if (body.from) q = q.gte("created_at", body.from + "T00:00:00+01:00");
      if (body.to)
        q = q.lt(
          "created_at",
          new Date(
            new Date(body.to + "T00:00:00+01:00").getTime() + 86400000,
          ).toISOString(),
        );
      if (body.parent && parentFields[body.entity])
        q = q.eq(parentFields[body.entity]!, body.parent);
      if (body.kind && ["commercial", "cases", "items"].includes(body.entity))
        q = q.eq("kind", body.kind);
      if (
        body.status &&
        [
          "commercial",
          "cases",
          "enquiries",
          "expenses",
          "tasks",
          "messages",
          "payments",
        ].includes(body.entity)
      )
        q = q.eq("status", body.status);
      const size = action === "csv" ? 5000 : 50;
      const rows = checked(
        await q.range(body.page * size, body.page * size + size),
      );
      if (action === "csv") {
        if (rows.length > 5000)
          throw new BusinessError(
            "Export exceeds 5,000 records. Apply filters to reduce it.",
          );
        const columns = rows.length
          ? Object.keys(rows[0]).filter(
              (k) =>
                !["snapshot", "statement_snapshot", "sha256", "path"].includes(
                  k,
                ),
            )
          : ["id"];
        return new Response(csv(rows, columns), {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="lutera-${body.entity}.csv"`,
            "Cache-Control": "private, no-store",
          },
        });
      }
      return ok({ rows: rows.slice(0, 50), more: rows.length > 50 });
    }
    if (action === "save") {
      const b = z
        .object({
          request_key: z.uuid().optional(),
          entity: z.enum([
            "customers",
            "contacts",
            "enquiries",
            "opportunities",
            "suppliers",
            "items",
            "cases",
            "tasks",
          ]),
          id: z.uuid().optional(),
          version: z.number().int().min(0),
          data: z.unknown(),
        })
        .strict()
        .parse(raw);
      const data = schemas[b.entity].parse(b.data);
      return ok(
        checked(
          await db.rpc("work_business", { c: { command: "save", ...b, data } }),
        ),
      );
    }
    if (action === "commercial-save") {
      const b = z
        .object({
          id: z.uuid().optional(),
          version: z.number().int().min(0),
          request_key: z.uuid(),
          data: commercialSchema,
        })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { command: "commercial_save", ...b },
          }),
        ),
      );
    }
    if (action === "commercial-issue") {
      const b = z
        .object({
          id: z.uuid(),
          version: z.number().int().min(1),
          action: z.enum(["issue", "cancel"]),
          reason: z.string().trim().min(5).max(500),
        })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", {
            c: { command: "commercial_issue", ...b },
          }),
        ),
      );
    }
    if (action === "payment") {
      const b = z
        .object({ request_key: z.uuid(), data: paymentSchema })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", { c: { command: "payment", ...b } }),
        ),
      );
    }
    if (action === "file") {
      const b = z
        .object({
          name: z.string().trim().min(1).max(160),
          area: z.enum([
            "sales",
            "finance",
            "procurement",
            "inventory",
            "projects",
            "support",
          ]),
          data: z.string().max(1400000),
        })
        .strict()
        .parse(raw);
      const caps = checked(await db.rpc("work_business_access")) as Access;
      if (!caps[b.area]?.write)
        throw new BusinessError(
          "File upload access is required for this department.",
          403,
        );
      let prepared;
      try {
        prepared = await normalizeEvidence(Buffer.from(b.data, "base64"));
      } catch (e) {
        throw new BusinessError(
          (e as Error).message,
          e instanceof AttachmentScanError ? e.status : 400,
        );
      }
      const normalized = prepared.bytes,
        id = randomUUID(),
        path = user.id + "/" + id + "." + prepared.extension;
      const file = checked(
        await db.rpc("work_business", {
          c: {
            command: "misc",
            action: "file",
            id,
            area: b.area,
            name: b.name,
            path,
            size: normalized.length,
            content_type: prepared.type,
            sha256: createHash("sha256").update(normalized).digest("hex"),
          },
        }),
      );
      checked(
        await db.storage.from("work-evidence").upload(path, normalized, {
          contentType: prepared.type,
          upsert: false,
        }),
      );
      return ok(file);
    }
    if (action === "allocate") {
      const b = z
        .object({
          payment_id: z.uuid(),
          invoice_id: z.uuid(),
          amount_minor: z.number().int().min(1).max(1e12),
          request_key: z.uuid(),
        })
        .strict()
        .parse(raw);
      return ok(
        checked(
          await db.rpc("work_business", { c: { command: "allocate", ...b } }),
        ),
      );
    }
    if (action === "expense") {
      const b = z
        .object({
          action: z.enum(["save", "submit", "approve", "reject", "pay"]),
          id: z.uuid().optional(),
          version: z.number().int().optional(),
          data: z.unknown().optional(),
          expense_id: z.uuid().optional(),
          amount_minor: z.number().int().min(1).max(1e12).optional(),
          paid_on: z.iso.date().optional(),
          reference: z.string().max(160).optional(),
          evidence_id: z.uuid().optional(),
          request_key: z.uuid().optional(),
          reason: z.string().trim().min(5).max(500).optional(),
        })
        .strict()
        .parse(raw);
      if (b.action === "save") b.data = expenseSchema.parse(b.data);
      return ok(
        checked(
          await db.rpc("work_business", { c: { command: "expense", ...b } }),
        ),
      );
    }
    if (
      action === "stock" ||
      action === "misc" ||
      action === "finance-action"
    ) {
      // Each command has a bounded, explicit database implementation; payload keys
      // cannot choose a table, SQL function or privileged identity.
      const b = z.record(z.string(), z.unknown()).parse(raw);
      if (JSON.stringify(b).length > 15000)
        throw new BusinessError("Request too large.");
      return ok(
        checked(
          await db.rpc("work_business", {
            c: {
              ...b,
              command: action === "finance-action" ? "finance_action" : action,
            },
          }),
        ),
      );
    }
    if (action === "export") {
      const b = z
        .object({ id: z.uuid(), format: z.enum(["pdf", "docx", "png"]) })
        .strict()
        .parse(raw);
      const record = checked(
        await db.from("work_commercial").select("*").eq("id", b.id).single(),
      ) as Row;
      const lines = checked(
        await db
          .from("work_commercial_lines")
          .select("*")
          .eq("record_id", b.id)
          .order("position"),
      );
      const snapshot = record.snapshot as {
        party: Record<string, string>;
        company: Settings;
      } | null;
      let settings = snapshot?.company;
      if (!settings) {
        const s = checked(
          await db.from("work_settings").select("payload").eq("id", 1).single(),
        );
        settings = s.payload as Settings;
      }
      const party =
        snapshot?.party ||
        checked(
          await db
            .from(record.supplier_id ? "work_suppliers" : "work_customers")
            .select("*")
            .eq("id", String(record.supplier_id || record.customer_id))
            .single(),
        );
      const doc = {
        id: record.id,
        number: record.number,
        status: record.status === "cancelled" ? "void" : record.status,
        kind: String(record.kind),
        version: record.version,
        payload: {
          kind: String(record.kind),
          customer: {
            name: party.name,
            address: party.address || "",
            email: party.email || "",
            phone: party.phone || "",
          },
          date: record.document_date,
          valid_until: record.due_date || "",
          currency: record.currency,
          items: lines,
          discount_minor: record.discount_minor,
          tax_bps: record.tax_bps,
          notes: record.notes,
          payment_method: "",
          payment_reference: "",
          payment_confirmed: false,
          source_id: "",
          company: settings,
        },
        total_minor: record.total_minor,
        created_at: record.created_at,
        issued_at: record.issued_at,
      } as unknown as BusinessDocument;
      const bytes = await financialExport(
        doc,
        settings,
        b.format,
        await documentSignatures(db, "work_commercial", String(record.id)),
      );
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type":
            b.format === "pdf"
              ? "application/pdf"
              : b.format === "png"
                ? "image/png"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${record.number || "draft-" + record.id}.${b.format}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }
    throw new BusinessError("Not found.", 404);
  } catch (error) {
    return fail(error);
  }
}
