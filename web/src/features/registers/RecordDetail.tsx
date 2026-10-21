import { AccessEditor } from "../operations/AccessEditor";
import { tw } from "../../styles/utilities";
import { useState } from "react";
import { Plus, Trash2, LockKeyhole } from "lucide-react";
import { Modal, Field, Button, Notice } from "../../components/ui";
import {
  idOf,
  recordLabel,
  pretty,
  type LabRecord,
  type RegisterPage,
  type User,
} from "../../lib/types";
import { request } from "../../lib/client";
export function RecordDetail({
  initial,
  page,
  user,
  onClose,
  onSaved,
  onFiles,
}: {
  initial: LabRecord;
  page: RegisterPage;
  user: User;
  onClose: () => void;
  onSaved: () => void;
  onFiles?: (id: string) => void;
}) {
  const [record, setRecord] = useState(initial),
    [rows, setRows] = useState(() =>
      Object.entries(
        (initial.observations ?? {}) as Record<string, string>,
      ).map(([key, value]) => ({ key, value })),
    ),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const editable =
    page === "assignments" &&
    idOf(record.technicianId) === user.id &&
    user.roles.includes("technician") &&
    ["assigned", "observations_draft", "returned"].includes(
      String(record.status),
    );
  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (rows.length === 0) throw new Error("Add at least one observation.");
      if (new Set(rows.map((r) => r.key)).size !== rows.length)
        throw new Error("Observation field names must be unique.");
      const updated = await request<LabRecord>(
        "/assignments/" + record._id + "/observations",
        "PATCH",
        {
          version: record.version,
          observations: Object.fromEntries(rows.map((r) => [r.key, r.value])),
          reason,
        },
      );
      setRecord({ ...record, ...updated });
      setMessage("Observations saved with a new version and audit entry.");
      setReason("");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={String(record.number ?? record.name ?? "Record details")}
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {page === "clients" &&
        onFiles &&
        user.roles.some((r) =>
          ["admin", "manager", "reception", "reviewer", "signatory"].includes(
            r,
          ),
        ) && (
          <Button onClick={() => onFiles(record._id)}>Open client files</Button>
        )}
      <div className={tw("record-meta")}>
        <span>Record ID</span>
        <code>{record._id}</code>
      </div>
      <dl className={tw("detail-grid")}>
        {Object.entries(record)
          .filter(
            ([k]) =>
              !["_id", "__v", "observations", "before", "after"].includes(k),
          )
          .map(([k, v]) => (
            <div key={k}>
              <dt>{pretty(k)}</dt>
              <dd>{recordLabel(v)}</dd>
            </div>
          ))}
      </dl>
      {page === "users" && user.roles.includes("admin") && (
        <AccessEditor
          record={record}
          user={user}
          onSaved={(r) => {
            setRecord(r);
            onSaved();
          }}
        />
      )}
      {page === "audit" &&
        ["before", "after"].map((k) =>
          record[k] ? (
            <div key={k}>
              <h3>{pretty(k)}</h3>
              <pre className={tw("audit-json")}>
                {JSON.stringify(record[k], null, 2)}
              </pre>
            </div>
          ) : null,
        )}
      {page === "assignments" && (
        <section className={tw("observation-section")}>
          <div className={tw("section-heading")}>
            <div>
              <h3>Raw observation sheet</h3>
              <p>Values are kept exactly as entered. Draft only.</p>
            </div>
            {editable && (
              <Button
                variant="secondary"
                onClick={() => setRows([...rows, { key: "", value: "" }])}
              >
                <Plus size={14} /> Add field
              </Button>
            )}
          </div>
          {!rows.length && (
            <p className={tw("muted")}>No observations recorded yet.</p>
          )}
          {rows.map((row, i) => (
            <div className={tw("observation-row")} key={i}>
              <Field
                label={`Field ${i + 1}`}
                value={row.key}
                readOnly={!editable}
                placeholder="e.g. failure_load"
                onChange={(e) =>
                  setRows(
                    rows.map((r, n) =>
                      n === i ? { ...r, key: e.target.value } : r,
                    ),
                  )
                }
              />
              <Field
                label="Original value"
                value={row.value}
                readOnly={!editable}
                placeholder="e.g. 519.300"
                onChange={(e) =>
                  setRows(
                    rows.map((r, n) =>
                      n === i ? { ...r, value: e.target.value } : r,
                    ),
                  )
                }
              />
              {editable && (
                <Button
                  variant="ghost"
                  aria-label={`Remove field ${i + 1}`}
                  onClick={() => setRows(rows.filter((_, n) => n !== i))}
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
          ))}
          {editable && (
            <>
              <Field
                label="Reason for entry or correction"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button onClick={save} disabled={busy || !reason.trim()}>
                {busy ? "Saving…" : "Save observations"}
              </Button>
            </>
          )}
          <Notice>
            <LockKeyhole size={13} /> Laboratory calculation and report issuance
            await source validation.
          </Notice>
        </section>
      )}
      {error && <Notice tone="red">{error}</Notice>}
      {message && <Notice tone="green">{message}</Notice>}
    </Modal>
  );
}
