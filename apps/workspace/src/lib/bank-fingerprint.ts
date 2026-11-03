import { createHash } from "node:crypto";
/** PostgreSQL jsonb_build_array::text uses a comma followed by a space. */
export function bankFingerprint(
  account: string,
  row: {
    posted_on: string;
    amount_minor: number;
    currency: string;
    reference: string;
  },
) {
  return createHash("sha256")
    .update(
      "[" +
        [account, row.posted_on, row.amount_minor, row.currency, row.reference]
          .map((value) => JSON.stringify(value))
          .join(", ") +
        "]",
    )
    .digest("hex");
}
