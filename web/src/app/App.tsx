import { confirmLeave } from "../lib/unsaved";
import { WorkspaceSearch } from "../components/WorkspaceSearch";
import { updateWork } from "../lib/recent";
import type { SearchHit } from "@lims/core";
import { FilesPage } from "../features/files/FilesPage";
import { ConsolidatedPage } from "../features/reports/ConsolidatedPage";
import { OperationsPage } from "../features/operations/OperationsPage";
import { WorkflowPage } from "../features/operations/WorkflowPage";
import { SettingsPage } from "../features/operations/SettingsPage";
import { isDemo } from "../lib/client";
import { useEffect, useState } from "react";
import { AppShell } from "../components/AppShell";
import { Loading, Notice } from "../components/ui";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { RegisterPage } from "../features/registers/RegisterPage";
import { ReferencePage } from "../features/reference/ReferencePage";
import { canView } from "./navigation";
import { request } from "../lib/client";
import type { Page, User } from "../lib/types";
export function App() {
  const [target, setTarget] = useState<{ record: any; kind: string } | null>(
    null,
  );
  const [fileClient, setFileClient] = useState("");
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [page, setPage] = useState<Page>("overview"),
    [error, setError] = useState("");
  useEffect(() => {
    request<User>("/auth/me")
      .then((u) => {
        setUser(u);
        if (u.roles.every((r) => r === "accounts")) setPage("billing");
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  async function logout() {
    if (!confirmLeave()) return;
    try {
      await request("/auth/logout", "POST");
      setTarget(null);
      setUser(null);
      setPage("overview");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!ready) return <Loading />;
  if (!user)
    return (
      <LoginPage
        onLogin={(u) => {
          setUser(u);
          if (u.roles.every((r) => r === "accounts")) setPage("billing");
        }}
      />
    );
  return (
    <AppShell
      user={user}
      page={page}
      navigate={(p) => {
        if (!confirmLeave()) return;
        setTarget(null);
        setPage(p);
        setError("");
      }}
      onLogout={logout}
      search={
        <WorkspaceSearch
          user={user}
          onOpen={async (hit) => {
            if (!confirmLeave())
              throw new Error("Navigation cancelled; your work is still open.");
            const record = await request<any>(
              hit.kind === "files"
                ? "/files/assets/" + hit.id
                : "/" + hit.kind + "/" + hit.id,
            );
            setTarget({ record, kind: hit.kind });
            setPage(hit.kind);
            if (hit.kind === "files") setFileClient(record.clientId);
          }}
        />
      }
    >
      {isDemo && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <label htmlFor="demo-persona">Preview role</label>
          <select
            id="demo-persona"
            className="rounded-lg border border-slate-300 p-2"
            value={user.id}
            onChange={async (e) => {
              if (!confirmLeave()) return;
              setTarget(null);
              setError("");
              try {
                const next = await request<User>("/auth/persona", "POST", {
                  id: e.target.value,
                });
                setUser(next);
                setPage("review");
              } catch (error) {
                setError((error as Error).message);
              }
            }}
          >
            <option value="000000000000000000000001">
              Administrator / assigned technician
            </option>
            <option value="000000000000000000000003">
              Independent reviewer
            </option>
            <option value="000000000000000000000004">Method signatory</option>
          </select>
          <span className="text-slate-500">
            Demo only · separate people for review and authorization
          </span>
        </div>
      )}
      {error && <Notice tone="red">{error}</Notice>}
      {!canView(page, user) ? (
        <Notice>
          Your role has no access to this area. Choose an available page from
          the navigation.
        </Notice>
      ) : page === "overview" ? (
        <DashboardPage navigate={setPage} user={user} />
      ) : page === "files" ? (
        <FilesPage
          key={user.id + (target?.record?._id ?? "")}
          user={user}
          initialClient={fileClient}
          initialAsset={target?.kind === "files" ? target.record : undefined}
        />
      ) : page === "consolidated" ? (
        <ConsolidatedPage />
      ) : page === "settings" ? (
        <SettingsPage user={user} onSignedOut={() => setUser(null)} />
      ) : ["equipment", "quality", "billing", "documents"].includes(page) ? (
        <OperationsPage
          key={page}
          entity={page as "equipment" | "quality" | "billing" | "documents"}
          user={user}
        />
      ) : page === "review" || page === "reports" ? (
        <WorkflowPage key={page + user.id} page={page} user={user} />
      ) : page === "reference" ? (
        <ReferencePage />
      ) : (
        <RegisterPage
          key={page + (target?.record?._id ?? "")}
          initialRecord={target?.kind === page ? target.record : null}
          onFiles={(id) => {
            setFileClient(id);
            setPage("files");
          }}
          page={page as import("../lib/types").RegisterPage}
          user={user}
        />
      )}
    </AppShell>
  );
}
