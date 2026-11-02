import { timingSafeEqual } from "node:crypto";
export function authorizedCron(
  request: Request,
  secret = process.env.CRON_SECRET || "",
) {
  const provided = request.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  return (
    !!secret &&
    Buffer.byteLength(provided) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  );
}
