import { randomBytes, randomUUID, createHash } from "node:crypto";
import { normalizeEvidence } from "@/lib/evidence";
import { portalStorage } from "@/lib/customer-portal";
import { cookies } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import {
  portal,
  portalHash,
  encryptPortalLink,
  dispatchPortalMail,
} from "@/lib/customer-portal";
import { jobDatabase } from "@/lib/business-mail";
import { enforceAuthLimit, AuthLimitError } from "@/lib/rate-limit";
import { workspaceOrigin } from "@/lib/origin";
import { financialExport } from "@/lib/exports";
import type { BusinessDocument, Settings } from "@/lib/contracts";
import { assertOrigin } from "@/lib/contracts";
import { boundedJSON } from "@/lib/business-server";
export const runtime = "nodejs";
export const maxDuration = 60;
const cookieName = "lutera_customer_session";
async function session() {
  const token = (await cookies()).get(cookieName)?.value || "";
  return /^[a-f0-9]{64}$/.test(token) ? portalHash(token) : "";
}
const ok = (r: unknown) =>
  Response.json(r, { headers: { "Cache-Control": "private, no-store" } });
export async function GET(
  request: Request,
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    const action = (await context.params).action.join("/");
    const hash = await session();
    if (!hash)
      return Response.json(
        { error: "Sign in to the customer portal." },
        { status: 401 },
      );
    if (action === "session")
      return ok(await portal({ action: "state", session_hash: hash }));
    if (action === "document" || action === "download") {
      const id = z.uuid().parse(new URL(request.url).searchParams.get("id"));
      const data = await portal({
        action: "document",
        share_id: id,
        session_hash: hash,
      });
      if (action === "document") return ok(data);
      const r = data.legacy || data.record;
      const settings = (
        data.legacy ? r.payload.company : r.snapshot.company
      ) as Settings;
      const doc = (
        data.legacy
          ? r
          : {
              ...r,
              payload: {
                kind: r.kind,
                customer: r.snapshot.party,
                date: r.document_date,
                valid_until: r.due_date || "",
                currency: r.currency,
                items: data.lines,
                discount_minor: r.discount_minor,
                tax_bps: r.tax_bps,
                notes: r.notes,
                payment_method: "",
                payment_reference: "",
                payment_confirmed: false,
                source_id: "",
                company: settings,
              },
            }
      ) as BusinessDocument;
      const bytes = await financialExport(doc, settings, "pdf", data.approvals || []);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="' +
            String(r.number).replace(/[^A-Za-z0-9_-]/g, "") +
            '.pdf"',
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new Response(null, { status: 404 });
  } catch {
    return Response.json(
      {
        error: "Your customer session expired or this document is unavailable.",
      },
      { status: 401 },
    );
  }
}
export async function POST(
  request: Request,
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    assertOrigin(request, workspaceOrigin());
    const raw = await boundedJSON(request),
      action = (await context.params).action.join("/");
    if (action === "request") {
      const { email } = z
        .object({ email: z.email().max(254) })
        .strict()
        .parse(raw);
      await enforceAuthLimit(jobDatabase(), request, "portal/request", email);
      const token = randomBytes(32).toString("hex"),
        link = workspaceOrigin() + "/portal#token=" + token;
      await portal({
        action: "request",
        email: email.toLowerCase(),
        token_hash: portalHash(token),
        cipher: encryptPortalLink(link),
      });
      after(() => dispatchPortalMail().catch(() => {}));
      return ok({
        message:
          "If this email has approved customer access, a sign-in link will arrive shortly.",
      });
    }
    if (action === "exchange") {
      const { token } = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .strict()
        .parse(raw);
      await enforceAuthLimit(
        jobDatabase(),
        request,
        "portal/exchange",
        portalHash(token),
      );
      const value = randomBytes(32).toString("hex");
      await portal({
        action: "exchange",
        token_hash: portalHash(token),
        session_hash: portalHash(value),
      });
      (await cookies()).set(cookieName, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/portal",
        maxAge: 8 * 60 * 60,
      });
      return ok({ success: true });
    }
    const hash = await session();
    if (!hash)
      return Response.json(
        { error: "Customer sign-in required." },
        { status: 401 },
      );
    if (action === "signout") {
      await portal({ action: "signout", session_hash: hash });
      (await cookies()).set(cookieName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/portal",
        maxAge: 0,
      });
      return ok({ success: true });
    }
    if (action === "evidence") {
      const b = z
        .object({
          request_id: z.uuid(),
          name: z.string().trim().min(1).max(160),
          data: z.string().max(1400000),
        })
        .strict()
        .parse(raw);
      await enforceAuthLimit(jobDatabase(), request, "portal/evidence", hash);
      const prepared = await normalizeEvidence(Buffer.from(b.data, "base64")),
        id = randomUUID();
      const record = await portal({
        action: "reserve_evidence",
        request_id: b.request_id,
        session_hash: hash,
        id,
        name: b.name,
        content_type: prepared.type,
        size: prepared.bytes.length,
        sha256: createHash("sha256").update(prepared.bytes).digest("hex"),
      });
      const result = await portalStorage()
        .storage.from("work-portal-evidence")
        .upload(record.path, prepared.bytes, {
          contentType: prepared.type,
          upsert: false,
        });
      if (result.error) throw new Error("Upload failed");
      return ok(
        await portal({
          action: "complete_evidence",
          request_id: b.request_id,
          id,
          session_hash: hash,
        }),
      );
    }
    if (action === "ticket") {
      const b = z
        .object({
          customer_id: z.uuid(),
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().min(10).max(6000),
        })
        .strict()
        .parse(raw);
      await enforceAuthLimit(jobDatabase(), request, "portal/ticket", hash);
      return ok(await portal({ action: "ticket", ...b, session_hash: hash }));
    }
    if (action === "accept" || action === "decline") {
      const { share_id, confirmed } = z
        .object({ share_id: z.uuid(), confirmed: z.literal(true) })
        .strict()
        .parse(raw);
      await enforceAuthLimit(jobDatabase(), request, "portal/accept", hash);
      return ok(await portal({ action, share_id, session_hash: hash }));
    }
    return new Response(null, { status: 404 });
  } catch (error) {
    const rate = error instanceof AuthLimitError;
    return Response.json(
      {
        error: rate
          ? error.message
          : error instanceof z.ZodError
            ? "Check your email or sign-in link."
            : "Customer access could not be completed. Check your link or contact Lutera.",
      },
      {
        status: rate ? error.status : 400,
        headers:
          rate && error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : {},
      },
    );
  }
}
