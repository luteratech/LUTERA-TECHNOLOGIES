/** Independent jobs must not prevent one another from running. Only generic
 * failure messages leave the worker; provider errors can contain private data. */
export async function scheduledJobs(
  prepare: () => Promise<unknown>,
  dispatch: () => Promise<unknown>,
  backup: () => Promise<unknown>,
) {
  const [messages, snapshot] = await Promise.allSettled([
    (async () => {
      await prepare();
      return dispatch();
    })(),
    Promise.resolve().then(backup),
  ]);
  return {
    ok: messages.status === "fulfilled" && snapshot.status === "fulfilled",
    messages:
      messages.status === "fulfilled"
        ? messages.value
        : { error: "Message processing failed. Inspect integration health." },
    backup:
      snapshot.status === "fulfilled"
        ? snapshot.value
        : { error: "Backup processing failed. Inspect backup health." },
  };
}
