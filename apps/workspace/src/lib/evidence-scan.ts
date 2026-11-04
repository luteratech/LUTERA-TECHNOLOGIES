import { createConnection } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { scanBouncer, AttachmentScanError } from "./bouncer-scan";
export { AttachmentScanError } from "./bouncer-scan";
export type ScanConfiguration = {
  provider?: string;
  apiKey?: string;
  host?: string;
  port?: string;
  tls?: string;
};
export function scanConfiguration(): ScanConfiguration {
  return {
    provider: process.env.ATTACHMENT_SCANNER_PROVIDER,
    apiKey: process.env.BOUNCER_API_KEY,
    host: process.env.CLAMAV_HOST,
    port: process.env.CLAMAV_PORT,
    tls: process.env.CLAMAV_TLS,
  };
}
export function scannerStatus(configuration = scanConfiguration()) {
  const provider =
    configuration.provider ||
    (configuration.apiKey ? "bouncer" : configuration.host ? "clamav" : "none");
  return {
    provider,
    configured:
      provider === "bouncer"
        ? !!configuration.apiKey
        : provider === "clamav"
          ? !!configuration.host
          : false,
  };
}
/** Scans original bytes before storage. Configured provider failures never bypass scanning. */
export async function scanEvidence(
  bytes: Buffer,
  configuration: ScanConfiguration = scanConfiguration(),
) {
  const state = scannerStatus(configuration);
  if (state.provider === "none") return { configured: false as const };
  if (state.provider === "bouncer") {
    await scanBouncer(bytes, configuration.apiKey);
    return { configured: true as const };
  }
  if (state.provider !== "clamav" || !state.configured)
    throw new AttachmentScanError(
      "Attachment scanning is not configured correctly. Your file was not saved.",
    );
  const port = Number(configuration.port || 3310);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Attachment scanning is not configured correctly.");
  await new Promise<void>((resolve, reject) => {
    let response = "",
      settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    const options = { host: configuration.host!, port };
    const socket =
      configuration.tls === "true"
        ? tlsConnect({ ...options, servername: configuration.host }, send)
        : createConnection(options, send);
    socket.setTimeout(12000, () =>
      finish(new Error("Attachment scanning timed out. Please retry.")),
    );
    socket.on("error", () =>
      finish(new Error("Attachment scanning is unavailable. Please retry.")),
    );
    socket.on("data", (data) => {
      response += data.toString("utf8");
      if (response.length > 1024)
        return finish(
          new Error("Attachment scanning returned an invalid response."),
        );
      if (/[\0\n]/.test(response)) {
        if (/^stream: OK[\0\n]/.test(response)) finish();
        else
          finish(
            new Error(
              "This attachment did not pass the company security check. Choose another file.",
            ),
          );
      }
    });
    socket.on("end", () => {
      if (!settled)
        finish(
          new Error("Attachment scanning did not complete. Please retry."),
        );
    });
    function send() {
      socket.write(Buffer.from("zINSTREAM\0"));
      for (let offset = 0; offset < bytes.length; offset += 65536) {
        const chunk = bytes.subarray(offset, offset + 65536),
          size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    }
  });
  return { configured: true as const };
}
