import type { Row } from "./business";
/** Omitted engagement-specific fields must retain their values when editing. */
export function caseFormPayload(
  values: Record<string, unknown>,
  kind: string,
  existing?: Row | null,
): Record<string, unknown> & { kind: string } {
  const retained = [
    "acceptance_id",
    "accepted_by",
    "starts_on",
    "response_due_at",
    "responded_at",
  ];
  return {
    ...Object.fromEntries(
      retained
        .filter((key) => existing?.[key] !== undefined)
        .map((key) => [key, existing![key] ?? ""]),
    ),
    ...values,
    kind,
  };
}
