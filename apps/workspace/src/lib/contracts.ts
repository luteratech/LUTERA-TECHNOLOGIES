import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) => !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value),
      "Remove unsupported control characters",
    );
const required = (max: number) => text(max).min(1);
export const uuid = z.uuid();
export const roles = [
  "owner",
  "admin",
  "editor",
  "finance",
  "designer",
] as const;
export type Role = (typeof roles)[number];
export const permissions: Record<string, readonly Role[]> = {
  content: ["owner", "admin", "editor"],
  finance: ["owner", "admin", "finance"],
  staff: ["owner", "admin", "designer"],
  settings: ["owner", "admin"],
  audit: ["owner", "admin"],
  members: ["owner"],
  backup: ["owner"],
};
export const can = (role: Role, area: string) =>
  permissions[area]?.includes(role) ?? false;
export const icons = [
  "procurement",
  "hardware",
  "consulting",
  "support",
  "server",
  "network",
  "laptop",
  "accessory",
  "printer",
  "automation",
  "software",
  "data",
  "cloud",
] as const;
export const photos = [
  "laptop",
  "desktop",
  "consulting",
  "support",
  "ai",
  "software",
  "data",
  "servers",
  "network",
  "accessory",
  "printer",
  "procurement",
  "workplace",
] as const;
const https = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Use an HTTPS URL without credentials");
export const companySchema = z
  .object({
    name: required(140),
    legal_name: required(140),
    registration_completed: z.boolean(),
    registration_number: text(80),
    email: z.email().max(254),
    support_email: z.email().max(254).optional(),
    phone: z.string().regex(/^\+[1-9][0-9]{7,14}$/),
    display_phone: required(40),
    whatsapp: https.max(200),
    street_address: required(250),
    city: required(100),
    state: required(100),
    country: z.string().regex(/^[A-Z]{2}$/),
    lga: text(150),
    house_number: text(30),
    nature_of_business: required(4000),
    brand_name: required(100),
  })
  .strict();
export const serviceSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
    slug: z.string().regex(/^[a-z][a-z0-9-]{1,59}$/),
    title: required(120),
    icon: z.enum(icons),
    image: z.enum(photos),
    alt: required(220),
    description: required(800),
    detail: z
      .object({
        heading: required(160),
        body: required(5000),
        points: z.array(required(300)).min(1).max(12),
      })
      .strict()
      .optional(),
  })
  .strict();
export const siteSchema = z
  .object({
    hosting: z
      .object({
        production_origin: z.literal("https://luteratech.com"),
        redirect_origins: z.array(https).max(4),
      })
      .strict(),
    company: companySchema,
    services: z
      .array(serviceSchema)
      .min(1)
      .max(30)
      .refine(
        (list) =>
          new Set(list.map((s) => s.key)).size === list.length &&
          new Set(list.map((s) => s.slug)).size === list.length,
        "Service keys and slugs must be unique",
      ),
    commitments: z
      .array(
        z.object({ title: required(140), description: required(800) }).strict(),
      )
      .min(1)
      .max(8),
    socials: z
      .array(z.object({ label: required(40), url: https.max(300) }).strict())
      .max(8)
      .optional(),
  })
  .strict();
export type SiteContent = z.infer<typeof siteSchema>;
export const settingsSchema = z
  .object({
    company: z
      .object({
        name: required(140),
        address: required(500),
        email: z.email(),
        phone: required(40),
        website: https,
      })
      .strict(),
    bank_name: text(140),
    account_name: text(160),
    account_number: text(40),
    tax_id: text(80),
    document_notes: text(2000),
    currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const documentSchema = z
  .object({
    kind: z.enum(["quotation", "proforma", "receipt"]),
    customer: z
      .object({
        name: required(160),
        address: text(600),
        email: z.union([z.literal(""), z.email()]),
        phone: text(40),
      })
      .strict(),
    date: z.iso.date(),
    valid_until: z.union([z.literal(""), z.iso.date()]),
    currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
    items: z
      .array(
        z
          .object({
            description: required(400),
            quantity: z.number().int().min(1).max(1000000),
            unit_minor: z.number().int().min(1).max(100000000000),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    discount_minor: z.number().int().min(0).max(1000000000000),
    tax_bps: z.number().int().min(0).max(10000),
    notes: text(2000),
    payment_method: text(100),
    payment_reference: text(160),
    payment_confirmed: z.boolean(),
    evidence_id: z.union([z.literal(""), uuid]).optional(),
    customer_id: z.union([z.literal(""), uuid]).optional(),
    request_key: uuid.optional(),
    source_id: z.union([z.literal(""), uuid]),
  })
  .strict()
  .superRefine((doc, ctx) => {
    const subtotal = doc.items.reduce(
      (sum, item) => sum + BigInt(item.quantity) * BigInt(item.unit_minor),
      0n,
    );
    if (subtotal <= BigInt(doc.discount_minor))
      ctx.addIssue({
        code: "custom",
        message: "Discount must be less than the subtotal",
      });
    if (subtotal > 1000000000000n)
      ctx.addIssue({
        code: "custom",
        message: "Subtotal exceeds the document limit",
      });
    if (doc.valid_until && doc.valid_until < doc.date)
      ctx.addIssue({
        code: "custom",
        message: "Expiry cannot precede the document date",
      });
    if (doc.kind === "receipt" && (doc.tax_bps || doc.discount_minor))
      ctx.addIssue({
        code: "custom",
        message:
          "Record the amount received without tax or discount adjustments",
      });
  });
export type DocumentInput = z.infer<typeof documentSchema>;
export type BusinessDocument = {
  id: string;
  number: string | null;
  status: "draft" | "issued" | "void";
  kind: DocumentInput["kind"];
  payload: DocumentInput & { company?: Settings; void_reason?: string };
  total_minor: number;
  version: number;
  created_at: string;
  issued_at: string | null;
};
export function totals(doc: DocumentInput) {
  const subtotal = doc.items.reduce(
    (sum, item) => sum + BigInt(item.quantity) * BigInt(item.unit_minor),
    0n,
  );
  const discount = BigInt(doc.discount_minor);
  const tax = ((subtotal - discount) * BigInt(doc.tax_bps) + 5000n) / 10000n;
  return {
    subtotal: Number(subtotal),
    discount: Number(discount),
    tax: Number(tax),
    total: Number(subtotal - discount + tax),
  };
}
export function minor(value: string) {
  if (!/^(?:0|[1-9][0-9]{0,10})(?:\.[0-9]{1,2})?$/.test(value))
    throw new Error("Use an amount with at most two decimal places");
  const [whole, fraction = ""] = value.split(".");
  return Number(BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")));
}
export function money(value: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(
    value / 100,
  );
}
export const staffSchema = z
  .object({
    name: required(140),
    title: required(120),
    staff_number: required(40),
    department: text(100),
    email: z.union([z.literal(""), z.email()]),
    phone: text(40),
    issued_on: z.iso.date(),
    expires_on: z.union([z.literal(""), z.iso.date()]),
    active: z.boolean(),
    photo_path: z.union([
      z.literal(""),
      z.string().regex(/^[0-9a-f-]{36}\.jpg$/),
    ]),
  })
  .strict()
  .refine(
    (s) => !s.expires_on || s.expires_on >= s.issued_on,
    "Expiry cannot precede issue date",
  );
export type StaffInput = z.infer<typeof staffSchema>;
export type Staff = {
  id: string;
  payload: StaffInput;
  version: number;
  created_at: string;
};
export function assertOrigin(request: Request, configuredOrigin: string) {
  if (
    !configuredOrigin ||
    request.headers.get("origin") !== configuredOrigin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new Error("Invalid request origin");
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Use JSON requests");
}
