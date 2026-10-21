import { nextStep } from "@lims/core";
import { updateWork } from "../../lib/recent";
import { ClientWorkspace } from "../clients/ClientWorkspace";
import { tw } from "../../styles/utilities";
import { useState, useEffect } from "react";
import { Plus, Search, RefreshCw, Download } from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Notice,
  Loading,
  Pagination,
} from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { useQuery } from "../../lib/useQuery";
import { canCreate, titles } from "../../app/navigation";
import { columns, descriptions, fields } from "./config";
import { RecordForm } from "./RecordForm";
import { RecordDetail } from "./RecordDetail";
import {
  pretty,
  recordLabel,
  type RegisterPage as Page,
  type LabRecord,
  type PageResult,
  type User,
} from "../../lib/types";
export function RegisterPage({
  page,
  user,
  onFiles,
  initialRecord = null,
}: {
  page: Page;
  user: User;
  onFiles?: (id: string) => void;
  initialRecord?: LabRecord | null;
}) {
  const [index, setIndex] = useState(1),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<LabRecord | null>(initialRecord),
    [message, setMessage] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex(1);
      setQuery(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);
  const { data, error, loading, reload } = useQuery<PageResult | LabRecord[]>(
    "/" + page + "?page=" + index + "&q=" + encodeURIComponent(query),
  );
  const items = Array.isArray(data)
    ? data.filter((row) =>
        JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
      )
    : (data?.items ?? []).filter(
        (row) =>
          page !== "audit" ||
          JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
      );
  const total = Array.isArray(data) ? items.length : (data?.total ?? 0);
  const editable = canCreate(page, user) && !!fields[page];
  function selectRecord(row: LabRecord) {
    setSelected(row);
    if (["clients", "trfs", "samples", "assignments"].includes(page))
      updateWork(
        user.id,
        {
          id: row._id,
          kind: page as any,
          label: String(row.number ?? row.name),
          detail: String(
            row.name ?? row.project ?? row.description ?? row.status ?? "",
          ),
        },
        "visit",
      );
  }
  function exportPage() {
    const keys = columns[page];
    const escape = (value: string) =>
      '"' +
      (/^[=+\-@\t\r]/.test(value) ? "'" : "") +
      value.replaceAll('"', '""') +
      '"';
    const csv = [
      keys.map(pretty),
      ...items.map((row) => keys.map((k) => recordLabel(row[k]))),
    ]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = page + "-page-" + index + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  if (page === "clients" && selected)
    return (
      <ClientWorkspace
        key={selected._id + user.id}
        clientId={selected._id}
        user={user}
        onBack={() => {
          setSelected(null);
          reload();
        }}
      />
    );
  return (
    <>
      <PageHeader
        title={titles[page]}
        description={descriptions[page]}
        action={
          editable ? (
            <Button onClick={() => setCreating(true)}>
              <Plus size={16} />{" "}
              {page === "users" ? "Add team member" : "Add record"}
            </Button>
          ) : undefined
        }
      />
      {message && <Notice tone="green">{message}</Notice>}
      {page === "methods" && (
        <Notice>
          These are candidate methods. Original calculation sheets and
          laboratory acceptance are required before activation.
        </Notice>
      )}
      <Card className={tw("register-card")}>
        <div className={tw("register-toolbar")}>
          <div className={tw("register-count")}>
            {titles[page]} <span>{total}</span>
          </div>
          <div className={tw("register-controls")}>
            <label className={tw("search-box")}>
              <Search size={16} />
              <input
                aria-label="Search records"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  ["methods", "users", "audit"].includes(page)
                    ? "Search this page…"
                    : "Search all records…"
                }
              />
            </label>
            <Button
              variant="secondary"
              aria-label="Refresh records"
              onClick={reload}
            >
              <RefreshCw size={15} />
            </Button>
            <Button
              variant="secondary"
              disabled={!items.length}
              onClick={exportPage}
            >
              <Download size={15} />
              <span>Export page</span>
            </Button>
          </div>
        </div>
        {error ? (
          <Notice tone="red">
            {error}{" "}
            <Button variant="ghost" onClick={reload}>
              Retry
            </Button>
          </Notice>
        ) : loading ? (
          <Loading />
        ) : (
          <DataTable
            rows={items}
            columns={columns[page].map((k) => ({
              key: k,
              label: pretty(k),
              render: (row) =>
                ["status", "receiptStatus"].includes(k) ? (
                  <div>
                    <Badge
                      tone={
                        row[k] === "accepted"
                          ? "green"
                          : row[k] === "rejected"
                            ? "red"
                            : row[k] === "quarantined" ||
                                row[k] === "awaiting_source"
                              ? "amber"
                              : "blue"
                      }
                    >
                      {pretty(String(row[k] ?? "—"))}
                    </Badge>
                    {page === "assignments" && (
                      <p className="mt-1 text-xs text-slate-500">
                        {nextStep(String(row.status))}
                      </p>
                    )}
                  </div>
                ) : k === "number" ? (
                  <button
                    className={tw("record-link")}
                    onClick={() => selectRecord(row)}
                  >
                    {recordLabel(row[k])}
                  </button>
                ) : k === "createdAt" ? (
                  new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(String(row[k])))
                ) : (
                  recordLabel(row[k])
                ),
            }))}
            onSelect={selectRecord}
          />
        )}
        <Pagination page={index} total={total} onChange={setIndex} />
      </Card>
      {creating && (
        <RecordForm
          page={page}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            setMessage("Record saved successfully.");
            reload();
          }}
        />
      )}
      {selected && (
        <RecordDetail
          onFiles={onFiles}
          initial={selected}
          page={page}
          user={user}
          onClose={() => setSelected(null)}
          onSaved={reload}
        />
      )}
    </>
  );
}
