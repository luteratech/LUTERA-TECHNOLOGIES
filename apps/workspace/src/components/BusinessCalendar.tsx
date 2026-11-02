"use client";
import { useFeedback } from "@/lib/notifications";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
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
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Calendar>("business/delivery-calendar")
      .then(setValue)
      .catch((e) => setMessage(e));
  }, []);
  return (
    <details className="ops-gap">
      <summary>Agreed service calendar</summary>
      <p>
        Business timezone: Africa/Lagos. This calendar calculates explicitly
        agreed first-response targets; it does not create a support promise by
        itself. Existing deadlines remain recorded when the calendar changes.
      </p>

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
              setMessage("Business calendar saved.");
            } catch (e) {
              setMessage(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset>
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
                  onChange={(e) =>
                    setValue({
                      ...value,
                      days: e.target.checked
                        ? [...value.days, i]
                        : value.days.filter((n) => n !== i),
                    })
                  }
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
                onChange={(e) =>
                  setValue({ ...value, start_minute: minutes(e.target.value) })
                }
              />
            </label>
            <label className="field">
              <span>Closing time</span>
              <input
                type="time"
                required
                value={time(value.end_minute)}
                onChange={(e) =>
                  setValue({ ...value, end_minute: minutes(e.target.value) })
                }
              />
            </label>
            <label className="field full">
              <span>Non-working dates (one YYYY-MM-DD per line)</span>
              <textarea
                value={value.holidays.join("\n")}
                onChange={(e) =>
                  setValue({ ...value, holidays: e.target.value.split("\n") })
                }
              />
            </label>
          </div>
          <button disabled={busy}>Save business calendar</button>
        </form>
      )}
    </details>
  );
}
