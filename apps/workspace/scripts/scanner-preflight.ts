import { checkBouncer } from "../src/lib/bouncer-scan";
import { scannerStatus } from "../src/lib/evidence-scan";
async function main() {
  const state = scannerStatus();
  if (state.provider !== "bouncer") {
    console.log(
      "Attachment scanner: Bouncer activation pending (no production key selected).",
    );
    return;
  }
  const allowance = await checkBouncer(process.env.BOUNCER_API_KEY);
  console.log(
    `Bouncer connection verified: free plan, ${allowance.remaining}/${allowance.limit} scans remaining. No file submitted.`,
  );
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Scanner preflight failed.",
  );
  process.exitCode = 1;
});
