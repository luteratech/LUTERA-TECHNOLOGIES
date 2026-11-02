import { job, dispatchBusinessMail } from "@/lib/business-mail";
import { scheduledJobs } from "@/lib/scheduled-jobs";
import { authorizedCron } from "@/lib/cron-auth";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!authorizedCron(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await scheduledJobs(
    () => job({ action: "prepare" }),
    dispatchBusinessMail,
  );
  return Response.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
