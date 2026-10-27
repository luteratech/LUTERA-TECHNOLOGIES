"use client";
import { useEffect, useRef, useState } from "react";
import { mayLeave } from "./unsaved";

const eventName = "lutera-workspace-location";
const storageKey = "lutera.workspace.navigation.v1";
type Marker = { trail: string; path: string; index: number };
type Direction = "push" | "replace" | "pop";
function marker(): Marker | undefined {
  const m = history.state?.luteraWorkspace;
  return m &&
    m.path === location.pathname &&
    typeof m.trail === "string" &&
    Number.isSafeInteger(m.index) &&
    m.index >= 0
    ? m
    : undefined;
}
function maximum(m: Marker) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    if (saved?.trail === m.trail && Number.isSafeInteger(saved.max))
      return Math.max(m.index, saved.max);
  } catch {}
  return m.index;
}
function remember(m: Marker, max: number) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify({ trail: m.trail, max }));
  } catch {}
}
function initialize() {
  let m = marker();
  if (!m) {
    m = { trail: crypto.randomUUID(), path: location.pathname, index: 0 };
    history.replaceState(
      { ...history.state, luteraWorkspace: m },
      "",
      location.href,
    );
    remember(m, 0);
  }
  return m;
}
function notify(direction: Direction) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: direction }));
}

/** Only change query parameters on the current private route. Never accept a URL. */
export function workspaceLocation(
  values: Record<string, string | null>,
  replace = false,
) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (url.search === location.search) return;
  const current = initialize();
  const next = { ...current, index: current.index + (replace ? 0 : 1) };
  history[replace ? "replaceState" : "pushState"](
    { ...history.state, luteraWorkspace: next },
    "",
    url.pathname + url.search,
  );
  remember(next, replace ? maximum(current) : next.index);
  notify(replace ? "replace" : "push");
}

/** One history controller per signed-in workspace. URLs hold IDs, never form values. */
export function useWorkspaceHistory(
  enabled: boolean,
  onLocation: (pop: boolean) => void,
) {
  const callback = useRef(onLocation);
  callback.current = onLocation;
  const [state, setState] = useState({ back: false, forward: false });
  useEffect(() => {
    if (!enabled) {
      setState({ back: false, forward: false });
      return;
    }
    let current = initialize();
    let last = maximum(current);
    let restoring = false;
    const update = (direction?: Direction) => {
      current = initialize();
      last =
        direction === "push" ? current.index : Math.max(last, maximum(current));
      setState({ back: current.index > 0, forward: current.index < last });
    };
    const changed = (e: Event) => {
      const direction = (e as CustomEvent<Direction>).detail;
      update(direction);
      callback.current(direction === "pop");
    };
    const pop = (e: PopStateEvent) => {
      if (restoring) {
        restoring = false;
        e.stopImmediatePropagation();
        return;
      }
      const target = marker();
      if (!target || target.trail !== current.trail) return;
      if (!mayLeave()) {
        e.stopImmediatePropagation();
        restoring = true;
        history.go(current.index - target.index);
        return;
      }
      // Keep the known forward boundary even when storage is unavailable.
      remember(target, last);
      notify("pop");
    };
    update();
    window.addEventListener(eventName, changed);
    window.addEventListener("popstate", pop, true);
    return () => {
      window.removeEventListener(eventName, changed);
      window.removeEventListener("popstate", pop, true);
    };
  }, [enabled]);
  return {
    ...state,
    go: (delta: -1 | 1) => {
      if (enabled && (delta === -1 ? state.back : state.forward))
        history.go(delta);
    },
  };
}
