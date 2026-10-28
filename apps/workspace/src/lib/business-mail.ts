import "server-only";
import { statementPDF, type StatementSnapshot } from "./statement";
import { createClient } from "@supabase/supabase-js";
import { financialExport } from "./exports";
import type { BusinessDocument, Settings } from "./contracts";
export function jobDatabase() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Business service is not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function job(c: unknown) {
  const proof = process.env.BUSINESS_JOB_SECRET;
  if (!/^[a-f0-9]{64}$/.test(proof || ""))
    throw new Error("Business jobs are not configured.");
  const result = await jobDatabase().rpc("work_business_job", { proof, c });
  if (result.error) throw new Error("Business job request failed.");
  return result.data;
}
const escape = (v: string) =>
  v.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function businessMail(subject: string, body: string) {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' +
    escape(subject) +
    '</title></head><body style="margin:0;background:#f3f2ee;color:#151936;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="600" style="max-width:100%;background:#fff"><tr><td style="padding:32px"><img src="https://luteratech.com/assets/logo/lutera-email-logo.png" width="168" alt="Lutera Technology Ltd"><h1 style="font-size:24px;line-height:1.4">' +
    escape(subject) +
    '</h1><p style="font-size:16px;line-height:1.7;white-space:pre-line">' +
    escape(body) +
    '</p><hr style="border:0;border-top:1px solid #d7dae4"><p style="font-size:13px;line-height:1.6">Lutera Technology Ltd<br>No. 7, Mahatma Gandhi Street, Area 11, Garki, Abuja, FCT, Nigeria<br><a href="https://luteratech.com">luteratech.com</a></p></td></tr></table></td></tr></table></body></html>'
  );
}
type MailJob = {
  id: string;
  lease_id: string;
  recipient: string;
  subject: string;
  body: string;
  document?: Record<string, unknown>;
  legacy?: BusinessDocument;
  statement_snapshot?: StatementSnapshot;
  lines?: { description: string; quantity: number; unit_minor: number }[];
};
export async function dispatchBusinessMail() {
  const key = process.env.BUSINESS_MAIL_KEY;
  if (!key) return { processed: 0, configured: false };
  const messages = (await job({ action: "claim" })) as MailJob[];
  let sent = 0;
  // A claim is leased transactionally. Provider idempotency covers a crash after
  // acceptance and before the completion write. Retries stop inside 24 hours.
  for (let offset = 0; offset < messages.length; offset += 3)
    await Promise.all(
      messages.slice(offset, offset + 3).map(async (m) => {
        let provider_id = "",
          error = "";
        try {
          const attachments: { filename: string; content: string }[] = [];
          if (m.statement_snapshot) {
            const bytes = await statementPDF(m.statement_snapshot);
            attachments.push({
              filename: "Lutera-customer-statement.pdf",
              content: bytes.toString("base64"),
            });
          }
          if (m.document) {
            const r = m.document;
            const snap = r.snapshot as {
              party: {
                name: string;
                address: string;
                email: string;
                phone: string;
              };
              company: Settings;
            };
            const payload = {
              kind: r.kind,
              customer: snap.party,
              date: r.document_date,
              valid_until: r.due_date || "",
              currency: r.currency,
              items: m.lines || [],
              discount_minor: r.discount_minor,
              tax_bps: r.tax_bps,
              notes: r.notes,
              payment_method: "",
              payment_reference: "",
              payment_confirmed: false,
              source_id: "",
              company: snap.company,
            };
            const doc = { ...r, payload } as unknown as BusinessDocument;
            const bytes = await financialExport(doc, snap.company, "pdf");
            attachments.push({
              filename: String(r.number) + ".pdf",
              content: bytes.toString("base64"),
            });
          }
          if (m.legacy) {
            const bytes = await financialExport(
              m.legacy,
              m.legacy.payload.company!,
              "pdf",
            );
            attachments.push({
              filename: String(m.legacy.number) + ".pdf",
              content: bytes.toString("base64"),
            });
          }
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + key,
              "Content-Type": "application/json",
              "Idempotency-Key": "lutera-business/" + m.id,
            },
            body: JSON.stringify({
              from: "Lutera Technology Ltd <business@mail.luteratech.com>",
              reply_to: "info@luteratech.com",
              to: [m.recipient],
              subject: m.subject,
              text: m.body,
              html: businessMail(m.subject, m.body),
              ...(attachments.length ? { attachments } : {}),
            }),
            signal: AbortSignal.timeout(10000),
          });
          const result = await res.json();
          if (!res.ok || typeof result.id !== "string")
            throw new Error("Mail provider did not accept this message.");
          provider_id = result.id;
          sent++;
        } catch {
          error =
            "Delivery attempt failed. Check integration health before retrying.";
        }
        await job({
          action: "complete",
          id: m.id,
          lease_id: m.lease_id,
          provider_id,
          error,
        });
      }),
    );
  return { processed: messages.length, sent, configured: true };
}
