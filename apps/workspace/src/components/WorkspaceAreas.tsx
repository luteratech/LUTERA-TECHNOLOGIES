"use client";
import { useState } from "react";
import {
  departments,
  type Destination,
  type WorkspaceTool,
  type WorkspaceAccess,
} from "@/lib/workspace-areas";

const symbols: Record<string, string> = {
  overview: "M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z",
  sales:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7a4 4 0 0 1 0 8m5 9v-2a4 4 0 0 0-3-4",
  financial: "M3 7h18v14H3zM3 7l14-4v4m-1 7h5m-5 3h5M7 12h3m-3 4h3",
  supply: "m3 7 9-4 9 4v10l-9 4-9-4zm0 0 9 4 9-4m-9 4v10M7 5l9 4",
  delivery: "M3 5h18v16H3zM7 3v4m10-4v4M3 10h18m-14 5 3 3 6-5",
  website: "M3 3h18v18H3zM3 8h18M8 8v13M6 5h1m3 0h1",
  people: "M4 3h16v18H4zm5 4a3 3 0 1 0 6 0m-8 9v-1a5 5 0 0 1 10 0v1M8 18h8",
  administration:
    "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
};
export function DepartmentIcon({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={symbols[id] || symbols.overview} />
    </svg>
  );
}
export function destination(tool: WorkspaceTool, create = false): Destination {
  return {
    section: tool.section,
    params: {
      ...tool.params,
      tool: tool.id,
      ...(create && tool.create
        ? tool.section === "operations"
          ? { record: "new" }
          : tool.section === "finance"
            ? { document: "new" }
            : {}
        : {}),
    },
  };
}
export default function WorkspaceAreas({
  area,
  tools,
  config,
  open,
  website,
}: {
  area: string;
  tools: WorkspaceTool[];
  config: WorkspaceAccess | null;
  open: (target: Destination) => boolean | void;
  website?: { version: number; connected: boolean; status?: string };
}) {
  const [query, setQuery] = useState("");
  const department = departments.find((d) => d.id === area);
  const scoped = department
    ? tools.filter((t) => t.department === area)
    : tools;
  const filtered = scoped.filter((t) =>
    (t.label + " " + t.description).toLowerCase().includes(query.toLowerCase()),
  );
  const preferred = [
    "payments",
    "enquiries",
    "invoices",
    "expenses",
    "projects",
    "quote-documents",
    "website-services",
    "staff-profiles",
  ];
  const shown =
    !department && !query
      ? preferred.flatMap((id) => tools.filter((t) => t.id === id)).slice(0, 6)
      : filtered;
  const quick = scoped
    .filter((t) => t.create && (!t.area || config?.access[t.area]?.write))
    .sort((a, b) => {
      const rank = (id: string) =>
        preferred.includes(id) ? preferred.indexOf(id) : 99;
      return rank(a.id) - rank(b.id);
    })
    .slice(0, 4);
  return (
    <>
      <section className="department-intro">
        <div>
          <p className="eyebrow">
            {department ? "Your tools, together" : "Welcome to your workspace"}
          </p>
          <h2>
            {department
              ? department.description
              : "What would you like to do today?"}
          </h2>
          <p>
            {area === "financial"
              ? "Record payments manually with supporting evidence. Keep approval, allocation and bank reconciliation separate."
              : department
                ? "Choose a task below. You only see tools available to your account."
                : "Start with a department or a quick action. Your records and follow-ups stay connected."}
          </p>
        </div>
        {quick.length > 0 && (
          <div className="department-quick" aria-label="Quick actions">
            {quick.map((t) => (
              <button key={t.id} onClick={() => open(destination(t, true))}>
                <span aria-hidden="true">＋</span>
                {t.create}
              </button>
            ))}
          </div>
        )}
      </section>
      {!department && (
        <div className="department-grid" aria-label="Business departments">
          {departments
            .filter((d) => tools.some((t) => t.department === d.id))
            .map((d) => (
              <button
                className="department-card"
                key={d.id}
                onClick={() => open({ section: d.id })}
              >
                <span className="department-symbol">
                  <DepartmentIcon id={d.id} />
                </span>
                <strong>{d.label}</strong>
                <span>{d.description}</span>
                <small>
                  Open workspace <span aria-hidden="true">↗</span>
                </small>
              </button>
            ))}
        </div>
      )}
      {department && (
        <section
          className="department-workflow"
          aria-label={`${department.label} working steps`}
        >
          <h2>A clear path through the work</h2>
          <ol>
            {department.steps.map((s, i) => (
              <li key={s}>
                <span aria-hidden="true">0{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </section>
      )}
      {area === "website" && website && (
        <div className="panel website-status">
          <div>
            <span className="status-dot" aria-hidden="true" />
            <strong>Website draft {website.version}</strong>
            <p>
              Saving a draft does not publish it. Preview, publish and check the
              live revision.
            </p>
          </div>
          <span>
            {website.connected
              ? "Publishing configured"
              : "Publishing needs setup"}
            {website.status ? " · Latest publication: " + website.status : ""}
          </span>
        </div>
      )}
      <section
        className="department-tools"
        aria-labelledby="workspace-tools-title"
      >
        <div className="department-tools-heading">
          <h2 id="workspace-tools-title">
            {department
              ? "All " + department.short.toLowerCase() + " tools"
              : query
                ? "Find a tool"
                : "Quick access"}
          </h2>
          <label className="field">
            <span className="sr-only">Search workspace tools</span>
            <input
              type="search"
              aria-label="Search workspace tools"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by task or tool…"
            />
          </label>
        </div>
        {shown.length ? (
          <div className="tool-grid">
            {shown.map((t) => (
              <button
                className="tool-card"
                key={t.id}
                onClick={() => open(destination(t))}
              >
                <span>
                  <strong>{t.label}</strong>
                  <span>{t.description}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty">
            <h3>
              {query
                ? "No tools match your search"
                : "No tools are assigned here yet"}
            </h3>
            <p>
              {query
                ? "Try a task such as payment, supplier or website."
                : "The company owner can grant the access needed for your work."}
            </p>
            {query && (
              <button className="secondary" onClick={() => setQuery("")}>
                Clear search
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
