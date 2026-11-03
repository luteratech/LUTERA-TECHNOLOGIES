"use client";
import { workspaceLocation } from "@/lib/workspace-navigation";
import { mayLeave } from "@/lib/unsaved";
export default function AccessJourney({
  active,
}: {
  active: "accounts" | "permissions";
}) {
  return (
    <nav className="access-journey" aria-label="Colleague access setup">
      <button
        type="button"
        className={active === "accounts" ? "" : "secondary"}
        aria-current={active === "accounts" ? "step" : undefined}
        onClick={async () => {
          if (await mayLeave())
            workspaceLocation({ section: "members", tool: null, module: null });
        }}
      >
        1 · Account & roles
      </button>
      <button
        type="button"
        className={active === "permissions" ? "" : "secondary"}
        aria-current={active === "permissions" ? "step" : undefined}
        onClick={async () => {
          if (await mayLeave())
            workspaceLocation({
              section: "business-access",
              tool: null,
              module: null,
            });
        }}
      >
        2 · Departments & authority
      </button>
    </nav>
  );
}
