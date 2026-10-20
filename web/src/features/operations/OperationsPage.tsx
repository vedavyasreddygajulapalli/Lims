import { useState } from "react";
import {
  operationSchemas,
  operationRoles,
  amountToMinor,
  type OperationName,
} from "@lims/core";
import {
  Button,
  Card,
  Field,
  Select,
  Modal,
  Notice,
  Loading,
  Empty,
  PageHeader,
  Badge,
} from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import { request } from "../../lib/client";
import { pretty, type LabRecord, type User } from "../../lib/types";
type Spec = {
  key: string;
  options?: string[];
  type?: string;
  optional?: boolean;
};
const specs: Record<OperationName, Spec[]> = {
  equipment: [
    { key: "name" },
    { key: "serial" },
    { key: "location" },
    { key: "calibrationDue", type: "date" },
    { key: "status", options: ["active", "maintenance", "retired"] },
    { key: "certificateReference", optional: true },
  ],
  quality: [
    { key: "title" },
    { key: "type", options: ["complaint", "nonconformity", "capa"] },
    { key: "sampleId", optional: true },
    { key: "owner" },
    { key: "dueDate", type: "date" },
    {
      key: "status",
      options: ["open", "investigating", "action_taken", "closed"],
    },
    { key: "description" },
    { key: "rootCause", optional: true },
    { key: "correction", optional: true },
    { key: "correctiveAction", optional: true },
    { key: "effectiveness", optional: true },
  ],
  billing: [
    { key: "clientId" },
    { key: "description" },
    { key: "amount", type: "text" },
    { key: "dueDate", type: "date" },
  ],
  documents: [
    { key: "title" },
    { key: "reference" },
    { key: "revision" },
    { key: "owner" },
    { key: "reviewDue", type: "date" },
    { key: "status", options: ["draft", "controlled", "obsolete"] },
    { key: "location" },
  ],
};
const titles = {
  equipment: "Equipment",
  quality: "Quality cases",
  billing: "Billing ledger",
  documents: "Document register",
};
const descriptions = {
  equipment:
    "Calibration dates, equipment availability and certificate references.",
  quality:
    "Complaints, nonconformities and corrective actions with closure evidence.",
  billing:
    "Recorded charges and payments in INR. This ledger is not a tax invoice.",
  documents:
    "Controlled document references and revisions. File storage is not connected.",
};
export function OperationsPage({
  entity,
  user,
}: {
  entity: OperationName;
  user: User;
}) {
  const query = useQuery<LabRecord[]>("/" + entity);
  const links = useQuery<LabRecord[]>(
    entity === "billing"
      ? "/billing-clients"
      : entity === "quality"
        ? "/sample-options"
        : "/equipment",
  );
  const [editing, setEditing] = useState<LabRecord | null | undefined>(
      undefined,
    ),
    [values, setValues] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(""),
    [payment, setPayment] = useState<LabRecord | null>(null);
  const canEdit = user.roles.some((r) => operationRoles[entity].includes(r));
  function open(row: LabRecord | null) {
    setEditing(row);
    setValues(
      Object.fromEntries(
        specs[entity].map((f) => [
          f.key,
          String(row?.[f.key] ?? f.options?.[0] ?? ""),
        ]),
      ),
    );
    setReason("");
    setError("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const raw = { ...values } as Record<string, unknown>;
      if (entity === "billing") {
        raw.amountMinor = amountToMinor(values.amount);
        delete raw.amount;
      }
      const data = operationSchemas[entity].parse(raw);
      await request(
        "/" + entity + (editing ? "/" + editing._id : ""),
        editing ? "PATCH" : "POST",
        editing ? { version: editing.version, reason, data } : data,
      );
      setEditing(undefined);
      query.reload();
    } catch (e) {
      setError(
        (e as { issues?: { message: string }[] }).issues
          ?.map((i) => i.message)
          .join("; ") ?? (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("/billing/" + payment!._id + "/payments", "POST", {
        version: payment!.version,
        amountMinor: amountToMinor(values.amount),
        reference: values.reference,
        date: values.date,
      });
      setPayment(null);
      query.reload();
    } catch (e) {
      setError(
        (e as { issues?: { message: string }[] }).issues
          ?.map((i) => i.message)
          .join("; ") ?? (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  const money = (n: unknown) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(Number(n) / 100);
  return (
    <>
      <PageHeader
        title={titles[entity]}
        description={descriptions[entity]}
        action={
          canEdit ? (
            <Button onClick={() => open(null)}>Add record</Button>
          ) : undefined
        }
      />
      {query.error && (
        <Notice tone="red">
          {query.error}
          <Button onClick={query.reload}>Retry</Button>
        </Notice>
      )}
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
          <Field
            label="Search records"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="text-sm text-slate-500">
            Latest 200 records · {query.data?.length ?? 0} loaded
          </span>
        </div>
        {query.loading ? (
          <Loading />
        ) : !query.data?.length ? (
          <Empty />
        ) : (
          <div className="divide-y divide-slate-100">
            {!query.data.some((r) =>
              JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
            ) && (
              <Empty
                title="No matching records"
                description="Try a different search."
              />
            )}
            {query.data
              .filter((r) =>
                JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
              )
              .map((r) => (
                <article
                  key={r._id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-500">
                      {String(r.number)}
                    </p>
                    <h3 className="mt-1 font-semibold text-slate-900">
                      {String(r.title ?? r.name ?? r.description)}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      {entity === "billing"
                        ? `Charge ${money(r.amountMinor)} · Paid ${money(r.paidMinor)} · Balance ${money(Number(r.amountMinor) - Number(r.paidMinor))}`
                        : entity === "equipment"
                          ? `${r.serial} · ${r.location} · Calibration due ${r.calibrationDue}`
                          : entity === "documents"
                            ? `${r.reference} · Revision ${r.revision} · Review ${r.reviewDue}`
                            : `${pretty(String(r.type))} · ${r.owner} · Due ${r.dueDate}`}
                    </p>
                  </div>
                  <Badge
                    tone={
                      r.status === "closed" || r.status === "paid"
                        ? "green"
                        : "neutral"
                    }
                  >
                    {pretty(String(r.status))}
                  </Badge>
                  {canEdit &&
                    (entity === "billing" ? (
                      <Button
                        variant="secondary"
                        disabled={r.status === "paid"}
                        onClick={() => {
                          setPayment(r);
                          setValues({
                            date: new Date().toISOString().slice(0, 10),
                            amount: "",
                            reference: "",
                          });
                          setError("");
                        }}
                      >
                        Record payment
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => open(r)}>
                        View / edit
                      </Button>
                    ))}
                </article>
              ))}
          </div>
        )}
      </Card>
      {editing !== undefined && (
        <Modal
          title={(editing ? "Update " : "New ") + titles[entity]}
          onClose={() => !busy && setEditing(undefined)}
        >
          <form onSubmit={save} className="space-y-4">
            {error && <Notice tone="red">{error}</Notice>}
            <div className="grid gap-4 sm:grid-cols-2">
              {specs[entity].map((f) => {
                const linked = f.key === "clientId" || f.key === "sampleId";
                return f.options || linked ? (
                  <Select
                    key={f.key}
                    label={pretty(f.key)}
                    value={values[f.key]}
                    required={!f.optional}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  >
                    {linked && (
                      <option value="">
                        {f.optional ? "No linked sample" : "Select client"}
                      </option>
                    )}
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {pretty(o)}
                      </option>
                    ))}
                    {linked &&
                      links.data?.map((o) => (
                        <option key={o._id} value={o._id}>
                          {String(o.number)} · {String(o.name ?? o.description)}
                        </option>
                      ))}
                  </Select>
                ) : (
                  <Field
                    key={f.key}
                    label={f.key === "amount" ? "Amount (INR)" : pretty(f.key)}
                    type={f.type ?? "text"}
                    required={!f.optional}
                    maxLength={2000}
                    value={values[f.key]}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                );
              })}
            </div>
            {links.error && (
              <Notice tone="red">Linked records: {links.error}</Notice>
            )}
            {entity === "quality" && (
              <p className="text-sm text-slate-500">
                Closure requires root cause, correction, corrective action and
                effectiveness evidence.
              </p>
            )}
            {editing && (
              <Field
                label="Reason for change"
                required
                minLength={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
            <Button disabled={busy}>{busy ? "Saving…" : "Save record"}</Button>
          </form>
        </Modal>
      )}
      {payment && (
        <Modal
          title={"Payment · " + payment.number}
          onClose={() => !busy && setPayment(null)}
        >
          <form onSubmit={pay} className="space-y-4">
            {error && <Notice tone="red">{error}</Notice>}
            <Notice>
              Outstanding:{" "}
              {money(Number(payment.amountMinor) - Number(payment.paidMinor))}.
              Record a received payment; no money is transferred.
            </Notice>
            {["amount", "reference", "date"].map((k) => (
              <Field
                key={k}
                label={k === "amount" ? "Amount (INR)" : pretty(k)}
                type={k === "date" ? "date" : "text"}
                required
                value={values[k]}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [k]: e.target.value }))
                }
              />
            ))}
            <Button disabled={busy}>Save payment</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
