import { z } from "zod";
const date = z.union([z.literal(""), z.iso.date()]);
export const ownerSetupSchema = z
  .object({
    tax: z
      .object({
        status: z.enum(["pending", "confirmed"]),
        tax_id: z.string().trim().max(80),
        registration_number: z.string().trim().max(80),
        vat_status: z.enum([
          "unconfirmed",
          "registered",
          "exempt",
          "not_registered",
        ]),
        effective_from: date,
        reference: z.string().trim().max(1000),
        notes: z.string().trim().max(3000),
      })
      .strict(),
    accounting: z
      .object({
        enabled: z.boolean(),
        cutover: date,
        opening_reviewed: z.boolean(),
      })
      .strict(),
    solo_owner: z.boolean(),
  })
  .strict();
export type OwnerSetup = z.infer<typeof ownerSetupSchema>;
export const emptyOwnerSetup: OwnerSetup = {
  tax: {
    status: "pending",
    tax_id: "",
    registration_number: "",
    vat_status: "unconfirmed",
    effective_from: "",
    reference: "",
    notes: "",
  },
  accounting: { enabled: false, cutover: "", opening_reviewed: false },
  solo_owner: true,
};
export const signatureProfileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(160),
    capacity: z.string().trim().min(2).max(120),
    image_data: z
      .string()
      .max(300000)
      .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/),
  })
  .strict();
export const journalLineSchema = z
  .object({
    account: z.string().regex(/^[A-Z0-9-]{2,20}$/),
    debit_minor: z.number().int().min(0).max(1e12),
    credit_minor: z.number().int().min(0).max(1e12),
  })
  .strict();
export const journalSchema = z
  .object({
    entry_date: z.iso.date(),
    currency: z.enum(["NGN", "USD", "GBP", "EUR"]),
    description: z.string().trim().min(5).max(500),
    cash_flow: z.enum(["none", "operating", "investing", "financing"]),
    lines: z.array(journalLineSchema).min(2).max(50),
  })
  .strict();
export type LedgerJournal = {
  id: string;
  reference: string;
  entry_date: string;
  currency: string;
  description: string;
  lines: z.infer<typeof journalLineSchema>[];
  cash_flow: string;
  status: "draft" | "posted";
  version: number;
  source_key?: string;
  reverses?: string;
};
export type LedgerAccount = {
  code: string;
  name: string;
  category: "asset" | "liability" | "equity" | "income" | "expense";
  cash_account: boolean;
};
export type DocumentSignature = {
  id: string;
  full_name: string;
  capacity: string;
  image_data: string;
  created_at: string;
  approval_reason: string;
  source_hash: string;
  source_version: number;
  self_approved: boolean;
};
export type SuiteConfig = {
  owner: boolean;
  read: boolean;
  write: boolean;
  post: boolean;
  close: boolean;
  sign: boolean;
  setup?: { payload: OwnerSetup; version: number };
  accounting_enabled: boolean;
  tax_status: string;
  closed_through: string | null;
  profile: { full_name: string; capacity: string; image_data: string } | null;
  factors: { id: string; name: string }[];
  members: { email: string; role: string; roles?: string[]; active: boolean }[];
  responsibilities: {
    email: string;
    title: string;
    duties: string;
    ledger_post: boolean;
    period_close: boolean;
    sign_documents: boolean;
  }[];
};
export type LedgerReport = {
  pending_count?: number;
  changed_count?: number;
  pending_sources?: { tbl: string; id: string; dt: string; label: string }[];
  changed_sources?: { tbl: string; id: string; dt: string; label: string }[];
  balances: {
    code: string;
    name: string;
    category: string;
    cash_account: boolean;
    currency: string;
    balance_minor: number;
  }[];
  activity: {
    reference: string;
    entry_date: string;
    currency: string;
    description: string;
    cash_flow: string;
    account: string;
    debit_minor: number;
    credit_minor: number;
  }[];
};
export function journalTotals(lines: z.infer<typeof journalLineSchema>[]) {
  return lines.reduce(
    (s, l) => ({
      debit: s.debit + l.debit_minor,
      credit: s.credit + l.credit_minor,
    }),
    { debit: 0, credit: 0 },
  );
}
export function reportSummary(r: LedgerReport, currency: string) {
  const balances = r.balances.filter((b) => b.currency === currency);
  const balance = (category: string) =>
    balances
      .filter((b) => b.category === category)
      .reduce((s, b) => s + Number(b.balance_minor), 0);
  const activity = r.activity.filter((a) => a.currency === currency);
  const category = (code: string) =>
    balances.find((b) => b.code === code)?.category;
  const movement = (kind: string) =>
    activity
      .filter((a) => category(a.account) === kind)
      .reduce((s, a) => s + Number(a.debit_minor) - Number(a.credit_minor), 0);
  const earnings = -balance("income") - balance("expense");
  return {
    assets: balance("asset"),
    liabilities: -balance("liability"),
    equity: -balance("equity"),
    earnings,
    revenue: -movement("income"),
    expenses: movement("expense"),
    profit: -movement("income") - movement("expense"),
    trialDifference: balances.reduce((s, b) => s + Number(b.balance_minor), 0),
  };
}
