# In-app notifications and backup feedback

Workspace feedback now uses one Lutera-styled notification centre across the
private application and customer portal. Transient success/error state, API
failures, downloads and long requests appear as in-app toasts. Error messages
remain until dismissed or superseded; ordinary success/info messages dismiss
after eight seconds, paused during hover, keyboard focus or a hidden tab.
There are at most three visible toasts and twenty recent entries in memory.
The bell opens recent messages; Escape closes that panel and F8 focuses a toast.
Sign-out/session loss clears the messages. No notification permission, OS push,
browser Notification API or persistent browser storage is used.

Validation uses in-app messages, focuses the first invalid control and marks
it with aria-invalid. In-app confirmation dialogs replace window.confirm and
window.prompt, including service removal, unsaved navigation, journal deletion
and reversal reasons. The same guard covers workspace Back/Forward, restores
the original record before asking, and retains edits if the user chooses to stay.
Dialogs keep keyboard focus and cancellation; toast results remain visible above
an open modal. Unexpected render failures use a branded retry screen without
showing private exception details.

The owner explicitly requested removal of browser close/reload warnings.
Beforeunload is therefore not registered. Unsaved-work confirmation covers
navigation inside the workspace; closing or reloading the browser removes the
page and cannot show a custom in-app dialog. Users must save before doing that.

The backup action now has an immediate progress notification, disabled duplicate
submission, an outcome beside the button and a global result. Its response
includes protected latest-run metadata. Wording distinguishes a newly verified
primary copy, an existing copy, another running request, missing configuration
and an unconfirmed request outcome. A successful primary copy is never described
as a completed Drive copy without a receipt. A failed health-panel refresh does
not change a known successful backup into a failed backup.

The owner-triggered **2 November 2026 15:20 UTC** run created a verified primary
snapshot in the private Supabase bucket. Its recorded status was **primary**;
Drive receipt/automation remains pending. This confirms that manual primary run,
not successful unattended execution of either daily schedule.

Verification includes unit cases for feedback/deduplication/history and backup
outcomes; browser fixtures cover progress, errors, retry, duplicate-click guards,
validation, focus, modal reasons, unsaved navigation, phone/tablet/desktop,
accessibility and private history clearing. Fixtures send no real emails or
payments and create no real backups.
