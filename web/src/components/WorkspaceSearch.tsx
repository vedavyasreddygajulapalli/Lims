import { useState, useEffect } from "react";
import type { SearchHit } from "@lims/core";
import { Button, Modal, Field, Loading, Notice, Empty } from "./ui";
import { Search, Star, ArrowUpRight } from "lucide-react";
import { useQuery } from "../lib/useQuery";
import { savedWork, updateWork, clearRecent } from "../lib/recent";
import { canView } from "../app/navigation";
import type { User, Page } from "../lib/types";
export function WorkspaceSearch({
  user,
  onOpen,
}: {
  user: User;
  onOpen: (hit: SearchHit) => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [q, setQ] = useState(""),
    [debounced, setDebounced] = useState(""),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    const f = () => setRevision((n) => n + 1);
    window.addEventListener("lims-work-changed", f);
    return () => window.removeEventListener("lims-work-changed", f);
  }, []);
  const result = useQuery<{ items: SearchHit[] }>(
    "/search?q=" + encodeURIComponent(open ? debounced : ""),
  );
  const saved = savedWork(user.id),
    visible = (h: SearchHit) => canView(h.kind as Page, user);
  async function choose(hit: SearchHit) {
    setError("");
    setBusy(true);
    try {
      await onOpen(hit);
      updateWork(user.id, hit, "visit");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function rows(items: SearchHit[]) {
    return items.filter(visible).map((h) => (
      <div
        key={h.kind + h.id}
        className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
      >
        <button
          aria-label={"Open " + h.label}
          disabled={busy}
          className="min-w-0 flex-1 text-left"
          onClick={() => choose(h)}
        >
          <span className="block text-xs uppercase text-slate-500">
            {h.kind}
          </span>
          <span className="block break-words font-semibold text-teal-800">
            {h.label}
          </span>
          <span className="block truncate text-sm text-slate-500">
            {h.detail}
          </span>
        </button>
        <Button
          variant="ghost"
          aria-label={"Favourite " + h.label}
          aria-pressed={saved.favourites.some(
            (x) => x.kind === h.kind && x.id === h.id,
          )}
          onClick={() => updateWork(user.id, h, "favourite")}
        >
          <Star
            size={17}
            fill={
              saved.favourites.some((x) => x.kind === h.kind && x.id === h.id)
                ? "currentColor"
                : "none"
            }
          />
        </Button>
      </div>
    ));
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Search size={16} />
        Search & recent work
      </Button>
      {open && (
        <Modal
          protectChanges={false}
          title="Find your work"
          wide
          onClose={() => !busy && setOpen(false)}
        >
          <Field
            label="Search clients, requests, samples, tests and files"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={100}
            placeholder="Type at least two characters…"
          />
          {(error || result.error) && (
            <Notice tone="red">{error || result.error}</Notice>
          )}
          <div className="mt-5 space-y-3">
            {q.trim().length >= 2 ? (
              result.loading ? (
                <Loading />
              ) : result.data?.items.length ? (
                <>
                  <p className="text-xs text-slate-500">
                    Up to 10 matches per record type. Refine your search for
                    more specific results.
                  </p>
                  {rows(result.data.items)}
                </>
              ) : (
                <Empty
                  title="No matching work"
                  description="Try a client name, record number or filename."
                />
              )
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Recent work and favourites are saved on this device for your
                  account. Records are checked again when opened.
                </p>
                <h3 className="font-semibold">Favourites</h3>
                {saved.favourites.length ? (
                  rows(saved.favourites)
                ) : (
                  <p className="text-sm text-slate-500">
                    Use the star beside a search result to keep it here.
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recent work</h3>
                  <Button variant="ghost" onClick={() => clearRecent(user.id)}>
                    Clear recent
                  </Button>
                </div>
                {saved.recent.length ? (
                  rows(saved.recent)
                ) : (
                  <p className="text-sm text-slate-500">
                    Records you open will appear here.
                  </p>
                )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
