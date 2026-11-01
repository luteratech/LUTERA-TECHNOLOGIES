import type { SupabaseClient } from "@supabase/supabase-js";
import { checked } from "./business-server";
import type { DocumentSignature } from "./suite";
export async function documentSignatures(
  db: SupabaseClient,
  table: string,
  id: string,
): Promise<DocumentSignature[]> {
  return checked(
    await db.rpc("work_suite", {
      c: {
        action: "signature-read",
        data: { source_table: table, source_id: id },
      },
    }),
  ) as DocumentSignature[];
}
