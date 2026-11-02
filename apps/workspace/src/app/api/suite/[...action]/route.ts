import { z } from "zod";
import { csv } from "@/lib/business";
import type { LedgerReport } from "@/lib/suite";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { assertOrigin } from "@/lib/contracts";
import { workspaceOrigin } from "@/lib/origin";
import {
  businessIdentity,
  boundedJSON,
  checked,
  BusinessError,
} from "@/lib/business-server";
import { enforceAuthLimit, AuthLimitError } from "@/lib/rate-limit";
import {
  ownerSetupSchema,
  signatureProfileSchema,
  journalSchema,
} from "@/lib/suite";
export const runtime = "nodejs";
const ok = (data: unknown) =>
  Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
function fail(e: unknown) {
  const issue = e instanceof z.ZodError ? e.issues[0] : null;
  return Response.json(
    {
      error:
        e instanceof BusinessError || e instanceof AuthLimitError
          ? e.message
          : issue
            ? `${issue.path.join(" · ").replaceAll("_", " ")}: ${issue.message}`
            : "The operation could not be completed. Check your access and retry.",
    },
    {
      status:
        e instanceof BusinessError || e instanceof AuthLimitError
          ? e.status
          : issue
            ? 400
            : 500,
      headers: {
        "Cache-Control": "private, no-store",
        ...(e instanceof AuthLimitError
          ? { "Retry-After": String(e.retryAfter) }
          : {}),
      },
    },
  );
}
const sourceTables = [
  "work_commercial",
  "work_payments",
  "work_allocations",
  "work_expenses",
  "work_supplier_payments",
  "work_refunds",
] as const;
export async function GET(
  request: Request,
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    const { db } = await businessIdentity();
    const action = (await context.params).action.join("/");
    const u = new URL(request.url);
    const caps = checked(
      await db.rpc("work_suite", { c: { action: "capabilities" } }),
    ) as {
      owner: boolean;
      read: boolean;
      write: boolean;
      post: boolean;
      close: boolean;
      sign: boolean;
      accounting_enabled: boolean;
      tax_status: string;
    };
    if (action === "config") {
      const [profile, factors, setup, members, responsibilities, period] =
        await Promise.all([
          db
            .from("work_signature_profiles")
            .select("full_name,capacity,image_data")
            .maybeSingle(),
          db.auth.mfa.listFactors(),
          caps.owner
            ? db
                .from("work_owner_setup")
                .select("payload,version")
                .eq("id", 1)
                .single()
            : Promise.resolve({ data: null, error: null }),
          caps.owner
            ? db.from("work_members").select("email,role,roles,active").order("email")
            : Promise.resolve({ data: [], error: null }),
          db.from("work_responsibilities").select("*"),
          caps.read
            ? db
                .from("work_ledger_periods")
                .select("closed_through")
                .eq("id", 1)
                .single()
            : Promise.resolve({ data: null, error: null }),
        ]);
      return ok({
        ...caps,
        profile: checked(profile),
        setup: checked(setup),
        members: checked(members),
        responsibilities: checked(responsibilities),
        closed_through: checked(period)?.closed_through || null,
        factors:
          factors.data?.totp
            .filter((f) => f.status === "verified")
            .map((f) => ({
              id: f.id,
              name: f.friendly_name || "Authenticator",
            })) || [],
      });
    }
    if (action === "document-preview")
      return ok(
        checked(
          await db.rpc("work_suite", {
            c: {
              action: "document-preview",
              data: {
                source_table: z
                  .enum(["work_documents", "work_commercial", "work_expenses"])
                  .parse(u.searchParams.get("table")),
                source_id: z.uuid().parse(u.searchParams.get("id")),
              },
            },
          }),
        ),
      );
    if (action === "signatures")
      return ok(
        checked(
          await db.rpc("work_suite", {
            c: {
              action: "signature-read",
              data: {
                source_table: z
                  .enum(["work_documents", "work_commercial", "work_expenses"])
                  .parse(u.searchParams.get("table")),
                source_id: z.uuid().parse(u.searchParams.get("id")),
              },
            },
          }),
        ),
      );
    if (action === "documents") {
      const table = z
        .enum(["work_documents", "work_commercial", "work_expenses"])
        .parse(u.searchParams.get("table"));
      let q = db
        .from(table)
        .select("*")
        .eq("status", table === "work_expenses" ? "approved" : "issued")
        .order("created_at", { ascending: false })
        .limit(51);
      const query = (u.searchParams.get("query") || "").slice(0, 100);
      if (query)
        q = q.ilike(
          table === "work_documents" ? "number" : "title",
          "%" + query.replace(/[\\%_]/g, "\\$&") + "%",
        );
      const rows = checked(await q);
      return ok({ rows: rows.slice(0, 50), more: rows.length > 50 });
    }
    if (!caps.read) throw new BusinessError("Accounting access required.", 403);
    if (action === "accounts")
      return ok(
        checked(
          await db.from("work_ledger_accounts").select("*").order("code"),
        ),
      );
    if (action === "journals") {
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(u.searchParams.get("page") || 0);
      let q = db
        .from("work_ledger_journals")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * 50, page * 50 + 50);
      const query = (u.searchParams.get("query") || "").slice(0, 100);
      if (query)
        q = q.ilike(
          "description",
          "%" + query.replace(/[\\%_]/g, "\\$&") + "%",
        );
      const rows = checked(await q);
      return ok({ rows: rows.slice(0, 50), more: rows.length > 50 });
    }
    if (action === "sources") {
      const table = z.enum(sourceTables).parse(u.searchParams.get("table"));
      let q = db
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(51);
      if (table === "work_commercial")
        q = q.eq("status", "issued").in("kind", ["invoice", "credit"]);
      if (table === "work_expenses") q = q.eq("status", "approved");
      if (table === "work_payments") q = q.eq("status", "confirmed");
      return ok({ rows: checked(await q).slice(0, 50) });
    }
    if (action === "reports" || action === "report-export") {
      const report = checked(
        await db.rpc("work_suite", {
          c: {
            action: "reports",
            data: {
              from: z
                .union([z.literal(""), z.iso.date()])
                .parse(u.searchParams.get("from") || ""),
              to: z
                .union([z.literal(""), z.iso.date()])
                .parse(u.searchParams.get("to") || ""),
            },
          },
        }),
      ) as LedgerReport;
      if (action === "reports") return ok(report);
      const trial = u.searchParams.get("kind") === "trial";
      const rows = trial
        ? report.balances.map((b) => ({
            ...b,
            debit_minor: Math.max(0, Number(b.balance_minor)),
            credit_minor: Math.max(0, -Number(b.balance_minor)),
          }))
        : report.activity;
      return new Response(
        csv(
          rows as unknown as Record<string, unknown>[],
          trial
            ? [
                "code",
                "name",
                "category",
                "currency",
                "debit_minor",
                "credit_minor",
              ]
            : [
                "entry_date",
                "reference",
                "description",
                "currency",
                "account",
                "debit_minor",
                "credit_minor",
                "cash_flow",
              ],
        ),
        {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="Lutera-${trial ? "trial-balance" : "general-ledger"}.csv"`,
            "Cache-Control": "private, no-store",
          },
        },
      );
    }
    throw new BusinessError("Unknown workspace tool.", 404);
  } catch (e) {
    return fail(e);
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
      throw new BusinessError("This request is not allowed.", 403);
    }
    const { db, user } = await businessIdentity();
    const action = (await context.params).action.join("/");
    const raw = await boundedJSON(request);
    let c: Record<string, unknown>;
    const row = z.object({
      id: z.uuid(),
      version: z.number().int().positive(),
    });
    if (action === "setup") {
      const b = z
        .object({
          version: z.number().int().positive(),
          data: ownerSetupSchema,
        })
        .strict()
        .parse(raw);
      c = { action, ...b };
    } else if (action === "responsibilities") {
      const data = z
        .object({
          email: z.email().max(254),
          title: z.string().trim().max(100),
          duties: z.string().trim().max(2000),
          ledger_post: z.boolean(),
          period_close: z.boolean(),
          sign_documents: z.boolean(),
        })
        .strict()
        .parse(raw);
      c = { action, data };
    } else if (action === "signature-profile") {
      const data = signatureProfileSchema.parse(raw);
      const image = Buffer.from(data.image_data.split(",")[1], "base64");
      if (image.length > 200000)
        throw new BusinessError("Upload a signature under 200 KB.");
      const png = await sharp(image, { limitInputPixels: 4000000 })
        .rotate()
        .resize({
          width: 640,
          height: 200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .png()
        .toBuffer();
      c = {
        action,
        data: {
          ...data,
          image_data: "data:image/png;base64," + png.toString("base64"),
        },
      };
    } else if (action === "sign") {
      const b = z
        .object({
          source_table: z.enum([
            "work_documents",
            "work_commercial",
            "work_expenses",
          ]),
          source_id: z.uuid(),
          source_version: z.number().int().positive(),
          expected_hash: z.string().regex(/^[a-f0-9]{64}$/),
          reason: z.string().trim().min(5).max(500),
          factorId: z.uuid(),
          code: z.string().regex(/^\d{6}$/),
        })
        .strict()
        .parse(raw);
      await enforceAuthLimit(db, request, "mfa/document-sign", user.id);
      const result = await db.auth.mfa.challengeAndVerify({
        factorId: b.factorId,
        code: b.code,
      });
      if (result.error)
        throw new BusinessError(
          "The authenticator code is invalid or expired. Try the latest code.",
        );
      const { factorId: _, code: __, ...data } = b;
      c = { action, data };
    } else if (action === "account") {
      c = {
        action,
        data: z
          .object({
            code: z.string().regex(/^[A-Z0-9-]{2,20}$/),
            name: z.string().trim().min(1).max(160),
            category: z.enum([
              "asset",
              "liability",
              "equity",
              "income",
              "expense",
            ]),
            cash_account: z.boolean(),
          })
          .strict()
          .parse(raw),
      };
    } else if (action === "journal-save" || action === "journal-update") {
      const b = z
        .object({
          request_key: z.uuid(),
          id: z.uuid().optional(),
          version: z.number().int().positive().optional(),
          data: journalSchema,
        })
        .strict()
        .parse(raw);
      c = {
        action,
        request_key: b.request_key,
        data: { ...b.data, ...(b.id ? { id: b.id, version: b.version } : {}) },
      };
    } else if (action === "journal-post" || action === "journal-delete") {
      c = { action, data: row.strict().parse(raw) };
    } else if (action === "journal-reverse") {
      const b = row
        .extend({
          entry_date: z.iso.date(),
          reason: z.string().trim().min(5).max(480),
          request_key: z.uuid(),
        })
        .strict()
        .parse(raw);
      const { request_key, ...data } = b;
      c = { action, request_key, data };
    } else if (action === "source") {
      const b = z
        .object({
          source_table: z.enum(sourceTables),
          source_id: z.uuid(),
          debit_account: z
            .string()
            .regex(/^[A-Z0-9-]{2,20}$/)
            .optional(),
          request_key: z.uuid(),
        })
        .strict()
        .parse(raw);
      const { request_key, ...data } = b;
      c = { action, request_key, data };
    } else if (action === "close" || action === "reopen") {
      c = {
        action,
        data: z
          .object({
            through: z.iso.date(),
            reason: z.string().trim().min(5).max(500),
            reconciled: z.literal(true),
          })
          .strict()
          .parse(raw),
      };
    } else throw new BusinessError("Unknown workspace action.", 404);
    return ok(checked(await db.rpc("work_suite", { c })));
  } catch (e) {
    return fail(e);
  }
}
