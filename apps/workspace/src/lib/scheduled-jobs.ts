/** Daily reminders and weekly backups have separate schedules and failure results. */
export async function scheduledJobs(
  prepare: () => Promise<unknown>,
  dispatch: () => Promise<unknown>,
) {
  try {
    await prepare();
    return { ok: true, messages: await dispatch() };
  } catch {
    return {
      ok: false,
      messages: {
        error: "Message processing failed. Inspect integration health.",
      },
    };
  }
}
export async function scheduledBackup(
  backup: () => Promise<{ configured: boolean }>,
) {
  try {
    const result = await backup();
    if (!result.configured)
      return {
        ok: false,
        backup: { error: "Backup is not configured. Inspect backup health." },
      };
    return { ok: true, backup: result };
  } catch {
    return {
      ok: false,
      backup: { error: "Backup processing failed. Inspect backup health." },
    };
  }
}
