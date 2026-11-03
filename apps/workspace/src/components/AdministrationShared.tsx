"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { feedbackText } from "@/lib/notifications";
import type { HealthStatus, OperationsHealth } from "@/lib/operations-health";

export function useOperationsHealth() {
  const [data, setData] = useState<OperationsHealth | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await api<OperationsHealth>("business/health", undefined, {
        notifications: false,
      });
      setData(result);
      setError("");
      return result;
    } catch (e) {
      setError(feedbackText(e));
      throw e;
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);
  return { data, error, refreshing, refresh };
}
export function HealthBadge({ label, tone }: HealthStatus) {
  return (
    <span className="badge" data-tone={tone}>
      {label}
    </span>
  );
}
export function HealthError({
  message,
  retry,
  busy,
}: {
  message: string;
  retry: () => void;
  busy: boolean;
}) {
  return (
    <div className="admin-feedback" data-tone="danger" role="alert">
      <div>
        <strong>Status could not be refreshed</strong>
        <p>{message} Previously loaded information may be out of date.</p>
      </div>
      <button
        type="button"
        className="secondary"
        disabled={busy}
        onClick={retry}
      >
        Try again
      </button>
    </div>
  );
}
