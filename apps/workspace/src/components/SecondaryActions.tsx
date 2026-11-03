"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
export default function SecondaryActions({
  children,
  label = "More actions",
}: {
  children: ReactNode;
  label?: string;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node))
        root.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <details
      ref={root}
      className="secondary-actions"
      onToggle={(e) => setOpen(e.currentTarget.open)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          root.current?.removeAttribute("open");
          root.current?.querySelector<HTMLElement>("summary")?.focus();
        }
      }}
    >
      <summary>
        {label}
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="secondary-actions-panel">{children}</div>
    </details>
  );
}
