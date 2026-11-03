"use client";
import { useRef } from "react";
import { appNotice } from "@/lib/notifications";
export function downloadTemplate(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CSVUpload({
  onRead,
  disabled = false,
}: {
  onRead: (text: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className="field">
      <span>Choose CSV file</span>
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        disabled={disabled}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > 200000) {
            appNotice("Choose a CSV under 200 KB.", "error");
            e.target.value = "";
            return;
          }
          try {
            onRead(await file.text());
          } catch {
            appNotice(
              "The CSV could not be read. Choose the file again.",
              "error",
            );
          }
        }}
      />
    </label>
  );
}
