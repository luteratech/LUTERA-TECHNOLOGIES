"use client";
import { useEffect } from "react";
import { appNotice } from "@/lib/notifications";
export default function WorkspaceError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    appNotice(
      "This section could not be displayed. Try opening it again. If you were saving a record, check its status before repeating that action.",
      "error",
      { id: "workspace-render-error", title: "Unable to open this section" },
    );
  }, [error]);
  return (
    <main className="portal-shell">
      <section className="panel">
        <img
          src="/brand/lutera-horizontal-light.svg"
          width="168"
          height="49"
          alt="Lutera Technology Ltd"
        />
        <h1>Let’s get you back to work.</h1>
        <p>
          This section could not be opened. Your saved records remain in the
          workspace.
        </p>
        <button onClick={retry}>Try again</button>
      </section>
    </main>
  );
}
