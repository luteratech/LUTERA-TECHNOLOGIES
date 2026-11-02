"use client";
import { useEffect, useRef } from "react";
import { confirmAction } from "./notifications";
export function useUnsavedChanges(dirty: boolean) {
  const current = useRef(dirty);
  current.current = dirty;
  useEffect(() => {
    const navigation = (event: Event) => {
      if (current.current) event.preventDefault();
    };
    window.addEventListener("lutera-before-navigation", navigation);
    return () =>
      window.removeEventListener("lutera-before-navigation", navigation);
  }, []);
  return () => {
    current.current = false;
  };
}
export function hasUnsavedChanges() {
  return !window.dispatchEvent(
    new Event("lutera-before-navigation", { cancelable: true }),
  );
}
export async function mayLeave() {
  if (!hasUnsavedChanges()) return true;
  return confirmAction({
    title: "Discard unsaved changes?",
    message:
      "Your changes have not been saved. Stay on this page to save them, or discard them and continue.",
    confirmLabel: "Discard changes",
    cancelLabel: "Keep editing",
    danger: true,
  });
}
