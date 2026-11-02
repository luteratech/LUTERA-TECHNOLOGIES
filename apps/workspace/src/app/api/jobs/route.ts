import { timingSafeEqual } from "node:crypto";
import { job, dispatchBusinessMail } from "@/lib/business-mail";
import { runBusinessBackup } from "@/lib/business-backup";
import { scheduledJobs } from "@/lib/scheduled-jobs";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || "",
    provided = request.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  if (
    !secret ||
    Buffer.byteLength(provided) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await scheduledJobs(
      () => job({ action: "prepare" }),
      dispatchBusinessMail,
      runBusinessBackup,
    );
    return Response.json(result, {
      status: result.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Job processing failed. Inspect integration health." },
      { status: 503 },
    );
  }
}
