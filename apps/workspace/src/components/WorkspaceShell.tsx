"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  departments,
  type Destination,
  type WorkspaceTool,
} from "@/lib/workspace-areas";
import { DepartmentIcon, destination } from "./WorkspaceAreas";
export default function WorkspaceShell({
  tools,
  active,
  activeDepartment,
  activeTool,
  onNavigate,
  email,
  role,
  busy,
  onSignout,
  children,
}: {
  tools: WorkspaceTool[];
  active: string;
  activeDepartment?: string;
  activeTool?: string;
  onNavigate: (target: Destination) => boolean | void;
  email: string;
  role: string;
  busy: boolean;
  onSignout: () => void;
  children: ReactNode;
}) {
  const [desktopOpen, setDesktopOpen] = useState(true),
    [mobileOpen, setMobileOpen] = useState(false),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | undefined>(
    activeDepartment,
  );
  useEffect(() => {
    if (activeDepartment) setExpanded(activeDepartment);
  }, [activeDepartment]);
  const choose = (target: Destination) => {
    if (onNavigate(target) === false) return;
    setSearch("");
    setMobileOpen(false);
    if (mobile)
      requestAnimationFrame(() =>
        document.getElementById("workspace-main")?.focus(),
      );
  };
  const toggle = useRef<HTMLButtonElement>(null),
    navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia("(max-width: 767px)");
    const change = () => {
      setMobile(media.matches);
      setMobileOpen(false);
    };
    change();
    media.addEventListener("change", change);
    try {
      setDesktopOpen(
        localStorage.getItem("lutera.workspace.sidebar.v1") !== "closed",
      );
    } catch {}
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!mobileOpen) return;
    navigation.current?.querySelector<HTMLInputElement>("input")?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        requestAnimationFrame(() => toggle.current?.focus());
      }
    };
    const outside = (e: PointerEvent) => {
      if (
        !navigation.current?.contains(e.target as Node) &&
        !toggle.current?.contains(e.target as Node)
      )
        setMobileOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [mobileOpen]);
  const open = mobile ? mobileOpen : desktopOpen;
  const close = () => {
    if (mobile) setMobileOpen(false);
    else {
      setDesktopOpen(false);
      try {
        localStorage.setItem("lutera.workspace.sidebar.v1", "closed");
      } catch {}
    }
    requestAnimationFrame(() => toggle.current?.focus());
  };
  return (
    <div
      className="workspace"
      data-sidebar-open={desktopOpen}
      data-mobile-menu={mobileOpen}
    >
      <a className="workspace-skip" href="#workspace-main">
        Skip to workspace content
      </a>
      <header className="topbar">
        <button
          ref={toggle}
          className="secondary workspace-menu"
          type="button"
          aria-controls="workspace-navigation"
          aria-expanded={open}
          aria-label="Open workspace menu"
          hidden={open}
          onClick={() => {
            if (mobile) setMobileOpen(true);
            else {
              setDesktopOpen(true);
              try {
                localStorage.setItem("lutera.workspace.sidebar.v1", "open");
              } catch {}
            }
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img
          src="/brand/lutera-horizontal-light.svg"
          alt="Lutera"
          width="140"
          height="40"
        />
        <span className="private-label">Business workspace</span>
        <div className="account">
          <span className="account-email" title={email}>
            {email}
            <small>{role}</small>
          </span>
          <button className="secondary" onClick={onSignout} disabled={busy}>
            Sign out
          </button>
        </div>
      </header>
      <div className="workspace-grid">
        <aside
          ref={navigation}
          id="workspace-navigation"
          className="workspace-sidebar"
          aria-label="Workspace navigation"
        >
          <div className="workspace-sidebar-heading">
            <strong>Workspace</strong>
            <button
              className="secondary workspace-sidebar-close"
              type="button"
              aria-label="Close workspace menu"
              title="Close menu"
              onClick={close}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <label className="field nav-search">
            <span>Find a tool</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspace"
            />
          </label>
          <nav aria-label="Workspace sections">
            {!search && (
              <button
                className="department-nav"
                aria-current={active === "overview" ? "page" : undefined}
                onClick={() => choose({ section: "overview" })}
              >
                <DepartmentIcon id="overview" />
                <span>Dashboard</span>
              </button>
            )}
            {departments.map((d) => {
              const entries = tools.filter((t) => t.department === d.id);
              const matches = entries.filter((t) =>
                (d.label + " " + t.label + " " + t.description)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              );
              if (!entries.length || (search && !matches.length)) return null;
              const isOpen = !!search || expanded === d.id;
              return (
                <div className="department-nav-group" key={d.id}>
                  <div
                    className="department-nav-row"
                    data-active={activeDepartment === d.id}
                  >
                    <button
                      className="department-nav"
                      aria-current={active === d.id ? "page" : undefined}
                      onClick={() => {
                        setExpanded(d.id);
                        choose({ section: d.id });
                      }}
                    >
                      <DepartmentIcon id={d.id} />
                      <span>{d.label}</span>
                    </button>
                    <button
                      className="department-expand"
                      aria-label={(isOpen ? "Collapse " : "Expand ") + d.label}
                      aria-expanded={isOpen}
                      aria-controls={"department-" + d.id}
                      onClick={() => setExpanded(isOpen ? undefined : d.id)}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                      >
                        <path d={isOpen ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
                      </svg>
                    </button>
                  </div>
                  <div
                    className="department-subnav"
                    id={"department-" + d.id}
                    hidden={!isOpen}
                  >
                    {matches.map((t) => (
                      <button
                        key={t.id}
                        title={t.description}
                        aria-current={activeTool === t.id ? "page" : undefined}
                        onClick={() => choose(destination(t))}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {search &&
              !tools.some((t) =>
                (
                  t.label +
                  " " +
                  t.description +
                  " " +
                  departments.find((d) => d.id === t.department)?.label
                )
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ) && (
                <p role="status">
                  No tools match. Try payments, customers or website.
                </p>
              )}
            <button
              className="department-nav account-nav"
              aria-current={active === "account" ? "page" : undefined}
              onClick={() => choose({ section: "account" })}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.65"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
              </svg>
              <span>My account</span>
            </button>
          </nav>
          <a href="https://luteratech.com" target="_blank" rel="noreferrer">
            View public website ↗
          </a>
          <p className="sidebar-footnote">
            Private records. Approved access only.
          </p>
        </aside>
        {children}
      </div>
    </div>
  );
}
