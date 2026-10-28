"use client";
import { useEffect, useState } from "react";
import { api, Notice } from "./Workspace";
export function useRecords<T>({
  area,
  kind,
  initial,
  query,
  field = "name",
  status = "all",
  enabled = true,
}: {
  area: "finance" | "staff";
  kind?: "quotation" | "proforma" | "receipt";
  initial: T[];
  query: string;
  field?: "name" | "number" | "title";
  status?: string;
  enabled?: boolean;
}) {
  const [page, setPage] = useState(0),
    [result, setResult] = useState<{ rows: T[]; more: boolean }>({
      rows: initial.slice(0, 50),
      more: initial.length > 50,
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const next = await api<{ rows: T[]; more: boolean }>("records", {
          area,
          ...(kind ? { kind } : {}),
          query,
          field,
          status,
          page,
        });
        if (alive) setResult(next);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [area, kind, initial, query, field, status, page, enabled]);
  return { ...result, page, setPage, loading, error };
}
export function Pagination({
  page,
  more,
  loading,
  error,
  onPage,
}: {
  page: number;
  more: boolean;
  loading: boolean;
  error: string;
  onPage: (page: number) => void;
}) {
  return (
    <>
      {error && <Notice>{error}</Notice>}
      <div className="pagination">
        <button
          className="secondary"
          disabled={loading || page === 0}
          onClick={() => onPage(page - 1)}
        >
          ← Previous
        </button>
        <span aria-live="polite">
          {loading ? "Loading…" : `Page ${page + 1}`}
        </span>
        <button
          className="secondary"
          disabled={loading || !more}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </>
  );
}
