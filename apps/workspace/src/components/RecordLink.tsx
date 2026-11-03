"use client";
import type { ReactNode } from "react";
import { mayLeave } from "@/lib/unsaved";
import { workspaceLocation } from "@/lib/workspace-navigation";
export default function RecordLink({
  entity,
  id,
  kind,
  children,
}: {
  entity: string;
  id: string;
  kind?: string;
  children: ReactNode;
}) {
  const target: Record<string, string> =
    entity === "documents"
      ? { section: "finance", document: id }
      : {
          section: "operations",
          module: entity,
          record: id,
          ...(kind ? { kind } : {}),
        };
  return (
    <a
      href={"?" + new URLSearchParams(target)}
      onClick={async (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (await mayLeave())
          workspaceLocation({
            kind: null,
            control: null,
            tool: null,
            document: null,
            module: null,
            record: null,
            ...target,
          });
      }}
    >
      {children}
    </a>
  );
}
