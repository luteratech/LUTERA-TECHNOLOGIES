import { minor, money } from "./contracts";
export const serviceChoices = [
  { value: "procurement", label: "IT procurement & sourcing" },
  { value: "hardware", label: "Computer hardware & equipment" },
  { value: "consulting", label: "Technology & IT consulting" },
  { value: "support", label: "Installation & technical support" },
  { value: "ai", label: "AI agents & automation" },
  { value: "software", label: "Software development" },
  { value: "data", label: "Data analytics" },
  { value: "cloud", label: "Cloud & systems integration" },
];
const terms: Record<string, string> = {
  rfq: "Supplier request for quotation",
  proforma: "Pro forma invoice",
  todo: "To do",
  doing: "In progress",
  done: "Done",
  sku: "SKU",
  id: "ID",
  tax_bps: "Tax rate",
  fx_rate_micros: "Exchange rate",
  source_id: "Source document",
  due_on: "Due date",
  due_date: "Due date",
  incurred_on: "Expense date",
  paid_on: "Payment date",
  starts_on: "Start date",
  posted_on: "Statement date",
  document_date: "Document date",
  created_at: "Recorded",
  updated_at: "Last updated",
  assigned_to: "Assigned to",
  amount_minor: "Amount",
  total_minor: "Total",
  unit_minor: "Unit price",
  value_minor: "Estimated value",
  outstanding_minor: "Outstanding balance",
  available_minor: "Available balance",
  allocated_minor: "Allocated amount",
  remaining_minor: "Remaining balance",
  tax_minor: "Tax",
  discount_minor: "Discount",
  received_minor: "Received",
  invoiced_minor: "Invoiced",
  cost_centers: "Cost centres",
  customer_id: "Customer",
  supplier_id: "Supplier",
  item_id: "Item",
  project_id: "Project",
  case_id: "Project or support engagement",
  order_id: "Sales order",
  purchase_id: "Purchase order",
  invoice_id: "Invoice",
  payment_id: "Payment",
  expense_id: "Bill or expense",
  quote_id: "Quotation",
  task_id: "Task or milestone",
  evidence_id: "Supporting evidence",
  receipt_id: "Receipt",
  in_progress: "In progress",
  ai: "AI agents & automation",
  "ai-automation": "AI agents & automation",
  "installation-labs": "Installation & technical support",
  "cloud-integration": "Cloud & systems integration",
  post: "Post journal",
  void: "Void",
  owner: "Owner",
  admin: "Operations administrator",
  editor: "Website administrator",
  finance: "Finance",
  designer: "Staff cards designer",
  staff: "Staff",
  signed: "Signed",
  submitted: "Awaiting approval",
  not_registered: "Not registered",
  ledger_post: "Post journals",
  period_close: "Close accounting periods",
  sign_documents: "Sign documents",
};
export function displayLabel(value: string) {
  return (
    terms[value] ||
    serviceChoices.find((s) => s.value === value)?.label ||
    value
      .replace(/^work_/, "")
      .replace(/_minor$/, "")
      .replace(/_id$/, "")
      .replaceAll("_", " ")
      .replaceAll("-", " ")
      .replace(/^./, (c) => c.toUpperCase())
  );
}
export function displayDate(value: unknown, includeTime = false) {
  if (!value || typeof value !== "string") return "—";
  const date = new Date(value.length === 10 ? value + "T12:00:00Z" : value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
export function recordAmount(row: Record<string, unknown>): number | null {
  for (const key of [
    "total_minor",
    "amount_minor",
    "value_minor",
    "outstanding_minor",
    "unit_minor",
  ])
    if (
      row[key] != null &&
      row[key] !== "" &&
      Number.isFinite(Number(row[key]))
    )
      return Number(row[key]);
  return null;
}
export function recordName(row: Record<string, unknown>) {
  return String(
    row.number ||
      row.reference ||
      row.name ||
      row.title ||
      row.description ||
      row.serial ||
      row.sku ||
      "Linked record",
  );
}
export function recordOption(row: Record<string, unknown>) {
  const amount = recordAmount(row);
  return [
    recordName(row),
    row.customer_name || row.supplier_name || "",
    row.document_date || row.paid_on
      ? displayDate(String(row.document_date || row.paid_on))
      : "",
    amount == null ? "" : money(amount, String(row.currency || "NGN")),
    row.status ? displayLabel(String(row.status)) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
export const linkedEntities: Record<string, string> = {
  rfq_id: "commercial",
  delivery_id: "commercial",
  movement_document_id: "commercial",
  customer_id: "customers",
  supplier_id: "suppliers",
  project_id: "cases",
  case_id: "cases",
  task_id: "tasks",
  depends_on: "tasks",
  order_id: "commercial",
  purchase_id: "commercial",
  invoice_id: "commercial",
  source_id: "commercial",
  expense_id: "expenses",
  payment_id: "payments",
  item_id: "items",
  quote_id: "quotes",
  enquiry_id: "enquiries",
  contact_id: "contacts",
  asset_id: "assets",
  movement_id: "stock",
  reservation_id: "reservations",
  offer_id: "offers",
  source_line_id: "commercial_lines",
  line_id: "commercial_lines",
  purchase_line_id: "commercial_lines",
  share_id: "portal_shares",
  assigned_to: "person",
};
export function recordDestination(
  entity: string,
  row: Record<string, unknown> = {},
) {
  return {
    section: "operations",
    module: entity,
    record: String(row.id || row.document_id || ""),
    ...(row.kind ? { kind: String(row.kind) } : {}),
  };
}

export function lineAmount(quantity: string, price: string): number | null {
  try {
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 0 || q > 1000000) return null;
    return Math.round(q * minor(price || "0"));
  } catch {
    return null;
  }
}

export function stockAvailable(row: Record<string, unknown>) {
  return (
    Number(row.on_hand || 0) -
    Number(row.reserved || 0) -
    Number(row.quarantined || 0)
  );
}
