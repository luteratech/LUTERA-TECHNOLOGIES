import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { database } from "@/lib/supabase";
import { workspaceOrigin } from "@/lib/origin";
import {
  assertOrigin,
  can,
  documentSchema,
  settingsSchema,
  siteSchema,
  staffSchema,
  uuid,
  roles,
  type Role,
  type Settings,
  type BusinessDocument,
  type Staff,
} from "@/lib/contracts";
import { financialExport, cardExport } from "@/lib/exports";
import { encryptBackup } from "@/lib/backup";
import { completeEmailAction, EmailActionError } from "@/lib/auth-email";
import { emailActionSchema } from "@/lib/auth-email";
import { enforceAuthLimit, AuthLimitError } from "@/lib/rate-limit";
import { newPasswordSchema } from "@/lib/password";
import { profileSchema, emailChangeSchema } from "@/lib/account-contracts";
import { normalizeAvatar } from "@/lib/avatar";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

class Failure extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function authFailure(
  error: { code?: string; status?: number },
  fallback: string,
  status = 400,
) {
  if (error.status === 429 || error.code?.startsWith("over_"))
    return new AuthLimitError(
      "Too many attempts. Please wait a minute before retrying.",
      429,
      60,
    );
  const messages: Record<string, string> = {
    email_not_confirmed:
      "Confirm your email address using the latest company email before signing in.",
    same_password: "Choose a password different from your current password.",
    weak_password:
      "This password does not meet the account security policy. Follow all password requirements.",
    reauthentication_needed:
      "For your security, sign out and sign in again before changing this setting.",
    mfa_verification_failed:
      "That authenticator code is invalid or expired. Enter the latest six-digit code.",
  };
  return new Failure(messages[error.code || ""] || fallback, status);
}
const ok = (data: unknown) =>
  Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
const check = <T>(result: {
  data: T;
  error: { message: string; code?: string } | null;
}) => {
  if (result.error) {
    const message = result.error.message;
    const safe = [
      "BUSINESS:",
      "Draft changed",
      "Issued records",
      "Voided records",
      "Receipt exceeds",
      "Link an issued",
      "Confirm the received",
      "Void linked",
      "Use another owner",
      "Invalid document",
      "Invalid totals",
      "Invalid dates",
      "Invalid line item",
      "Owner access",
      "Export permission",
      "Configure company",
      "Choose a different email",
      "Finish the pending email",
      "This email cannot be used",
    ];
    throw new Failure(
      safe.some((prefix) => message.startsWith(prefix))
        ? message.replace(/^BUSINESS: /, "")
        : "The operation could not be completed. Refresh and check your access and entered details.",
      result.error.code === "42501" ? 403 : 400,
    );
  }
  return result.data as NonNullable<T>;
};
async function identity() {
  const db = await database();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Failure("Sign in to continue", 401);
  // Reconcile an explicitly reserved, provider-confirmed email change before
  // reading membership. Roles and active status are never supplied by a user.
  check(await db.rpc("work_claim_membership"));
  const member = check(
    await db
      .from("work_members")
      .select("email,role,active")
      .eq("user_id", data.user.id)
      .maybeSingle(),
  );
  if (!member?.active)
    throw new Failure(
      "Your account has not been approved for this workspace",
      403,
    );
  return { db, user: data.user, role: member.role as Role };
}
async function authorize(area?: string) {
  const auth = await identity();
  const { data, error } =
    await auth.db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data?.currentLevel !== "aal2")
    throw new Failure("Complete authenticator verification", 403);
  // Database checks live session age, revocation, verified factor and membership.
  const allowed = check(
    await auth.db.rpc("work_has_access", { area: area || "session" }),
  );
  if (!allowed || (area && !can(auth.role, area)))
    throw new Failure(
      "Your session expired or this action is not allowed. Sign in again.",
      403,
    );
  return auth;
}
async function readBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Failure("Request body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1800000) {
      await reader.cancel();
      throw new Failure("Request is too large", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Failure("Invalid JSON");
  }
}
function download(
  data: Buffer,
  filename: string,
  format: "pdf" | "docx" | "png" | "backup",
) {
  const mime = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    png: "image/png",
    backup: "application/octet-stream",
  }[format];
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
async function triggerPublicBuild() {
  const hook = process.env.PUBLIC_SITE_DEPLOY_HOOK;
  if (!hook)
    throw new Failure(
      "Website publishing is not connected yet. Your draft is saved; ask the owner to configure the public-site deploy hook.",
      503,
    );
  const target = new URL(hook);
  if (
    target.protocol !== "https:" ||
    target.hostname !== "api.vercel.com" ||
    !target.pathname.startsWith("/v1/integrations/deploy/")
  )
    throw new Failure("The public-site deploy hook is invalid", 503);
  const response = await fetch(target, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Failure(
      "Vercel did not accept the build request. Your saved draft is safe; retry publishing.",
      502,
    );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ action: string[] }> },
) {
  try {
    const action = (await context.params).action.join("/");
    if (action === "session") {
      const auth = await identity();
      const factors = check(await auth.db.auth.mfa.listFactors());
      const assurance = check(
        await auth.db.auth.mfa.getAuthenticatorAssuranceLevel(),
      );
      let verified = false;
      if (assurance?.currentLevel === "aal2")
        verified = Boolean(
          check(await auth.db.rpc("work_has_access", { area: "session" })),
        );
      if (assurance?.currentLevel === "aal2" && !verified) {
        await auth.db.auth.signOut({ scope: "local" });
        throw new Failure("Your session expired. Sign in again.", 401);
      }
      return ok({
        email: auth.user.email,
        role: auth.role,
        verified,
        factors: factors.totp
          .filter((f) => f.status === "verified")
          .map((f) => ({ id: f.id, name: f.friendly_name })),
      });
    }
    if (action === "state") {
      const { db, role } = await authorize();
      const read = async (table: string, area: string, order = "created_at") =>
        can(role, area)
          ? check(
              await db
                .from(table)
                .select("*")
                .order(order, { ascending: false })
                .limit(200),
            )
          : [];
      const [
        documents,
        staff,
        audit,
        members,
        content,
        settings,
        publications,
      ] = await Promise.all([
        read("work_documents", "finance"),
        read("work_staff", "staff"),
        read("work_audit", "audit"),
        read("work_members", "members"),
        can(role, "content")
          ? db
              .from("work_site_drafts")
              .select("*")
              .eq("id", 1)
              .single()
              .then(check)
          : null,
        can(role, "settings") || can(role, "finance") || can(role, "staff")
          ? db
              .from("work_settings")
              .select("*")
              .eq("id", 1)
              .single()
              .then(check)
          : null,
        read("work_publications", "content"),
      ]);
      return ok({
        documents,
        staff,
        audit,
        members,
        content,
        settings,
        publications,
        publishing_connected: Boolean(process.env.PUBLIC_SITE_DEPLOY_HOOK),
      });
    }
    if (action === "account" || action === "account/avatar") {
      const { db, user, role } = await authorize();
      const profile = check(
        await db
          .from("work_profiles")
          .select("full_name,phone,avatar_path,version")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (action === "account/avatar") {
        if (!profile?.avatar_path?.startsWith(user.id + "/"))
          throw new Failure("Profile photo unavailable", 404);
        const file = check(
          await db.storage.from("work-avatars").download(profile.avatar_path),
        );
        return new Response(await file.arrayBuffer(), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, no-store",
          },
        });
      }
      const pending = check(
        await db
          .from("work_email_changes")
          .select("new_email")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      const factors = check(await db.auth.mfa.listFactors());
      return ok({
        email: user.email,
        role,
        pending_email: pending?.new_email || null,
        profile: {
          full_name: profile?.full_name || "",
          phone: profile?.phone || "",
          avatar_url: profile?.avatar_path
            ? `/api/account/avatar?v=${profile.version}`
            : null,
          version: profile?.version || 0,
        },
        factors: factors.totp
          .filter((f) => f.status === "verified")
          .map((f) => ({ id: f.id, name: f.friendly_name || "Authenticator" })),
      });
    }
    if (action.startsWith("photo/")) {
      const { db } = await authorize("staff");
      const file = action.slice(6);
      if (!/^[0-9a-f-]{36}\.jpg$/.test(file))
        throw new Failure("Invalid photo");
      const data = check(await db.storage.from("work-staff").download(file));
      if (!data) throw new Failure("Photo unavailable", 404);
      return new Response(await data.arrayBuffer(), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, no-store",
        },
      });
    }
    throw new Failure("Page not found", 404);
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
      throw new Failure("Request origin was rejected", 403);
    }
    const input = await readBody(request),
      action = (await context.params).action.join("/");
    if (action === "auth/email-confirm") {
      try {
        const body = emailActionSchema.parse(input),
          db = await database();
        await enforceAuthLimit(db, request, action, body.token_hash);
        const result = await completeEmailAction(db, body);
        if (result.next === "email_pending") return ok(result);
        const entry = process.env.WORKSPACE_ENTRY || "";
        if (!/^[A-Za-z0-9_-]{32,128}$/.test(entry))
          throw new Failure("Workspace entry is unavailable", 503);
        return ok({
          ...result,
          redirect: `/${entry}${result.next === "password" ? "?account=password" : ""}`,
        });
      } catch (error) {
        if (error instanceof EmailActionError)
          throw new Failure(error.message, error.status);
        throw error;
      }
    }
    if (action === "auth/signin") {
      const body = z
        .object({
          email: z.string().trim().toLowerCase().pipe(z.email()),
          password: z.string().min(1).max(256),
        })
        .strict()
        .parse(input);
      const db = await database();
      await enforceAuthLimit(db, request, action, body.email);
      const result = await db.auth.signInWithPassword(body);
      if (result.error)
        throw authFailure(
          result.error,
          "Sign-in failed. Check your email and password.",
          401,
        );
      const claim = await db.rpc("work_claim_membership");
      if (claim.error) {
        await db.auth.signOut({ scope: "local" });
        throw new Failure(
          "This verified account has not been approved for the workspace",
          403,
        );
      }
      return ok({ success: true });
    }
    if (action === "auth/signout") {
      const db = await database();
      const result = await db.auth.signOut({ scope: "global" });
      if (result.error)
        throw new Failure("Sign-out could not be completed; retry.", 503);
      return ok({ success: true });
    }
    if (action === "mfa/enroll") {
      const { db, user } = await identity();
      await enforceAuthLimit(db, request, action, user.id);
      const factors = check(await db.auth.mfa.listFactors());
      if (factors.totp.some((f) => f.status === "verified"))
        throw new Failure("Verify your existing authenticator");
      for (const factor of factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      ))
        check(await db.auth.mfa.unenroll({ factorId: factor.id }));
      const enrollment = check(
        await db.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Lutera workspace",
          issuer: "Lutera Technology Ltd",
        }),
      );
      return ok({
        id: enrollment.id,
        qr: enrollment.totp.qr_code,
        secret: enrollment.totp.secret,
      });
    }
    if (action === "mfa/verify") {
      const { db, user } = await identity();
      const body = z
        .object({ factorId: uuid, code: z.string().regex(/^[0-9]{6}$/) })
        .strict()
        .parse(input);
      await enforceAuthLimit(db, request, action, user.id);
      const verified = await db.auth.mfa.challengeAndVerify(body);
      if (verified.error)
        throw authFailure(
          verified.error,
          "That authenticator code is invalid or expired. Enter the latest six-digit code.",
        );
      return ok({ success: true });
    }
    if (action === "mfa/add") {
      const { db, user } = await authorize();
      const body = z
        .object({ name: z.string().trim().min(1).max(60) })
        .strict()
        .parse(input);
      await enforceAuthLimit(db, request, action, user.id);
      const factors = check(await db.auth.mfa.listFactors());
      if (factors.totp.filter((f) => f.status === "verified").length >= 3)
        throw new Failure(
          "Up to three authenticators can be enrolled. Contact the owner to recover or replace a lost device.",
        );
      for (const factor of factors.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      ))
        check(await db.auth.mfa.unenroll({ factorId: factor.id }));
      const result = await db.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: body.name,
        issuer: "Lutera Technology Ltd",
      });
      if (result.error)
        throw authFailure(
          result.error,
          "Authenticator setup could not be started. Try a different device name.",
        );
      return ok({
        id: result.data.id,
        qr: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
    }
    if (action === "mfa/confirm-add") {
      const { db, user } = await authorize();
      const body = z
        .object({ factorId: uuid, code: z.string().regex(/^[0-9]{6}$/) })
        .strict()
        .parse(input);
      await enforceAuthLimit(db, request, action, user.id);
      const result = await db.auth.mfa.challengeAndVerify(body);
      if (result.error)
        throw authFailure(
          result.error,
          "That code is invalid or expired. Enter the latest code from the new authenticator.",
        );
      return ok({ success: true });
    }
    if (action === "auth/password") {
      const { db, user } = await authorize();
      const body = z
        .object({ password: newPasswordSchema })
        .strict()
        .parse(input);
      await enforceAuthLimit(db, request, action, user.id);
      const updated = await db.auth.updateUser({ password: body.password });
      if (updated.error)
        throw authFailure(
          updated.error,
          "Password update failed. Use a different password that meets all requirements.",
        );
      const result = await db.auth.signOut({ scope: "global" });
      if (result.error)
        throw new Failure(
          "Password changed. Sign out now to complete the session reset.",
          503,
        );
      return ok({ success: true });
    }
    if (action === "account/email") {
      const { db, user } = await authorize();
      const body = emailChangeSchema.parse(input);
      await enforceAuthLimit(db, request, action, user.id);
      const created = check(
        await db.rpc("work_prepare_email_change", { new_address: body.email }),
      );
      const result = await db.auth.updateUser(
        { email: body.email },
        { emailRedirectTo: workspaceOrigin() + "/auth/confirm" },
      );
      if (result.error) {
        if (created)
          await db.rpc("work_abort_email_change", { new_address: body.email });
        throw authFailure(
          result.error,
          "Email change could not be sent. Check the address and retry.",
        );
      }
      return ok({
        success: true,
        message:
          "Confirmation requested. Check both your current and new email inboxes. Your current address stays active until confirmation is complete.",
      });
    }
    if (action === "account/profile") {
      const { db, user } = await authorize();
      const body = profileSchema.parse(input);
      const current = check(
        await db
          .from("work_profiles")
          .select("version,avatar_path")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if ((current?.version || 0) !== body.version)
        throw new Failure(
          "Your profile changed elsewhere. Reload it before saving.",
          409,
        );
      let path = body.remove_photo ? "" : current?.avatar_path || "";
      let uploaded = "";
      if (body.photo) {
        let image: Buffer;
        try {
          image = await normalizeAvatar(body.photo);
        } catch (error) {
          throw new Failure((error as Error).message);
        }
        uploaded = user.id + "/" + randomUUID() + ".jpg";
        check(
          await db.storage
            .from("work-avatars")
            .upload(uploaded, image, {
              contentType: "image/jpeg",
              upsert: false,
            }),
        );
        path = uploaded;
      }
      try {
        const payload = {
          user_id: user.id,
          full_name: body.full_name,
          phone: body.phone,
          avatar_path: path,
        };
        const result = await (
          current
            ? db
                .from("work_profiles")
                .update(payload)
                .eq("user_id", user.id)
                .eq("version", body.version)
            : db.from("work_profiles").insert(payload)
        )
          .select("version")
          .maybeSingle();
        if (result.error?.code === "23505" || (!result.error && !result.data))
          throw new Failure(
            "Your profile changed elsewhere. Reload it before saving.",
            409,
          );
        check(result);
      } catch (error) {
        if (uploaded) await db.storage.from("work-avatars").remove([uploaded]);
        throw error;
      }
      if (current?.avatar_path && current.avatar_path !== path)
        await db.storage.from("work-avatars").remove([current.avatar_path]);
      return ok({ success: true, message: "Your profile has been updated." });
    }
    if (action === "records") {
      const body = z
        .object({
          area: z.enum(["finance", "staff"]),
          kind: z.enum(["quotation", "proforma", "receipt"]).optional(),
          query: z.string().trim().max(100),
          field: z.enum(["name", "number", "title"]),
          status: z.enum(["all", "draft", "issued", "void"]),
          page: z.number().int().min(0).max(20000),
        })
        .strict()
        .parse(input);
      const { db } = await authorize(body.area);
      const table = body.area === "finance" ? "work_documents" : "work_staff";
      let query = db
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(body.page * 50, body.page * 50 + 50);
      if (body.query) {
        const field =
          body.area === "finance"
            ? body.field === "number"
              ? "number"
              : "payload->customer->>name"
            : body.field === "number"
              ? "payload->>staff_number"
              : body.field === "title"
                ? "payload->>title"
                : "payload->>name";
        query = query.ilike(
          field,
          `%${body.query.replace(/[\\%_]/g, "\\$&")}%`,
        );
      }
      if (body.area === "finance" && body.status !== "all")
        query = query.eq("status", body.status);
      if (body.area === "finance" && body.kind)
        query = query.eq("kind", body.kind);
      const rows = check(await query);
      return ok({ rows: rows.slice(0, 50), more: rows.length > 50 });
    }
    if (action === "documents/save") {
      const { db } = await authorize("finance");
      const body = z
        .object({
          id: uuid.optional(),
          version: z.number().int().min(1).optional(),
          payload: documentSchema,
        })
        .strict()
        .parse(input);
      const result = body.id
        ? await db
            .from("work_documents")
            .update({ payload: body.payload })
            .eq("id", body.id)
            .eq("version", body.version || 0)
            .eq("status", "draft")
            .select()
            .maybeSingle()
        : await db
            .from("work_documents")
            .insert({ kind: body.payload.kind, payload: body.payload })
            .select()
            .single();
      const data = check(result);
      if (!data)
        throw new Failure(
          "This draft changed or was issued. Refresh before editing.",
          409,
        );
      return ok(data);
    }
    if (action === "documents/status") {
      const { db } = await authorize("finance");
      const body = z
        .object({
          id: uuid,
          version: z.number().int(),
          action: z.enum(["issue", "void", "delete"]),
          reason: z.string().trim().min(5).max(500).optional(),
        })
        .strict()
        .parse(input);
      const current = check(
        await db
          .from("work_documents")
          .select("*")
          .eq("id", body.id)
          .eq("version", body.version)
          .single(),
      );
      if (body.action === "delete") {
        const deleted = check(
          await db
            .from("work_documents")
            .delete()
            .eq("id", body.id)
            .eq("version", body.version)
            .eq("status", "draft")
            .select("id"),
        );
        if (deleted.length !== 1)
          throw new Failure("Only an unchanged draft can be deleted", 409);
        return ok({ success: true });
      }
      if (body.action === "void" && !body.reason)
        throw new Failure("Enter a reason to void the document");
      const data = check(
        await db
          .from("work_documents")
          .update({
            status: body.action === "issue" ? "issued" : "void",
            payload:
              body.action === "void"
                ? { ...current.payload, void_reason: body.reason }
                : current.payload,
          })
          .eq("id", body.id)
          .eq("version", body.version)
          .select()
          .maybeSingle(),
      );
      if (!data)
        throw new Failure(
          "This document changed. Refresh before continuing.",
          409,
        );
      return ok(data);
    }
    if (action === "staff/save") {
      const { db } = await authorize("staff");
      const body = z
        .object({
          id: uuid.optional(),
          version: z.number().int().optional(),
          payload: staffSchema,
        })
        .strict()
        .parse(input);
      if (body.payload.photo_path)
        check(
          await db.storage.from("work-staff").download(body.payload.photo_path),
        );
      const data = check(
        body.id
          ? await db
              .from("work_staff")
              .update({ payload: body.payload })
              .eq("id", body.id)
              .eq("version", body.version || 0)
              .select()
              .maybeSingle()
          : await db
              .from("work_staff")
              .insert({ payload: body.payload })
              .select()
              .single(),
      );
      if (!data)
        throw new Failure(
          "This staff record changed. Refresh before editing.",
          409,
        );
      return ok(data);
    }
    if (action === "staff/delete") {
      const { db } = await authorize("staff");
      const body = z
        .object({ id: uuid, version: z.number().int() })
        .strict()
        .parse(input);
      const data = check(
        await db
          .from("work_staff")
          .delete()
          .eq("id", body.id)
          .eq("version", body.version)
          .select("id,payload"),
      );
      if (data.length !== 1)
        throw new Failure(
          "Staff record changed. Refresh before deleting.",
          409,
        );
      const file = data[0].payload.photo_path;
      if (file) {
        const others = check(
          await db
            .from("work_staff")
            .select("id")
            .eq("payload->>photo_path", file)
            .limit(1),
        );
        if (!others.length)
          check(await db.storage.from("work-staff").remove([file]));
      }
      return ok({ success: true });
    }
    if (action === "staff/photo") {
      const { db } = await authorize("staff");
      const body = z
        .object({ data: z.string().min(1).max(1400000) })
        .strict()
        .parse(input);
      const bytes = Buffer.from(body.data, "base64");
      if (bytes.length > 1048576)
        throw new Failure("Choose a photo under 1 MB");
      const image = sharp(bytes, {
        limitInputPixels: 16000000,
        animated: false,
      });
      const info = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(info.format || ""))
        throw new Failure("Use a JPEG, PNG or WebP photograph");
      const normalized = await image
        .rotate()
        .resize(600, 750, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toBuffer();
      const file = randomUUID() + ".jpg";
      check(
        await db.storage.from("work-staff").upload(file, normalized, {
          contentType: "image/jpeg",
          upsert: false,
        }),
      );
      return ok({ path: file });
    }
    if (action === "settings/save" || action === "content/save") {
      const area = action.startsWith("settings") ? "settings" : "content",
        { db } = await authorize(area);
      const body = z
        .object({
          version: z.number().int().min(1),
          payload: area === "settings" ? settingsSchema : siteSchema,
        })
        .strict()
        .parse(input);
      const table = area === "settings" ? "work_settings" : "work_site_drafts",
        field = area === "settings" ? "payload" : "content";
      const data = check(
        await db
          .from(table)
          .update({ [field]: body.payload })
          .eq("id", 1)
          .eq("version", body.version)
          .select()
          .maybeSingle(),
      );
      if (!data)
        throw new Failure("This version changed. Refresh before saving.", 409);
      return ok(data);
    }
    if (action === "content/publish") {
      const { db } = await authorize("content");
      const body = z
        .object({ version: z.number().int().min(1) })
        .strict()
        .parse(input);
      if (!process.env.PUBLIC_SITE_DEPLOY_HOOK)
        throw new Failure(
          "Publishing is not connected yet. Save your draft; the public-site deploy hook must be configured first.",
          503,
        );
      const draft = check(
        await db
          .from("work_site_drafts")
          .select("content,version")
          .eq("id", 1)
          .single(),
      );
      siteSchema.parse(draft.content);
      const revision = check(
        await db.rpc("work_publish_site", { expected_version: body.version }),
      );
      try {
        await triggerPublicBuild();
        check(
          await db
            .from("work_publications")
            .update({
              status: "building",
              updated_at: new Date().toISOString(),
            })
            .eq("id", revision),
        );
      } catch (error) {
        await db
          .from("work_publications")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", revision);
        throw error;
      }
      return ok({ revision, status: "building" });
    }
    if (action === "content/check-live") {
      const { db } = await authorize("content");
      const body = z.object({ revision: uuid }).strict().parse(input);
      const response = await fetch(
        "https://luteratech.com/site-revision.json",
        {
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      const match =
        response.ok && (await response.json()).revision === body.revision;
      if (match)
        check(
          await db
            .from("work_publications")
            .update({ status: "live", updated_at: new Date().toISOString() })
            .eq("id", body.revision),
        );
      return ok({ live: match });
    }
    if (action === "members/save") {
      const { db } = await authorize("members");
      const body = z
        .object({ email: z.email(), role: z.enum(roles), active: z.boolean() })
        .strict()
        .parse(input);
      check(
        await db.rpc("work_set_member", {
          email_address: body.email,
          member_role: body.role,
          enabled: body.active,
        }),
      );
      return ok({ success: true });
    }
    if (action === "export") {
      const body = z
        .object({
          entity: z.enum(["document", "staff"]),
          id: uuid,
          format: z.enum(["pdf", "docx", "png"]),
          template: z.enum(["name", "id"]).default("name"),
          side: z.enum(["front", "back"]).default("front"),
        })
        .strict()
        .parse(input);
      const { db } = await authorize(
        body.entity === "document" ? "finance" : "staff",
      );
      const settings = check(
        await db.from("work_settings").select("payload").eq("id", 1).single(),
      ).payload as Settings;
      let bytes: Buffer, name: string;
      if (body.entity === "document") {
        const doc = check(
          await db
            .from("work_documents")
            .select("*")
            .eq("id", body.id)
            .single(),
        ) as BusinessDocument;
        bytes = await financialExport(doc, settings, body.format);
        name = doc.number || `draft-${doc.id}`;
      } else {
        const staff = check(
          await db.from("work_staff").select("*").eq("id", body.id).single(),
        ) as Staff;
        let photo: Buffer | undefined;
        if (staff.payload.photo_path) {
          const file = check(
            await db.storage
              .from("work-staff")
              .download(staff.payload.photo_path),
          );
          photo = Buffer.from(await file.arrayBuffer());
        }
        bytes = await cardExport(
          staff,
          settings,
          body.template,
          body.format,
          body.side,
          photo,
        );
        name = `${body.template}-card-${staff.id}-${body.side}`;
      }
      check(
        await db.rpc("work_log_export", {
          export_action: `export_${body.format}`,
          table_name: body.entity,
          record_id: body.id,
        }),
      );
      return download(bytes, `${name}.${body.format}`, body.format);
    }
    if (action === "backup") {
      const { db } = await authorize("backup");
      const body = z
        .object({ password: z.string().min(16).max(256) })
        .strict()
        .parse(input);
      const snapshot = check(await db.rpc("work_backup_snapshot"));
      const photos: Record<string, string> = {};
      let size = Buffer.byteLength(JSON.stringify(snapshot));
      for (const file of new Set<string>(
        snapshot.staff.map((s: Staff) => s.payload.photo_path).filter(Boolean),
      )) {
        const data = check(await db.storage.from("work-staff").download(file));
        size += data.size;
        if (size > 40000000)
          throw new Failure(
            "Backup exceeds 40 MB. Use the documented full database and storage backup procedure.",
            413,
          );
        photos[file] = Buffer.from(await data.arrayBuffer()).toString("base64");
      }
      const files: Record<string,string>={};
      const backupAuth=await db.auth.getSession();
      const backupSession=backupAuth.data.session;
      if(!backupSession)throw new Failure('Sign in again before creating a backup.',401);
      const backupStorage=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+backupSession.access_token,'x-lutera-backup-proof':process.env.BUSINESS_JOB_SECRET||''}}});
      const manifests=[...(snapshot.work_files||[]).map((f:{path:string})=>({bucket:'work-evidence',path:f.path})),...(snapshot.work_profiles||[]).filter((p:{avatar_path:string})=>p.avatar_path).map((p:{avatar_path:string})=>({bucket:'work-avatars',path:p.avatar_path}))];
      for(const f of manifests){const file=check(await backupStorage.storage.from(f.bucket).download(f.path));size+=file.size;if(size>40000000)throw new Failure('Use the full database and storage backup procedure for this archive.',413);files[f.bucket+'/'+f.path]=Buffer.from(await file.arrayBuffer()).toString('base64')}
      const bytes = await encryptBackup(
        {
          format: "lutera-records-v1",
          created_at: new Date().toISOString(),
          data: snapshot,
          photos,
          files,
        },
        body.password,
      );
      if (bytes.length > 4000000)
        throw new Failure(
          "The encrypted backup exceeds the download limit. Use the full database and storage backup procedure in the deployment runbook.",
          413,
        );
      return download(
        bytes,
        `lutera-${new Date().toISOString().slice(0, 10)}.lutera-backup`,
        "backup",
      );
    }
    throw new Failure("Page not found", 404);
  } catch (error) {
    return fail(error);
  }
}
function fail(error: unknown) {
  if (error instanceof AuthLimitError)
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "Cache-Control": "private, no-store",
          ...(error.retryAfter
            ? { "Retry-After": String(error.retryAfter) }
            : {}),
        },
      },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .slice(0, 4)
          .join("; "),
      },
      { status: 400 },
    );
  if (error instanceof Failure)
    return Response.json({ error: error.message }, { status: error.status });
  if (
    error instanceof Error &&
    ["The PDF font cannot", "Card text is too long"].some((prefix) =>
      error.message.startsWith(prefix),
    )
  )
    return Response.json({ error: error.message }, { status: 400 });
  console.error(
    "Workspace request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return Response.json(
    {
      error:
        "The request could not be completed. Your saved records are safe; retry or contact the workspace owner.",
    },
    { status: 500 },
  );
}
