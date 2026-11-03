"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { useUnsavedChanges } from "@/lib/unsaved";
type Calendar = {
  version: number;
  days: number[];
  start_minute: number;
  end_minute: number;
  holidays: string[];
};
const time = (minutes: number) =>
  String(Math.floor(minutes / 60)).padStart(2, "0") +
  ":" +
  String(minutes % 60).padStart(2, "0");
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export default function BusinessCalendar() {
  const [value, setValue] = useState<Calendar | null>(null),
    [message, setMessage] = useFeedback(),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [failed, setFailed] = useState(false);
  useUnsavedChanges(dirty);
  const load = () =>
    api<Calendar>("business/delivery-calendar")
      .then((r) => {
        setValue(r);
        setFailed(false);
      })
      .catch((e) => {
        setFailed(true);
        setMessage(e);
      });
  useEffect(() => {
    void load();
  }, []);
  return (
    <section className="panel admin-panel" aria-labelledby="calendar-heading">
      <div className="admin-section-heading">
        <div>
          <h2 id="calendar-heading">Working calendar</h2>
          <p>
            Set your working days, hours and holidays. All times use Abuja time.
          </p>
        </div>
      </div>
      {!value && !failed && <p role="status">Loading working calendar…</p>}
      {failed && (
        <div className="admin-feedback" data-tone="danger" role="alert">
          <p>Working calendar could not be loaded.</p>
          <button
            type="button"
            className="secondary"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}

      {value && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              setValue(
                await api<Calendar>("business/delivery-work", {
                  action: "calendar",
                  version: value.version,
                  data: {
                    days: value.days,
                    start_minute: value.start_minute,
                    end_minute: value.end_minute,
                    holidays: value.holidays
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                }),
              );
              setDirty(false);
              setMessage("Business calendar saved.");
            } catch (e) {
              setMessage(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="admin-form-fields" disabled={busy}>
            <fieldset className="admin-working-days">
              <legend>Working days</legend>
              {[
                "Sunday",
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
              ].map((d, i) => (
                <label className="check" key={d}>
                  <input
                    type="checkbox"
                    checked={value.days.includes(i)}
                    onChange={(e) => {
                      setDirty(true);
                      setValue({
                        ...value,
                        days: e.target.checked
                          ? [...value.days, i]
                          : value.days.filter((n) => n !== i),
                      });
                    }}
                  />
                  {d}
                </label>
              ))}
            </fieldset>
            <div className="form-grid">
              <label className="field">
                <span>Opening time</span>
                <input
                  type="time"
                  required
                  value={time(value.start_minute)}
                  onChange={(e) => {
                    setDirty(true);
                    setValue({
                      ...value,
                      start_minute: minutes(e.target.value),
                    });
                  }}
                />
              </label>
              <label className="field">
                <span>Closing time</span>
                <input
                  type="time"
                  required
                  value={time(value.end_minute)}
                  onChange={(e) => {
                    setDirty(true);
                    setValue({ ...value, end_minute: minutes(e.target.value) });
                  }}
                />
              </label>
              <label className="field full">
                <span>Holidays and other non-working dates</span>
                <textarea
                  placeholder="2026-12-25"
                  value={value.holidays.join("\n")}
                  onChange={(e) => {
                    setDirty(true);
                    setValue({
                      ...value,
                      holidays: e.target.value.split("\n"),
                    });
                  }}
                />
              </label>
            </div>
          </fieldset>
          <div className="admin-form-footer">
            <p>
              Enter one date per line as YYYY-MM-DD. Changes apply to future
              response targets.
            </p>
            <button disabled={busy}>
              {busy ? "Saving…" : "Save business calendar"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
