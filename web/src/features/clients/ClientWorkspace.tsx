import { confirmLeave } from "../../lib/unsaved";
import { nextStep } from "@lims/core";
import { RecordForm } from "../registers/RecordForm";
import { ClientPayment } from "./ClientPayment";
import { ClientActivity } from "./ClientActivity";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  RefreshCw,
  FolderOpen,
  ClipboardList,
  Package,
  Microscope,
} from "lucide-react";
import type { ClientSection } from "@lims/core";
import {
  Button,
  Card,
  PageHeader,
  Badge,
  Loading,
  Notice,
  Field,
  Pagination,
  Modal,
  Empty,
} from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { useQuery } from "../../lib/useQuery";
import { downloadConsolidated, downloadReport } from "../../lib/client";
import {
  pretty,
  recordLabel,
  type User,
  type LabRecord,
  type PageResult,
  type RegisterPage,
} from "../../lib/types";
import { RecordDetail } from "../registers/RecordDetail";
import { FilesPage } from "../files/FilesPage";
const labels: Record<ClientSection, string> = {
  trfs: "Test requests",
  samples: "Samples",
  assignments: "Tests",
  reports: "Draft reports",
  consolidated: "Consolidated reports",
  billing: "Billing & payments",
  quality: "Quality cases",
  files: "Files & folders",
};
const money = (n: unknown) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(n ?? 0) / 100,
  );
const date = (v: unknown) =>
  v && !Number.isNaN(Date.parse(String(v)))
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
        new Date(String(v)),
      )
    : "—";
interface Summary {
  client: LabRecord;
  sections: ClientSection[];
  counts: Partial<Record<ClientSection, number>>;
  recentRequests: LabRecord[];
  attention: { awaitingReview: number; quarantined: number };
  billing?: { chargedMinor: number; paidMinor: number; balanceMinor: number };
}
export function ClientWorkspace({
  clientId,
  user,
  onBack,
}: {
  clientId: string;
  user: User;
  onBack: () => void;
}) {
  const [quick, setQuick] = useState<"request" | "payment" | null>(null);
  const [uploadNow, setUploadNow] = useState(false);
  const [activity, setActivity] = useState(false);
  const [overviewRecord, setOverviewRecord] = useState<LabRecord | null>(null);
  const [tab, setTab] = useState<ClientSection | "overview">("overview");
  const summary = useQuery<Summary>("/clients/" + clientId + "/workspace");
  function choose(next: ClientSection | "overview") {
    if (!confirmLeave()) return;
    setActivity(false);
    setUploadNow(false);
    setTab(next);
    if (next === "overview") summary.reload();
  }
  if (summary.loading)
    return (
      <>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirmLeave()) onBack();
          }}
        >
          <ArrowLeft size={16} />
          Back to clients
        </Button>
        <Loading />
      </>
    );
  if (summary.error || !summary.data)
    return (
      <>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirmLeave()) onBack();
          }}
        >
          Back to clients
        </Button>
        <Notice tone="red">
          {summary.error || "Client unavailable"}{" "}
          <Button onClick={summary.reload}>Retry</Button>
        </Notice>
      </>
    );
  const { client, counts, sections, recentRequests, attention, billing } =
    summary.data;
  return (
    <>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => {
            if (confirmLeave()) onBack();
          }}
        >
          <ArrowLeft size={16} />
          Back to clients
        </Button>
        <Button
          variant="secondary"
          onClick={summary.reload}
          aria-label="Refresh client dashboard"
        >
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 bg-teal-50/60 p-6 sm:p-8">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-800 text-white">
            <Building2 size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-teal-800">
              Client workspace · {String(client.number)}
            </p>
            <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {String(client.name)}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              One place for this client’s laboratory work and documents.
            </p>
          </div>
          {sections.includes("files") && (
            <Button variant="secondary" onClick={() => choose("files")}>
              <FolderOpen size={16} />
              Open client files
            </Button>
          )}
        </div>
        <dl className="grid gap-5 p-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Contact person", client.contact],
            ["Email", client.email],
            ["Phone", client.phone],
            ["Address", client.address],
          ].map(([label, value]) => (
            <div key={String(label)} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {String(label)}
              </dt>
              <dd className="mt-2 break-words text-sm text-slate-800">
                {String(value || "Not provided")}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="mb-5 flex flex-wrap gap-3">
        {user.roles.some((r) =>
          ["admin", "manager", "reception"].includes(r),
        ) && (
          <Button onClick={() => setQuick("request")}>New test request</Button>
        )}
        {user.roles.some((r) =>
          ["admin", "manager", "reception", "accounts"].includes(r),
        ) && (
          <Button
            variant="secondary"
            onClick={() => {
              if (!confirmLeave()) return;
              setActivity(false);
              setTab("files");
              setUploadNow(true);
            }}
          >
            Upload client files
          </Button>
        )}
        {sections.includes("billing") && (
          <Button variant="secondary" onClick={() => setQuick("payment")}>
            Record client payment
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            if (confirmLeave()) setActivity(true);
          }}
        >
          Client activity
        </Button>
      </div>
      <nav
        aria-label="Client sections"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-2"
      >
        {(["overview", ...sections] as const).map((k) => (
          <button
            key={k}
            aria-current={!activity && tab === k ? "page" : undefined}
            onClick={() => choose(k)}
            className={
              "shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors " +
              (!activity && tab === k
                ? "bg-teal-800 text-white"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            {k === "overview" ? "Overview" : labels[k]}
            {k !== "overview" && (
              <span
                className={
                  "ml-2 rounded-md px-1.5 py-0.5 text-xs " +
                  (!activity && tab === k ? "bg-white/15" : "bg-slate-100")
                }
              >
                {counts[k] ?? 0}
              </span>
            )}
          </button>
        ))}
      </nav>
      {activity ? (
        <ClientActivity clientId={clientId} />
      ) : tab === "overview" ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["trfs", ClipboardList],
                ["samples", Package],
                ["assignments", Microscope],
                ["files", FolderOpen],
              ] as const
            )
              .filter(([key]) => sections.includes(key))
              .map(([key, Icon]) => (
                <button
                  key={key}
                  onClick={() => choose(key)}
                  className="rounded-xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-teal-600 focus-visible:outline-2 focus-visible:outline-teal-700"
                >
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <span>{labels[key]}</span>
                    <Icon size={19} />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-semibold text-slate-900">
                      {counts[key] ?? 0}
                    </span>
                    <ArrowUpRight size={18} className="text-teal-700" />
                  </div>
                </button>
              ))}
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
            <Card>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
                <div>
                  <h2 className="font-semibold">Recent test requests</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest five projects for this client
                  </p>
                </div>
                <Button variant="ghost" onClick={() => choose("trfs")}>
                  View all
                </Button>
              </div>
              {recentRequests.length ? (
                <div className="divide-y divide-slate-100">
                  {recentRequests.map((r) => (
                    <button
                      onClick={() => setOverviewRecord(r)}
                      className="flex w-full items-center gap-4 p-5 text-left hover:bg-slate-50"
                      key={r._id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-teal-800">
                          {String(r.number)}
                        </p>
                        <p className="mt-1 break-words text-sm text-slate-700">
                          {String(r.project)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {String(r.site || "Site not provided")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500">
                        Due {date(r.dueDate)}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  title="No test requests yet"
                  description="Requests linked to this client will appear here."
                />
              )}
            </Card>
            <div className="space-y-5">
              <Card className="p-5">
                <h2 className="font-semibold">Work to follow up</h2>
                <button
                  onClick={() => choose("assignments")}
                  className="mt-4 flex w-full justify-between text-sm"
                >
                  <span className="text-slate-600">Tests awaiting review</span>
                  <Badge tone={attention.awaitingReview ? "amber" : "neutral"}>
                    {attention.awaitingReview}
                  </Badge>
                </button>
                <button
                  onClick={() => choose("samples")}
                  className="mt-4 flex w-full justify-between text-sm"
                >
                  <span className="text-slate-600">Quarantined samples</span>
                  <Badge tone={attention.quarantined ? "amber" : "neutral"}>
                    {attention.quarantined}
                  </Badge>
                </button>
                <p className="mt-4 text-xs leading-relaxed text-slate-500">
                  Reports remain drafts until laboratory formulas and final
                  issuance are validated.
                </p>
              </Card>
              {billing && (
                <Card className="p-5">
                  <h2 className="font-semibold">Account summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    {[
                      ["Total charges", billing.chargedMinor],
                      ["Payments recorded", billing.paidMinor],
                      ["Outstanding balance", billing.balanceMinor],
                    ].map(([k, v]) => (
                      <div className="flex justify-between gap-3" key={k}>
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-semibold">{money(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  <Button
                    className="mt-5"
                    variant="secondary"
                    onClick={() => choose("billing")}
                  >
                    View billing & payments
                  </Button>
                </Card>
              )}
              <p className="px-1 text-xs text-slate-500">
                Client since {date(client.createdAt)} · Only sections permitted
                for your role are shown.
              </p>
            </div>
          </div>
        </>
      ) : tab === "files" ? (
        <FilesPage
          key={clientId + String(uploadNow)}
          initialClient={clientId}
          user={user}
          startUpload={uploadNow}
          lockedClient
        />
      ) : (
        <ClientRecords
          key={clientId + tab}
          clientId={clientId}
          section={tab}
          user={user}
          onChanged={summary.reload}
        />
      )}
      {quick === "request" && (
        <RecordForm
          page="trfs"
          initialValues={{ clientId }}
          onClose={() => setQuick(null)}
          onSaved={() => {
            setQuick(null);
            summary.reload();
            setTab("trfs");
            setActivity(false);
          }}
        />
      )}
      {quick === "payment" && (
        <ClientPayment
          clientId={clientId}
          onClose={() => setQuick(null)}
          onSaved={() => {
            setQuick(null);
            summary.reload();
            setTab("billing");
            setActivity(false);
          }}
        />
      )}
      {overviewRecord && (
        <RecordDetail
          initial={overviewRecord}
          page="trfs"
          user={user}
          onClose={() => setOverviewRecord(null)}
          onSaved={summary.reload}
        />
      )}
    </>
  );
}
const fields: Record<Exclude<ClientSection, "files">, string[]> = {
  trfs: ["number", "project", "site", "dueDate"],
  samples: ["number", "description", "material", "trfId", "receiptStatus"],
  assignments: ["number", "sampleId", "methodId", "technicianId", "status"],
  reports: ["number", "revision", "status", "createdAt"],
  consolidated: ["number", "revision", "status", "createdAt"],
  billing: ["number", "description", "amountMinor", "paidMinor", "status"],
  quality: ["number", "title", "type", "owner", "status"],
};
function ClientRecords({
  clientId,
  section,
  user,
  onChanged,
}: {
  clientId: string;
  section: Exclude<ClientSection, "files">;
  user: User;
  onChanged: () => void;
}) {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [selected, setSelected] = useState<LabRecord | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const rows = useQuery<PageResult>(
    "/clients/" +
      clientId +
      "/workspace/records?" +
      new URLSearchParams({ section, page: String(page), q }),
  );
  const isReport = section === "reports" || section === "consolidated";
  async function download() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await (section === "reports" ? downloadReport : downloadConsolidated)(
        selected._id,
        String(selected.number) + "-R" + selected.revision + ".pdf",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title={labels[section]}
        description={
          isReport
            ? "Saved draft revisions for this client. Superseded and withdrawn versions remain visible."
            : section === "billing"
              ? "Charges and recorded payments linked to this client."
              : "Records linked to this client only."
        }
      />
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 p-5">
          <Field
            label={"Search " + labels[section].toLowerCase()}
            value={q}
            maxLength={100}
            placeholder="Search this client’s records…"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Button variant="secondary" onClick={rows.reload}>
            <RefreshCw size={14} />
            Refresh records
          </Button>
        </div>
        {rows.loading ? (
          <Loading />
        ) : rows.error ? (
          <Notice tone="red">
            {rows.error}
            <Button onClick={rows.reload}>Retry</Button>
          </Notice>
        ) : (
          <>
            <DataTable
              rows={rows.data?.items ?? []}
              onSelect={(r) => {
                setSelected(r);
                setError("");
              }}
              columns={fields[section].map((k) => ({
                key: k,
                label:
                  k === "amountMinor"
                    ? "Charge"
                    : k === "paidMinor"
                      ? "Paid"
                      : pretty(k),
                render: (r) =>
                  k === "status" || k === "receiptStatus" ? (
                    <div>
                      <Badge>{pretty(String(r[k]))}</Badge>
                      {section === "assignments" && (
                        <p className="mt-1 text-xs text-slate-500">
                          {nextStep(String(r.status))}
                        </p>
                      )}
                    </div>
                  ) : k.endsWith("Minor") ? (
                    money(r[k])
                  ) : k === "createdAt" || k === "dueDate" ? (
                    date(r[k])
                  ) : (
                    recordLabel(r[k])
                  ),
              }))}
            />
            <Pagination
              page={page}
              total={rows.data?.total ?? 0}
              onChange={setPage}
            />
          </>
        )}
      </Card>
      {selected &&
        (["trfs", "samples", "assignments"].includes(section) ? (
          <RecordDetail
            initial={selected}
            page={section as RegisterPage}
            user={user}
            onClose={() => setSelected(null)}
            onSaved={() => {
              rows.reload();
              onChanged();
            }}
          />
        ) : (
          <Modal
            title={String(selected.number)}
            wide
            onClose={() => {
              if (!busy) setSelected(null);
            }}
          >
            <Badge>{pretty(String(selected.status))}</Badge>
            <dl className="my-5 grid gap-4 sm:grid-cols-2">
              {(isReport
                ? ["revision", "createdAt", "reason"]
                : section === "billing"
                  ? ["description", "amountMinor", "paidMinor", "dueDate"]
                  : [
                      "title",
                      "type",
                      "owner",
                      "dueDate",
                      "description",
                      "rootCause",
                      "correction",
                      "correctiveAction",
                      "effectiveness",
                    ]
              ).map((k) => (
                <div key={k}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    {pretty(k)}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {k.endsWith("Minor")
                      ? money(selected[k])
                      : k === "createdAt" || k === "dueDate"
                        ? date(selected[k])
                        : recordLabel(selected[k])}
                  </dd>
                </div>
              ))}
            </dl>
            {section === "billing" && (
              <>
                <h3 className="mb-3 font-semibold">Payment history</h3>
                {((selected.payments as any[]) ?? []).length ? (
                  (selected.payments as any[]).map((p, i) => (
                    <div
                      key={i}
                      className="mb-3 rounded-lg border border-slate-200 p-4 text-sm"
                    >
                      {Object.entries(p)
                        .filter(([k]) => !["_id", "actorId"].includes(k))
                        .map(([k, v]) => (
                          <p key={k} className="break-words">
                            <span className="text-slate-500">
                              {pretty(k)}:{" "}
                            </span>
                            {k === "amountMinor" ? money(v) : recordLabel(v)}
                          </p>
                        ))}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No payments recorded.
                  </p>
                )}
              </>
            )}
            {isReport && (
              <>
                <Notice>
                  Draft only. Download the PDF to review the complete saved
                  report and its attachments.
                </Notice>
                <Button disabled={busy} onClick={download}>
                  {busy ? "Preparing PDF…" : "Download PDF"}
                </Button>
              </>
            )}
            {error && <Notice tone="red">{error}</Notice>}
          </Modal>
        ))}
    </>
  );
}
