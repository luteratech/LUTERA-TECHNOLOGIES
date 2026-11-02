const good = new Set([
  "issued",
  "paid",
  "approved",
  "active",
  "complete",
  "completed",
  "accepted",
  "verified",
  "reconciled",
  "resolved",
  "closed",
]);
const warn = new Set([
  "draft",
  "pending",
  "waiting",
  "unpaid",
  "unconfirmed",
  "scheduled",
  "overdue",
]);
const danger = new Set([
  "void",
  "voided",
  "failed",
  "rejected",
  "cancelled",
  "inactive",
  "blocked",
]);
const brand = new Set([
  "open",
  "in_progress",
  "submitted",
  "processing",
  "installing",
]);
export default function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replaceAll(" ", "_");
  const text = status.replaceAll("_", " ");
  const label =
    (
      {
        rfq: "Request for quotation",
        proforma: "Pro forma",
        id: "ID",
      } as Record<string, string>
    )[key] || text.charAt(0).toUpperCase() + text.slice(1);
  const tone = good.has(key)
    ? "success"
    : warn.has(key)
      ? "warning"
      : danger.has(key)
        ? "danger"
        : brand.has(key)
          ? "brand"
          : "neutral";
  return (
    <span className="badge" data-tone={tone}>
      {label}
    </span>
  );
}
