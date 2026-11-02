"use client";
import { useEffect, useId, useRef, useState } from "react";

export type Choice = { value: string; label: string; description?: string };
/** Searchable checkbox picker: checkboxes keep multi-selection keyboard and
 * screen-reader semantics, instead of pretending to be a single-value select. */
export default function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  hint,
}: {
  label: string;
  options: readonly Choice[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const selected = options.filter((o) => value.includes(o.value));
  const shown = options.filter((o) =>
    `${o.label} ${o.description || ""}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const close = (focus = false) => {
    setOpen(false);
    setQuery("");
    if (focus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const toggle = (item: string) => {
    if (value.includes(item)) {
      if (required && value.length === 1) return;
      onChange(value.filter((v) => v !== item));
    } else onChange([...value, item]);
  };
  return (
    <div
      ref={root}
      className="multi-picker field"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={(e) => {
        if (
          e.relatedTarget &&
          !e.currentTarget.contains(e.relatedTarget as Node)
        )
          close();
      }}
    >
      <span id={`${id}-label`}>
        {label}
        {required ? " *" : ""}
      </span>
      <button
        ref={trigger}
        type="button"
        className="multi-picker-trigger"
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-summary`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-haspopup="dialog"
        onClick={() => {
          if (open) close();
          else setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={`${id}-summary`}>
          {selected.length ? `${selected.length} selected` : "Choose options…"}
        </span>
        <span aria-hidden="true">⌄</span>
      </button>
      {hint && <small>{hint}</small>}
      {!!selected.length && (
        <ul
          className="selection-tags"
          aria-label={`Selected ${label.toLowerCase()}`}
        >
          {selected.map((o) => (
            <li key={o.value}>
              <span>{o.label}</span>
              <button
                type="button"
                disabled={disabled || (required && value.length === 1)}
                aria-label={`Remove ${o.label}`}
                onClick={() => toggle(o.value)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div
          id={`${id}-panel`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${id}-label`}
          className="multi-picker-panel"
        >
          <div className="multi-picker-search">
            <label className="sr-only" htmlFor={`${id}-search`}>
              Search {label.toLowerCase()}
            </label>
            <input
              id={`${id}-search`}
              ref={search}
              type="search"
              value={query}
              placeholder="Search options…"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="multi-picker-options">
            <fieldset>
              <legend className="sr-only">{label}</legend>
              {shown.map((o) => (
                <label className="multi-picker-option" key={o.value}>
                  <input
                    type="checkbox"
                    checked={value.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    disabled={
                      disabled ||
                      (required &&
                        value.length === 1 &&
                        value.includes(o.value))
                    }
                  />
                  <span>
                    {o.label}
                    {o.description && <small>{o.description}</small>}
                  </span>
                </label>
              ))}
              {!shown.length && <p role="status">No matching options.</p>}
            </fieldset>
          </div>
          <div className="multi-picker-footer">
            <span aria-live="polite">{selected.length} selected</span>
            <button
              className="secondary"
              type="button"
              onClick={() => close(true)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
