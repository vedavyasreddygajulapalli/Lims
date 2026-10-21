import { useState } from "react";
import type { ClientFile } from "@lims/core";
import { useQuery } from "../../lib/useQuery";
import {
  Field,
  Button,
  Notice,
  Loading,
  Pagination,
} from "../../components/ui";
import { formatBytes } from "./api";
export function AppendixPicker({
  clientId,
  trfId,
  selected,
  onChange,
}: {
  clientId: string;
  trfId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const query = new URLSearchParams({
    clientId,
    trfId,
    eligible: "true",
    page: String(page),
    q,
  });
  const list = useQuery<{ items: ClientFile[]; total: number }>(
    "/files/list?" + query,
  );
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">
          Supporting appendices ({selected.length}/10)
        </h3>
        {!!selected.length && (
          <Button type="button" variant="ghost" onClick={() => onChange([])}>
            Clear appendices
          </Button>
        )}
      </div>
      <p className="text-xs leading-5 text-slate-500">
        Optional PDFs and photos marked eligible for reports. Selected versions
        are preserved in this draft. Up to 50 MB and 100 appendix pages.
      </p>
      <Field
        label="Find supporting files"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      {list.error && <Notice tone="red">{list.error}</Notice>}
      {list.loading ? (
        <Loading />
      ) : list.data?.items.length ? (
        <div className="max-h-48 space-y-2 overflow-auto">
          {list.data.items.map((r) => (
            <label
              key={r._id}
              className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm"
            >
              <input
                type="checkbox"
                aria-label={"Append " + r.name}
                checked={selected.includes(r.currentId!)}
                disabled={
                  !selected.includes(r.currentId!) && selected.length >= 10
                }
                onChange={() =>
                  onChange(
                    selected.includes(r.currentId!)
                      ? selected.filter((id) => id !== r.currentId)
                      : [...selected, r.currentId!],
                  )
                }
              />
              <span>
                {r.name}
                <small className="block text-slate-500">
                  v{r.current?.revision} · {formatBytes(r.current?.size ?? 0)}
                </small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No eligible files. Mark a PDF, PNG or JPG as report eligible in Client
          files.
        </p>
      )}
      <Pagination
        page={page}
        total={list.data?.total ?? 0}
        onChange={setPage}
      />
    </section>
  );
}
