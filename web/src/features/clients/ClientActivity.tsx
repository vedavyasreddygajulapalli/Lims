import { useState } from "react";
import { useQuery } from "../../lib/useQuery";
import {
  Card,
  Loading,
  Notice,
  Empty,
  Pagination,
  Button,
} from "../../components/ui";
import { pretty, recordLabel, type PageResult } from "../../lib/types";
export function ClientActivity({ clientId }: { clientId: string }) {
  const [page, setPage] = useState(1);
  const q = useQuery<PageResult>(
    "/clients/" + clientId + "/workspace/activity?page=" + page,
  );
  return (
    <Card className="p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Client activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recorded actions you have permission to see, newest first.
          </p>
        </div>
        <Button variant="secondary" onClick={q.reload}>
          Refresh activity
        </Button>
      </div>
      {q.loading ? (
        <Loading />
      ) : q.error ? (
        <Notice tone="red">{q.error}</Notice>
      ) : q.data?.items.length ? (
        <>
          <ol className="space-y-5 border-l border-teal-200 pl-5">
            {q.data.items.map((r) => (
              <li key={r._id}>
                <p className="text-sm font-semibold">
                  {pretty(String(r.action))}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {pretty(String(r.entity))} · {recordLabel(r.actorId)}
                </p>
                <time className="text-xs text-slate-500">
                  {new Date(String(r.createdAt)).toLocaleString("en-IN")}
                </time>
              </li>
            ))}
          </ol>
          <Pagination page={page} total={q.data.total} onChange={setPage} />
        </>
      ) : (
        <Empty
          title="No recorded activity yet"
          description="New actions for this client will appear here. Older records may not have audit entries."
        />
      )}
    </Card>
  );
}
