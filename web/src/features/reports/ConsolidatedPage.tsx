import { useEffect, useState } from "react";
import {
  REPORT_TEMPLATE,
  consolidatedCounts,
  type ConsolidatedSnapshot,
  type ConsolidatedReport,
  type ConsolidatedTest,
} from "@lims/core";
import {
  Button,
  Card,
  Field,
  Select,
  Modal,
  Notice,
  PageHeader,
  Loading,
  Empty,
  Badge,
} from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import { request, downloadConsolidated } from "../../lib/client";
import type { LabRecord, PageResult } from "../../lib/types";
type Report = ConsolidatedReport & {
  _id: string;
  trfId: string;
  version: number;
};
type Context = Pick<ConsolidatedSnapshot, "client" | "request" | "tests">;
export function ConsolidatedPage() {
  const list = useQuery<Report[]>("/consolidated");
  const [compose, setCompose] = useState(false),
    [source, setSource] = useState<Report | null>(null),
    [detail, setDetail] = useState<Report | null>(null),
    [withdrawing, setWithdrawing] = useState<Report | null>(null),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  function open(source: Report | null) {
    setSource(source);
    setCompose(true);
    setError("");
  }
  async function download(row: Report) {
    try {
      await downloadConsolidated(
        row._id,
        row.number + "-R" + row.revision + "-DRAFT.pdf",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const rows = (list.data ?? []).filter((r) =>
    (r.number + " " + r.snapshot.client.name + " " + r.snapshot.request.project)
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="CLIENT DELIVERABLES"
        title="Consolidated reports"
        description="Bring one project's samples and tests into a single, versioned PDF."
        action={
          <Button onClick={() => open(null)}>Create consolidated report</Button>
        }
      />
      <div className="mb-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl bg-[#123e3a] p-7 text-white">
          <p className="text-xs uppercase tracking-[.2em] text-emerald-200">
            Sainath Signature · Template v{REPORT_TEMPLATE.version}
          </p>
          <h2 className="my-3 text-2xl font-semibold">
            One report. Every selected test.
          </h2>
          <p className="max-w-lg text-sm leading-6 text-emerald-50/80">
            Client cover, project scope, test schedule, detailed observations
            and a review trail in a consistent laboratory report.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {["A4 portrait", "Automatic pagination", "Versioned snapshots"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/20 px-3 py-1"
                >
                  {t}
                </span>
              ),
            )}
          </div>
        </section>
        <Card className="p-6">
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Template structure
          </p>
          <ol className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700">
            {[
              "01 Client cover",
              "02 Project details",
              "03 Test schedule",
              "04 Test sections",
              "05 Review trail",
              "06 Document control",
            ].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </Card>
      </div>
      <Notice>
        Draft reports only. Formula validation and final issue are pending.
        Saved reports preserve the original values and review state at capture.
      </Notice>
      {(error || list.error) && (
        <Notice tone="red">{error || list.error}</Notice>
      )}
      <Card className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-5">
          <Field
            label="Search reports"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button variant="secondary" onClick={list.reload}>
            Refresh reports
          </Button>
        </div>
        {list.loading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty
            title="No reports found"
            description="Choose a project and select the tests to create your first consolidated draft."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const count = consolidatedCounts(row.snapshot);
              return (
                <article
                  key={row._id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-teal-700">
                      {row.number} · R{row.revision}
                    </p>
                    <h3 className="mt-1 font-semibold">
                      {row.snapshot.client.name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {row.snapshot.request.project} · {count.tests} tests ·{" "}
                      {count.samples} samples
                    </p>
                  </div>
                  <Badge tone={row.status === "draft" ? "amber" : "neutral"}>
                    {row.status}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setDetail(row)}>
                      View report
                    </Button>
                    <Button onClick={() => download(row)}>Download PDF</Button>
                    {row.status === "draft" && (
                      <>
                        <Button variant="ghost" onClick={() => open(row)}>
                          Revise
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setWithdrawing(row);
                            setReason("");
                            setError("");
                          }}
                        >
                          Withdraw
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            <p className="p-5 text-xs text-slate-400">
              Latest 200 reports · previous revisions remain available
            </p>
          </div>
        )}
      </Card>
      {compose && (
        <Compose
          source={source}
          onClose={() => setCompose(false)}
          onSaved={() => {
            setCompose(false);
            list.reload();
          }}
        />
      )}
      {detail && (
        <Modal
          wide
          title={detail.number + " · Revision " + detail.revision}
          onClose={() => setDetail(null)}
        >
          <div className="space-y-4">
            <Notice>
              {detail.status.toUpperCase()} · Template{" "}
              {detail.snapshot.template.version} · Captured{" "}
              {new Date(detail.snapshot.capturedAt).toLocaleString()}
            </Notice>
            <h3 className="text-xl font-semibold">{detail.snapshot.title}</h3>
            <p className="text-sm text-slate-600">
              {detail.snapshot.client.name} · {detail.snapshot.request.project}
            </p>
            <p className="whitespace-pre-wrap text-sm">
              {detail.snapshot.summary}
            </p>
            {detail.snapshot.tests.map((t) => (
              <details
                key={t.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {t.sampleNumber} · {t.method}
                </summary>
                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(t.observations).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-2 gap-3">
                      <dt className="break-words text-slate-500">{k}</dt>
                      <dd className="whitespace-pre-wrap break-words font-mono">
                        {v || "[empty value]"}
                      </dd>
                    </div>
                  ))}
                </dl>
                {!Object.keys(t.observations).length && (
                  <p className="mt-3 text-sm text-amber-700">
                    No observations recorded
                  </p>
                )}
                <p className="mt-3 text-xs text-slate-500">
                  Captured state: {t.status} · Source version {t.version}
                </p>
              </details>
            ))}
            <Button onClick={() => download(detail)}>Download PDF</Button>
          </div>
        </Modal>
      )}
      {withdrawing && (
        <Modal
          title={"Withdraw " + withdrawing.number}
          onClose={() => !busy && setWithdrawing(null)}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request(
                  "/consolidated/" + withdrawing._id + "/withdraw",
                  "POST",
                  { version: withdrawing.version, reason },
                );
                setWithdrawing(null);
                list.reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {error && <Notice tone="red">{error}</Notice>}
            <Field
              label="Withdrawal reason"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button disabled={busy}>Confirm withdrawal</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function Compose({
  source,
  onClose,
  onSaved,
}: {
  source: Report | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [query, setQuery] = useState(""),
    [trf, setTrf] = useState(source?.trfId ?? ""),
    [context, setContext] = useState<Context | null>(null),
    [selected, setSelected] = useState<string[]>(
      source?.snapshot.tests.map((t) => t.id) ?? [],
    ),
    [title, setTitle] = useState(
      source?.snapshot.title ?? "Consolidated laboratory test report",
    ),
    [summary, setSummary] = useState(source?.snapshot.summary ?? ""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const requests = useQuery<PageResult>("/trfs?q=" + encodeURIComponent(query));
  useEffect(() => {
    let current = true;
    setContext(null);
    if (!trf) return;
    setLoading(true);
    setError("");
    request<Context>("/consolidated/options/" + trf)
      .then((c) => {
        if (current) setContext(c);
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
  }, [trf]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const selections = selected.map((id) => {
        const t = context!.tests.find((t) => t.id === id);
        if (!t)
          throw new Error(
            "A selected test is unavailable. Check your selection.",
          );
        return { id, version: t.version };
      });
      await request("/consolidated", "POST", {
        trfId: trf,
        title,
        summary,
        reason,
        selections,
        ...(source
          ? { sourceId: source._id, sourceVersion: source.version }
          : {}),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={
        source
          ? "Create revised consolidated draft"
          : "Create consolidated report"
      }
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={save} className="space-y-5">
        {(error || requests.error) && (
          <Notice tone="red">{error || requests.error}</Notice>
        )}
        {!source && (
          <>
            <Field
              label="Find project or request number"
              placeholder="Search all test requests"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              label="Test request / project"
              required
              value={trf}
              onChange={(e) => {
                setTrf(e.target.value);
                setSelected([]);
              }}
            >
              <option value="">Select a request</option>
              {context && !requests.data?.items.some((r) => r._id === trf) && (
                <option value={trf}>
                  {context.request.number} · {context.request.project}
                </option>
              )}
              {requests.data?.items.map((r) => (
                <option key={r._id} value={r._id}>
                  {String(r.number)} · {String(r.project)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">
              Showing up to 50 matches. Search to find older requests.
            </p>
          </>
        )}
        {loading ? (
          <Loading />
        ) : (
          context && (
            <>
              <div className="rounded-xl bg-teal-50 p-4">
                <b className="text-sm text-teal-900">{context.client.name}</b>
                <p className="mt-1 text-xs text-teal-800">
                  {context.request.project} · {context.request.site}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                  Select tests ({selected.length}/30)
                </h3>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setSelected(
                      selected.length
                        ? []
                        : context.tests.slice(0, 30).map((t) => t.id),
                    )
                  }
                >
                  {selected.length
                    ? "Clear selection"
                    : "Select up to 30 tests"}
                </Button>
              </div>
              {!context.tests.length ? (
                <Empty
                  title="No tests assigned"
                  description="Assign tests to this request's samples before composing a report."
                />
              ) : (
                <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3">
                  {context.tests.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-3 rounded-lg p-3 hover:bg-slate-50"
                    >
                      <input
                        className="mt-1"
                        type="checkbox"
                        aria-label={"Include " + t.assignmentNumber}
                        checked={selected.includes(t.id)}
                        disabled={
                          !selected.includes(t.id) && selected.length >= 30
                        }
                        onChange={() =>
                          setSelected((v) =>
                            v.includes(t.id)
                              ? v.filter((id) => id !== t.id)
                              : [...v, t.id],
                          )
                        }
                      />
                      <span>
                        <b className="block text-sm">
                          {t.sampleNumber} · {t.method}
                        </b>
                        <span className="mt-1 block text-xs text-slate-500">
                          {t.assignmentNumber} · {t.material} ·{" "}
                          {t.status.replaceAll("_", " ")} ·{" "}
                          {Object.keys(t.observations).length} observation
                          fields
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )
        )}
        <Field
          label="Report title"
          required
          minLength={3}
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="block text-sm font-medium text-slate-700">
          Scope / client notes
          <textarea
            className="mt-2 block min-h-24 w-full rounded-xl border border-slate-300 p-3 font-normal"
            maxLength={1500}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <Field
          label="Creation / revision reason"
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Notice>
          Incomplete tests may be included for review. They will be labelled
          clearly; all PDFs remain drafts.
        </Notice>
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button disabled={busy || loading || !context || !selected.length}>
            {busy ? "Creating…" : "Save consolidated draft"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
