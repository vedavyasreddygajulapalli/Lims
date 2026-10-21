import { useState } from "react";
import { amountToMinor } from "@lims/core";
import {
  Modal,
  Field,
  Select,
  Button,
  Notice,
  Loading,
  Pagination,
} from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import { request } from "../../lib/client";
import type { LabRecord, PageResult } from "../../lib/types";
export function ClientPayment({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<LabRecord | null>(null),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(new Date().toISOString().slice(0, 10)),
    [reference, setReference] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = useQuery<PageResult>(
    "/clients/" + clientId + "/workspace/records?section=billing&page=" + page,
  );
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await request("/billing/" + selected._id + "/payments", "POST", {
        version: selected.version,
        amountMinor: amountToMinor(amount),
        date,
        reference,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Record client payment" onClose={() => !busy && onClose()}>
      {error && <Notice tone="red">{error}</Notice>}
      {rows.error && <Notice tone="red">{rows.error}</Notice>}
      {rows.loading ? (
        <Loading />
      ) : (
        <form onSubmit={save}>
          <Select
            label="Client charge"
            required
            value={selected?._id ?? ""}
            onChange={(e) => {
              setSelected(
                rows.data?.items.find((r) => r._id === e.target.value) ?? null,
              );
              setAmount("");
            }}
          >
            <option value="">Choose an outstanding charge</option>
            {rows.data?.items
              .filter((r) => Number(r.amountMinor) > Number(r.paidMinor))
              .map((r) => (
                <option value={r._id} key={r._id}>
                  {String(r.number)} · {String(r.description)}
                </option>
              ))}
          </Select>
          <Pagination
            page={page}
            total={rows.data?.total ?? 0}
            onChange={(p) => {
              setPage(p);
              setSelected(null);
            }}
          />
          {selected && (
            <p className="my-3 text-sm">
              Outstanding: ₹
              {(
                (Number(selected.amountMinor) - Number(selected.paidMinor)) /
                100
              ).toFixed(2)}
            </p>
          )}
          <Field
            label="Payment amount · INR"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Field
            label="Payment date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Field
            label="Payment reference"
            required
            minLength={3}
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
          <Notice>
            This records an already received payment. It does not transfer
            money.
          </Notice>
          <Button type="submit" disabled={!selected || busy}>
            {busy ? "Saving…" : "Save payment"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
