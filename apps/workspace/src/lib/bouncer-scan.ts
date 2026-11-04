import { createHash } from "node:crypto";
const origin = "https://api.usebouncer.dev";
export class AttachmentScanError extends Error {
  constructor(
    message: string,
    public status = 503,
  ) {
    super(message);
  }
}
type Dependencies = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};
const unavailable = () =>
  new AttachmentScanError(
    "Attachment scanning is unavailable. Your file was not saved. Please retry later.",
  );
function key(value?: string) {
  if (!value || !/^bnc_live_[A-Za-z0-9_-]{8,240}$/.test(value))
    throw new AttachmentScanError(
      "Attachment scanning needs a valid Bouncer key. Ask the owner to check Integrations.",
    );
  return value;
}
async function request(
  path: string,
  apiKey: string,
  options: RequestInit,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
) {
  const remaining = deadline - now();
  if (remaining <= 0)
    throw new AttachmentScanError(
      "Attachment scanning timed out. Your file was not saved. Please retry later.",
    );
  let response: Response;
  try {
    response = await fetcher(origin + path, {
      ...options,
      headers: { ...options.headers, "X-API-Key": apiKey },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(Math.max(1, Math.min(10000, remaining))),
    });
  } catch {
    throw unavailable();
  }
  if (response.status === 429)
    throw new AttachmentScanError(
      "The attachment-scanning allowance has been reached. Your file was not saved. Ask the owner to check Integrations.",
      429,
    );
  if (response.status === 401 || response.status === 403)
    throw new AttachmentScanError(
      "Bouncer could not authenticate. Your file was not saved. Ask the owner to check the scanner key.",
    );
  if (!response.ok) throw unavailable();
  try {
    const reader = response.body?.getReader();
    if (!reader) throw Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw Error();
      }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (
      result?.status !== "success" ||
      !result.data ||
      typeof result.data !== "object"
    )
      throw Error();
    return result.data as Record<string, unknown>;
  } catch {
    throw unavailable();
  }
}
export type BouncerAllowance = {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  tier: "free";
};
async function allowance(
  apiKey: string,
  fetcher: typeof fetch,
  deadline: number,
  now: () => number,
): Promise<BouncerAllowance> {
  const data = await request(
    "/v1/scan/usage",
    apiKey,
    {},
    fetcher,
    deadline,
    now,
  );
  if (
    data.tier !== "free" ||
    !Number.isSafeInteger(data.scans_used) ||
    !Number.isSafeInteger(data.scans_limit) ||
    Number(data.scans_used) < 0 ||
    Number(data.scans_limit) < 1 ||
    Number(data.scans_limit) > 500 ||
    typeof data.resets_at !== "string" ||
    !Number.isFinite(Date.parse(data.resets_at))
  )
    throw new AttachmentScanError(
      "The scanner account is not a verified free plan. Ask the owner to check Bouncer; no file was submitted.",
    );
  const used = Number(data.scans_used),
    limit = Number(data.scans_limit);
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetsAt: data.resets_at,
    tier: "free",
  };
}
export async function checkBouncer(
  apiKey?: string,
  dependencies: Dependencies = {},
) {
  const now = dependencies.now || Date.now;
  return allowance(
    key(apiKey),
    dependencies.fetch || fetch,
    now() + 10000,
    now,
  );
}
export async function scanBouncer(
  bytes: Buffer,
  apiKey?: string,
  dependencies: Dependencies = {},
) {
  const token = key(apiKey),
    fetcher = dependencies.fetch || fetch,
    now = dependencies.now || Date.now;
  const deadline = now() + 45000,
    sleep =
      dependencies.sleep ||
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const quota = await allowance(token, fetcher, deadline, now);
  if (!quota.remaining)
    throw new AttachmentScanError(
      "The free attachment-scanning allowance has been used. Your file was not saved. It can be retried after the monthly reset.",
      429,
    );
  const body = new FormData();
  body.set(
    "file",
    new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
    "lutera-upload.bin",
  );
  // Never retry the submission automatically: one upload consumes one scan.
  let data = await request(
    "/v1/scan",
    token,
    { method: "POST", body },
    fetcher,
    deadline,
    now,
  );
  const id = data.scan_id;
  if (typeof id !== "string" || !/^scan_[A-Za-z0-9_-]{1,100}$/.test(id))
    throw unavailable();
  for (let polls = 0; polls <= 20; polls++) {
    if (data.scan_id !== id) throw unavailable();
    if (data.status === "completed") {
      if (data.verdict !== "clean")
        throw new AttachmentScanError(
          "This attachment did not pass the company security check. Choose another file.",
          400,
        );
      const file = data.file as { sha256?: unknown } | undefined;
      if (
        typeof file?.sha256 !== "string" ||
        file.sha256.toLowerCase() !==
          createHash("sha256").update(bytes).digest("hex")
      )
        throw new AttachmentScanError(
          "The scan result could not be verified for this file. Your file was not saved. Please retry.",
        );
      return {
        provider: "bouncer" as const,
        scanId: id,
        sha256: file.sha256.toLowerCase(),
      };
    }
    if (data.status !== "pending" && data.status !== "scanning")
      throw unavailable();
    if (polls === 20 || now() + 2000 >= deadline) break;
    await sleep(2000);
    data = await request(
      "/v1/scan/" + encodeURIComponent(id),
      token,
      {},
      fetcher,
      deadline,
      now,
    );
  }
  throw new AttachmentScanError(
    "Attachment scanning did not finish in time. Your file was not saved. Please retry later.",
  );
}
