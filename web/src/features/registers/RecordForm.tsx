import { tw } from "../../styles/utilities";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import {
  Modal,
  Field,
  Select,
  Button,
  Notice,
  Loading,
} from "../../components/ui";
import { request } from "../../lib/client";
import {
  recordLabel,
  type RegisterPage,
  type LabRecord,
  type PageResult,
} from "../../lib/types";
import { fields } from "./config";
export function RecordForm({
  page,
  onClose,
  onSaved,
  initialValues = {},
}: {
  page: RegisterPage;
  onClose: () => void;
  onSaved: () => void;
  initialValues?: Record<string, string>;
}) {
  const [form, setForm] = useState<Record<string, string>>(initialValues),
    [choices, setChoices] = useState<Record<string, LabRecord[]>>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    async function options(path: string) {
      const result = await request<LabRecord[] | PageResult>("/" + path);
      if (Array.isArray(result)) return result;
      const items = [...result.items];
      for (let n = 2; n <= Math.ceil(result.total / 50); n++)
        items.push(
          ...(await request<PageResult>("/" + path + "?page=" + n)).items,
        );
      return items;
    }
    Promise.all(
      (fields[page] ?? [])
        .filter((f) => f.lookup)
        .map(async (f) => [f.key, await options(f.lookup!)] as const),
    )
      .then((entries) => {
        if (current) setChoices(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [page]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request(
        "/" + page,
        "POST",
        page === "users" ? { ...form, roles: [form.roles] } : form,
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={page === "users" ? "Add team member" : "Create record"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p className={tw("form-intro")}>
        Add the details below. Linked records keep the full history connected.
      </p>
      {loading ? (
        <Loading />
      ) : (
        <form onSubmit={submit}>
          {error && <Notice tone="red">{error}</Notice>}
          <div className={tw("form-grid")}>
            {fields[page]?.map((f) => {
              let items = choices[f.key] ?? [];
              if (f.key === "sampleId")
                items = items.filter((i) => i.receiptStatus === "accepted");
              if (f.key === "technicianId")
                items = items.filter(
                  (i) =>
                    i.active !== false &&
                    Array.isArray(i.roles) &&
                    i.roles.includes("technician"),
                );
              if (f.key === "methodId")
                items = items.filter(
                  (i) =>
                    i.material ===
                    choices.sampleId?.find((s) => s._id === form.sampleId)
                      ?.material,
                );
              const change = (value: string) =>
                setForm({
                  ...form,
                  [f.key]: value,
                  ...(f.key === "sampleId" ? { methodId: "" } : {}),
                });
              return f.lookup || f.options ? (
                <Select
                  key={f.key}
                  label={f.label}
                  required
                  value={form[f.key] ?? ""}
                  disabled={
                    Boolean(initialValues[f.key]) ||
                    (f.key === "methodId" && !form.sampleId)
                  }
                  onChange={(e) => change(e.target.value)}
                >
                  <option value="">Select {f.label.toLowerCase()}</option>
                  {f.options?.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  {items.map((i) => (
                    <option key={i._id} value={i._id}>
                      {recordLabel(i)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Field
                  key={f.key}
                  label={f.label}
                  type={f.type ?? "text"}
                  hint={f.hint}
                  required
                  minLength={f.type === "password" ? 12 : 1}
                  maxLength={f.type === "password" ? 128 : 300}
                  value={form[f.key] ?? ""}
                  onChange={(e) => change(e.target.value)}
                />
              );
            })}
          </div>
          {page === "assignments" && (
            <Notice>
              Assignment tracks the work. It does not activate a laboratory
              calculation.
            </Notice>
          )}
          <div className={tw("form-actions")}>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save record"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
