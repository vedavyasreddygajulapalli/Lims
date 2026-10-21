import { tw } from "../styles/utilities";
import { useState, type ReactNode } from "react";
import {
  FlaskConical,
  LogOut,
  Menu,
  ChevronDown,
  ArrowUpRight,
  PanelLeftClose,
} from "lucide-react";
import { navigation, titles, canView } from "../app/navigation";
import { Button } from "./ui";
import { isDemo } from "../lib/client";
import type { Page, User } from "../lib/types";
export function AppShell({
  user,
  page,
  navigate,
  onLogout,
  children,
  search,
}: {
  user: User;
  page: Page;
  navigate: (p: Page) => void;
  onLogout: () => void;
  children: ReactNode;
  search?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={tw("app-shell")}>
      <a className={tw("skip-link")} href="#main-content">
        Skip to content
      </a>
      {open && (
        <button
          className={tw("sidebar-backdrop")}
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={tw(`sidebar ${open ? "sidebar-open" : ""}`)}>
        <div className={tw("brand")}>
          <span className={tw("brand-icon")}>
            <FlaskConical size={22} />
          </span>
          <div>
            Sri Sainath<span>LABORATORY MANAGEMENT</span>
          </div>
          <Button
            variant="ghost"
            className={tw("mobile-close")}
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          >
            <PanelLeftClose size={18} />
          </Button>
        </div>
        <div className={tw("workspace-switch")}>
          <span className={tw("workspace-avatar")}>SL</span>
          <div>
            Tirupati Laboratory
            <small>{isDemo ? "Demo workspace" : "Laboratory workspace"}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Main navigation">
          {navigation
            .filter((n) => canView(n.id, user))
            .map((n) => (
              <div key={n.id}>
                {"group" in n && <p className={tw("nav-group")}>{n.group}</p>}
                <button
                  aria-current={page === n.id ? "page" : undefined}
                  className={tw(
                    `nav-item ${page === n.id ? "nav-active" : ""}`,
                  )}
                  onClick={() => {
                    navigate(n.id);
                    setOpen(false);
                  }}
                >
                  <n.icon size={18} />
                  <span>{n.label}</span>
                  {n.id === "reference" && (
                    <span className={tw("nav-tag")}>REF</span>
                  )}
                </button>
              </div>
            ))}
        </nav>
        <div className={tw("sidebar-info")}>
          <span className={tw("online-dot")} />
          <b>{isDemo ? "Demo data enabled" : "Development workspace"}</b>
          <p>
            {isDemo
              ? "Explore safely. Changes reset on reload."
              : "Source methods require laboratory acceptance."}
          </p>
        </div>
        <div className={tw("profile")}>
          <span className={tw("profile-avatar")}>
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <b>{user.name}</b>
            <small>{user.roles.join(" · ")}</small>
          </div>
          <Button variant="ghost" aria-label="Sign out" onClick={onLogout}>
            <LogOut size={16} />
          </Button>
        </div>
      </aside>
      <div className={tw("main-shell")}>
        <header className={tw("topbar")}>
          <div>
            <Button
              variant="ghost"
              className={tw("mobile-menu")}
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span className={tw("breadcrumb")}>
              Workspace <span>/</span> <b>{titles[page]}</b>
            </span>
          </div>
          <div className={tw("topbar-right")}>
            {search}
            <span className={tw("environment")}>
              <span />
              {isDemo ? "Demo · synthetic records" : "Development"}
            </span>
            <span className={tw("topbar-date")}>
              {new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </span>
          </div>
        </header>
        {isDemo && (
          <div className={tw("demo-strip")}>
            UI preview • synthetic workflow records • published values used only
            in the reference calculator <ArrowUpRight size={13} />
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer>
          Sri Sainath Laboratory{" "}
          <span>Controlled records. Connected workflows.</span>
          <span>Development v0.3</span>
        </footer>
      </div>
    </div>
  );
}
