import { nextStep } from "@lims/core";
import { useState } from "react";
import {
  Button,
  Card,
  Field,
  Modal,
  Notice,
  PageHeader,
  Loading,
  Empty,
  Badge,
  Select,
} from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import { request, downloadReport } from "../../lib/client";
import {
  recordLabel,
  idOf,
  pretty,
  type LabRecord,
  type User,
} from "../../lib/types";
export function WorkflowPage({
  page,
  user,
}: {
  page: "review" | "reports";
  user: User;
}) {
  const query = useQuery<LabRecord[]>("/" + page);
  const equipment = useQuery<LabRecord[]>("/equipment");
  const [task, setTask] = useState<{ row: LabRecord; action: string } | null>(
      null,
    ),
    [reason, setReason] = useState(""),
    [equipmentId, setEquipmentId] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const has = (r: string) => user.roles.includes(r);
  function open(row: LabRecord, action: string) {
    setTask({ row, action });
    setError("");
    setReason("");
    setEquipmentId(idOf(row.equipmentId));
  }
  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      const { row, action } = task;
      if (action === "draft")
        await request("/reports", "POST", { assignmentId: row._id, reason });
      else if (action === "equipment")
        await request("/assignments/" + row._id + "/equipment", "PATCH", {
          equipmentId,
          version: row.version,
          reason,
        });
      else
        await request(
          page === "reports"
            ? "/reports/" + row._id + "/action"
            : "/assignments/" + row._id + "/workflow",
          "POST",
          { action, version: row.version, reason },
        );
      setTask(null);
      query.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title={page === "review" ? "Review queue" : "Draft reports"}
        description={
          page === "review"
            ? "Trace observations from technician submission to independent review and method-scoped authorization."
            : "Immutable observation snapshots with revision history and draft PDF downloads."
        }
      />
      <Notice>
        Formulas are awaiting your source files. These steps review observation
        records only; no final laboratory results or valid test reports are
        issued.
      </Notice>
      {query.error && (
        <Notice tone="red">
          {query.error}
          <Button onClick={query.reload}>Retry</Button>
        </Notice>
      )}
      {error && !task && <Notice tone="red">{error}</Notice>}
      <Card className="mt-5">
        {query.loading ? (
          <Loading />
        ) : !query.data?.length ? (
          <Empty
            title={
              page === "reports"
                ? "No draft reports yet"
                : "No observations awaiting action"
            }
            description="Save observations, submit them for independent review, then authorize with a separate method signatory."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {query.data.map((row) => (
              <article key={row._id} className="space-y-4 p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {String(row.number)}
                      {page === "reports" ? " · Revision " + row.revision : ""}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {page === "review"
                        ? recordLabel(row.sampleId) +
                          " / " +
                          recordLabel(row.methodId)
                        : String((row.snapshot as LabRecord)?.assignmentNumber)}
                    </p>
                  </div>
                  <Badge tone={row.status === "authorized" ? "green" : "amber"}>
                    {pretty(String(row.status))}
                  </Badge>
                  {page === "review" && (
                    <p className="text-sm font-medium text-teal-800">
                      Next: {nextStep(String(row.status))}
                    </p>
                  )}
                </div>
                <details className="rounded-lg bg-slate-50 p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    {page === "reports"
                      ? "Snapshot and review trail"
                      : "Observation values and assigned equipment"}
                  </summary>
                  <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words text-xs">
                    {JSON.stringify(
                      page === "reports"
                        ? row.snapshot
                        : {
                            observations: row.observations,
                            equipment: recordLabel(row.equipmentId),
                          },
                      null,
                      2,
                    )}
                  </pre>
                </details>
                <div className="flex flex-wrap gap-2">
                  {page === "review" ? (
                    <>
                      {has("technician") &&
                        idOf(row.technicianId) === user.id &&
                        ["observations_draft", "returned"].includes(
                          String(row.status),
                        ) && (
                          <Button onClick={() => open(row, "submit")}>
                            Submit for review
                          </Button>
                        )}
                      {has("reviewer") &&
                        idOf(row.technicianId) !== user.id &&
                        row.status === "awaiting_review" && (
                          <>
                            <Button onClick={() => open(row, "review")}>
                              Accept observations
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => open(row, "return")}
                            >
                              Return to technician
                            </Button>
                          </>
                        )}
                      {has("signatory") && row.status === "reviewed" && (
                        <Button onClick={() => open(row, "authorize")}>
                          Authorize observations
                        </Button>
                      )}
                      {has("signatory") &&
                        row.status === "authorized" &&
                        idOf(row.authorizedBy) === user.id && (
                          <Button onClick={() => open(row, "draft")}>
                            Create draft report
                          </Button>
                        )}
                      {has("manager") &&
                        ["awaiting_review", "reviewed", "authorized"].includes(
                          String(row.status),
                        ) && (
                          <Button
                            variant="secondary"
                            onClick={() => open(row, "reopen")}
                          >
                            Reopen
                          </Button>
                        )}
                      {(has("admin") || has("manager")) &&
                        ["observations_draft", "returned"].includes(
                          String(row.status),
                        ) && (
                          <Button
                            variant="secondary"
                            onClick={() => open(row, "equipment")}
                          >
                            Assign equipment
                          </Button>
                        )}
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        onClick={async () => {
                          try {
                            await downloadReport(
                              row._id,
                              String(row.number) +
                                "-R" +
                                row.revision +
                                "-DRAFT.pdf",
                            );
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        Download draft PDF
                      </Button>
                      {(has("manager") || has("signatory")) &&
                        row.status === "draft" && (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => open(row, "revise")}
                            >
                              New revision
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => open(row, "withdraw")}
                            >
                              Withdraw
                            </Button>
                          </>
                        )}
                    </>
                  )}
                </div>
              </article>
            ))}
            <p className="p-5 text-xs text-slate-500">Latest 200 records</p>
          </div>
        )}
      </Card>
      {task && (
        <Modal
          title={pretty(task.action) + " · " + task.row.number}
          onClose={() => !busy && setTask(null)}
        >
          <form onSubmit={run} className="space-y-4">
            {error && <Notice tone="red">{error}</Notice>}
            {task.action === "equipment" && (
              <Select
                label="Equipment"
                required
                value={equipmentId}
                onChange={(e) => setEquipmentId(e.target.value)}
              >
                <option value="">Select equipment</option>
                {equipment.data?.map((r) => (
                  <option key={r._id} value={r._id}>
                    {String(r.number)} · {String(r.name)} · {String(r.status)} ·
                    Due {String(r.calibrationDue)}
                  </option>
                ))}
              </Select>
            )}
            <Field
              label="Reason / review notes"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button disabled={busy}>
              {busy
                ? "Saving…"
                : "Confirm " + pretty(task.action).toLowerCase()}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
