import "server-only";
import { createClient } from "@supabase/supabase-js";
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { jobDatabase, businessMail } from "./business-mail";
export const portalHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function portal(c: unknown) {
  const proof = process.env.BUSINESS_JOB_SECRET || "";
  if (!/^[a-f0-9]{64}$/.test(proof))
    throw new Error("Customer access is not configured.");
  const r = await jobDatabase().rpc("work_customer_portal", { proof, c });
  if (r.error)
    throw new Error("Customer access is unavailable or your session expired.");
  return r.data;
}
export function encryptPortalLink(link: string) {
  const key = Buffer.from(process.env.BUSINESS_JOB_SECRET || "", "hex");
  if (key.length !== 32) throw new Error("Portal configuration missing.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(link, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString("base64"))
    .join(".");
}
function decryptPortalLink(value: string) {
  const [iv, tag, data] = value.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(process.env.BUSINESS_JOB_SECRET || "", "hex"),
    iv,
  );
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
export async function dispatchPortalMail() {
  if (!process.env.BUSINESS_MAIL_KEY) return;
  for (let i = 0; i < 3; i++) {
    const m = await portal({ action: "claim_mail" });
    if (!m) return;
    let sent = false;
    try {
      const link = decryptPortalLink(m.cipher),
        body =
          "Your private customer sign-in link is below. It expires in 15 minutes and can be used once.\n\n" +
          link +
          "\n\nIf you did not request this, you can ignore this email.";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + process.env.BUSINESS_MAIL_KEY,
          "Idempotency-Key": "lutera-portal/" + m.id,
        },
        body: JSON.stringify({
          from: "Lutera Technology Ltd <business@mail.luteratech.com>",
          reply_to: "support@luteratech.com",
          to: [m.email],
          subject: "Sign in to your Lutera customer portal",
          text: body,
          html: businessMail("Your Lutera customer portal", body),
        }),
        signal: AbortSignal.timeout(10000),
      });
      sent = response.ok;
    } catch {}
    await portal({
      action: "complete_mail",
      id: m.id,
      lease_id: m.lease_id,
      sent,
    });
  }
}

export function portalStorage() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY,
    proof = process.env.BUSINESS_JOB_SECRET;
  if (!url || !key || !proof)
    throw new Error("Customer uploads are not configured.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-lutera-backup-proof": proof } },
  });
}
