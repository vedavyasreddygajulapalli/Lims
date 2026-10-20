import { useState } from "react";
import { roles } from "@lims/core";
import { Field, Button, Notice } from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import { request } from "../../lib/client";
import type { LabRecord, User } from "../../lib/types";
export function AccessEditor({
  record,
  user,
  onSaved,
}: {
  record: LabRecord;
  user: User;
  onSaved: (r: LabRecord) => void;
}) {
  const methods = useQuery<LabRecord[]>("/methods");
  const [selected, setSelected] = useState(record.roles as string[]),
    [scope, setScope] = useState((record.methodIds ?? []) as string[]),
    [active, setActive] = useState(Boolean(record.active)),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (record._id === user.id)
    return <Notice>Another administrator must change your own access.</Notice>;
  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const row = await request<LabRecord>("/users/" + record._id, "PATCH", {
        version: record.version,
        roles: selected,
        active,
        methodIds: scope,
        reason,
      });
      onSaved(row);
      setReason("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="mt-5 space-y-4 border-t border-slate-200 pt-5"
    >
      <h3 className="font-semibold">Access controls</h3>
      {error && <Notice tone="red">{error}</Notice>}
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Account active
      </label>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="mb-2 text-sm font-medium">Roles</legend>
        {roles.map((r) => (
          <label key={r} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(r)}
              onChange={() => setSelected(toggle(selected, r))}
            />
            {r}
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">
          Signatory method scope
        </legend>
        {methods.data?.map((m) => (
          <label key={m._id} className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={scope.includes(m._id)}
              onChange={() => setScope(toggle(scope, m._id))}
            />
            {String(m.name)} · {String(m.material)}
          </label>
        ))}
      </fieldset>
      <Field
        label="Reason for access change"
        required
        minLength={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <p className="text-sm text-slate-500">
        Saving revokes this person's active sessions.
      </p>
      <Button disabled={busy || !selected.length}>Save access</Button>
    </form>
  );
}
