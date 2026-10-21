import { useState } from "react";
import { Button, Card, Field, Notice, PageHeader } from "../../components/ui";
import { request, isDemo } from "../../lib/client";
import type { User } from "../../lib/types";
export function SettingsPage({
  user,
  onSignedOut,
}: {
  user: User;
  onSignedOut: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("newPassword") !== f.get("confirm")) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request("/auth/password", "POST", {
        currentPassword: f.get("currentPassword"),
        newPassword: f.get("newPassword"),
      });
      onSignedOut();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Account & readiness"
        description="Your account and the remaining production setup."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-2 font-semibold">{user.name}</h2>
          <p className="mb-5 text-sm text-slate-500">
            {user.roles.join(" · ")}
          </p>
          {isDemo ? (
            <Notice>
              Password changes are unavailable in this synthetic preview.
            </Notice>
          ) : (
            <form className="space-y-4" onSubmit={change}>
              {error && <Notice tone="red">{error}</Notice>}
              <Field
                label="Current password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
              <Field
                label="New password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
              <Field
                label="Confirm new password"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
              />
              <p className="text-sm text-slate-500">
                Changing your password signs out all sessions.
              </p>
              <Button disabled={busy}>Change password</Button>
            </form>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Production readiness</h2>
          <ul className="space-y-4 text-sm">
            {[
              [
                "Laboratory formulas",
                "Awaiting original sheets and expected results.",
              ],
              [
                "Final report issue",
                "Blocked until formulas and laboratory acceptance are complete.",
              ],
              [
                "Database & hosting",
                "Persistent deployment and restore testing pending.",
              ],
              [
                "Email & WhatsApp",
                "No provider connected; no messages are sent.",
              ],
              [
                "Document storage",
                "Client files supports private Supabase storage. Check its storage status; credentials, encryption and malware scanning must be configured.",
              ],
              [
                "Acceptance testing",
                "Your real test cases and browser review are still required.",
              ],
            ].map(([a, b]) => (
              <li key={a}>
                <b className="block text-slate-900">{a}</b>
                <span className="text-slate-500">{b}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
