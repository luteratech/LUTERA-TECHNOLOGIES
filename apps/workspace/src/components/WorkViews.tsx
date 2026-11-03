"use client";
import { displayDate, displayLabel } from "@/lib/workspace-display";
import type { Row } from "@/lib/business";
export default function WorkViews({
  rows,
  view,
  people,
  open,
  task = false,
}: {
  rows: Row[];
  view: "board" | "calendar";
  people: { id: string; name: string }[];
  open: (row: Row) => void;
  task?: boolean;
}) {
  const card = (row: Row) => (
    <button
      type="button"
      className="work-card secondary"
      onClick={() => open(row)}
      key={row.id}
    >
      <strong>{String(row.title || row.reference || "Work item")}</strong>
      <span>
        {people.find((p) => p.id === row.assigned_to)?.name || "Unassigned"}
      </span>
      <small>
        {row.due_on ? "Due " + displayDate(String(row.due_on)) : "No due date"}
      </small>
    </button>
  );
  if (view === "calendar") {
    const dates = [
      ...new Set(rows.map((r) => String(r.due_on || "Unscheduled"))),
    ].sort();
    return (
      <section aria-label="Work calendar" className="work-calendar">
        {dates.length ? (
          dates.map((date) => (
            <div key={date}>
              <h3>{date === "Unscheduled" ? date : displayDate(date)}</h3>
              {rows
                .filter((r) => String(r.due_on || "Unscheduled") === date)
                .map(card)}
            </div>
          ))
        ) : (
          <p>No scheduled work on this page.</p>
        )}
      </section>
    );
  }
  const stages = task
    ? ["todo", "doing", "blocked", "done"]
    : ["open", "active", "waiting", "completed", "closed"];
  return (
    <section
      className="work-board"
      role="region"
      tabIndex={0}
      aria-label="Work board"
    >
      {stages.map((stage) => (
        <div className="work-column" key={stage}>
          <h3>
            {displayLabel(stage)}{" "}
            <span>{rows.filter((r) => r.status === stage).length}</span>
          </h3>
          {rows.filter((r) => r.status === stage).map(card)}
        </div>
      ))}
    </section>
  );
}
