import { useEffect, useRef, useState } from "react";
import { Upload, FolderUp, FileUp } from "lucide-react";
import {
  fileMime,
  MAX_FILE_BYTES,
  fileCategories,
  fileSources,
  fileAccess,
  type ClientFile,
  type ClientFolder,
} from "@lims/core";
import { Button, Field, Select, Modal, Notice } from "../../components/ui";
import { request, isDemo } from "../../lib/client";
import type { User } from "../../lib/types";
import { uploadFile, formatBytes } from "./api";
type Item = {
  key: string;
  file: File;
  state: string;
  progress: number;
  error: string;
};
export function UploadDialog({
  clientId,
  folderId,
  folders,
  user,
  source,
  onClose,
  onSaved,
}: {
  clientId: string;
  folderId: string | null;
  folders: ClientFolder[];
  user: User;
  source?: ClientFile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [origin, setOrigin] = useState(source?.source ?? "client"),
    [category, setCategory] = useState(
      source?.category ??
        (user.roles.every((r) => r === "accounts") ? "commercial" : "general"),
    ),
    [description, setDescription] = useState(source?.description ?? ""),
    [duplicate, setDuplicate] = useState("skip"),
    [reason, setReason] = useState(""),
    [trfId, setTrf] = useState(source?.trfId ?? ""),
    [sampleId, setSample] = useState(source?.sampleId ?? ""),
    [links, setLinks] = useState<any>({ requests: [], samples: [] });
  const stopped = useRef(false),
    mounted = useRef(true),
    fileInput = useRef<HTMLInputElement>(null),
    folderInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    request("/files/links/" + clientId)
      .then(setLinks)
      .catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
      stopped.current = true;
    };
  }, [clientId]);
  useEffect(() => {
    if (!busy) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [busy]);
  function choose(files: FileList | File[] | null) {
    if (!files) return;
    const picked = Array.from(files);
    if (items.length + picked.length > (source ? 1 : 100)) {
      setError(
        source
          ? "Select one replacement file"
          : "Select up to 100 files per batch",
      );
      return;
    }
    setError("");
    setItems((old) => [
      ...old,
      ...picked.map((file) => ({
        key: crypto.randomUUID(),
        file,
        state: "queued",
        progress: 0,
        error: !fileMime(file.name)
          ? "Unsupported type"
          : file.size > MAX_FILE_BYTES || file.size === 0
            ? "Use a file between 1 byte and 24 MB"
            : "",
      })),
    ]);
  }
  function update(key: string, patch: Partial<Item>) {
    if (mounted.current)
      setItems((rows) =>
        rows.map((r) => (r.key === key ? { ...r, ...patch } : r)),
      );
  }
  async function run() {
    setError("");
    if (reason.trim().length < 3) {
      setError("Provide an upload reason");
      return;
    }
    setBusy(true);
    stopped.current = false;
    const known = [...folders];
    try {
      for (const item of items) {
        if (stopped.current) break;
        if (
          ["complete", "skipped"].includes(item.state) ||
          !fileMime(item.file.name) ||
          item.file.size > MAX_FILE_BYTES ||
          !item.file.size
        )
          continue;
        update(item.key, { state: "uploading", progress: 0, error: "" });
        try {
          let destination = source?.folderId ?? folderId;
          const segments = (item.file.webkitRelativePath || "")
            .split("/")
            .slice(0, -1);
          if (segments.length > 10)
            throw new Error("Folder upload supports up to 10 nested levels");
          for (const name of segments) {
            let folder = known.find(
              (f) =>
                f.parentId === destination &&
                f.name.toLowerCase() === name.toLowerCase(),
            );
            if (!folder) {
              folder = await request<ClientFolder>("/files/folders", "POST", {
                clientId,
                parentId: destination,
                name,
              });
              known.push(folder);
            }
            destination = folder._id;
          }
          const state = await uploadFile(
            item.file,
            {
              clientId,
              folderId: destination,
              description,
              category,
              source: origin,
              visibility: source?.visibility ?? "internal",
              trfId: trfId || null,
              sampleId: sampleId || null,
              duplicate,
              reason,
              ...(source
                ? { assetId: source._id, assetVersion: source.version }
                : {}),
            },
            (p) => update(item.key, { progress: p }),
            item.key,
          );
          update(item.key, { state, progress: 100 });
        } catch (e) {
          update(item.key, { state: "failed", error: (e as Error).message });
        }
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        onSaved();
      }
    }
  }
  return (
    <Modal
      wide
      title={source ? "Upload a new file version" : "Upload client files"}
      onClose={() => !busy && onClose()}
    >
      <div className="space-y-5">
        {isDemo && (
          <Notice>
            Browser-only demo. Files are not sent to Supabase or scanned. Use
            sample files; reload clears this session.
          </Notice>
        )}
        {error && <Notice tone="red">{error}</Notice>}
        <div
          className="rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/50 p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!busy) choose(e.dataTransfer.files);
          }}
        >
          <Upload className="mx-auto mb-3 text-teal-700" size={26} />
          <p className="font-semibold text-slate-800">
            Drop files here, or choose from your device
          </p>
          <p className="my-2 text-xs text-slate-500">
            PDF, PNG, JPG, WEBP, DOCX, XLSX · 24 MB each · up to 100 files
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp size={15} />
              Choose files
            </Button>
            {!source && !user.roles.every((r) => r === "accounts") && (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => folderInput.current?.click()}
              >
                <FolderUp size={15} />
                Choose folder
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            aria-label="Choose upload files"
            className="sr-only"
            type="file"
            multiple={!source}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx"
            onChange={(e) => {
              choose(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={folderInput}
            aria-label="Choose upload folder"
            className="sr-only"
            type="file"
            multiple
            {...({ webkitdirectory: "" } as any)}
            onChange={(e) => {
              choose(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="File source"
            value={origin}
            disabled={busy || Boolean(source)}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {fileSources.map((s) => (
              <option key={s} value={s}>
                {s === "client"
                  ? "Received from client"
                  : "Created by laboratory"}
              </option>
            ))}
          </Select>
          <Select
            label="File category"
            value={category}
            disabled={busy || Boolean(source)}
            onChange={(e) => setCategory(e.target.value)}
          >
            {fileCategories
              .filter((c) => fileAccess(user.roles, c, true))
              .map((c) => (
                <option key={c}>{c}</option>
              ))}
          </Select>
          <Select
            label="Linked request"
            disabled={busy || Boolean(source)}
            value={trfId}
            onChange={(e) => {
              setTrf(e.target.value);
              setSample("");
            }}
          >
            <option value="">Client-level file</option>
            {links.requests.map((r: any) => (
              <option key={r._id} value={r._id}>
                {r.number} · {r.project}
              </option>
            ))}
          </Select>
          <Select
            label="Linked sample"
            disabled={busy || !trfId || Boolean(source)}
            value={sampleId}
            onChange={(e) => setSample(e.target.value)}
          >
            <option value="">No specific sample</option>
            {links.samples
              .filter((s: any) => s.trfId === trfId)
              .map((s: any) => (
                <option key={s._id} value={s._id}>
                  {s.number}
                </option>
              ))}
          </Select>
        </div>
        <Field
          label="Description"
          maxLength={1000}
          value={description}
          disabled={busy || Boolean(source)}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Identical file handling"
            value={duplicate}
            disabled={busy || Boolean(source)}
            onChange={(e) => setDuplicate(e.target.value)}
          >
            <option value="skip">Skip identical files in this folder</option>
            <option value="keep">Keep both as separate files</option>
          </Select>
          <Field
            label="Upload reason"
            required
            minLength={3}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {!!items.length && (
          <div
            className="max-h-64 space-y-2 overflow-auto rounded-xl border border-slate-200 p-3"
            aria-live="polite"
          >
            {items.map((item) => (
              <div key={item.key} className="rounded-lg bg-slate-50 p-3">
                <div className="flex justify-between gap-3 text-sm">
                  <span className="break-all font-medium">
                    {item.file.webkitRelativePath || item.file.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {formatBytes(item.file.size)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <progress
                    aria-label={"Upload progress " + item.file.name}
                    className="h-2 w-full accent-teal-700"
                    max={100}
                    value={item.progress}
                  />
                  <span className="text-xs">
                    {item.state === "uploading" && item.progress === 100
                      ? "Processing"
                      : item.state}
                  </span>
                </div>
                {item.error && (
                  <p className="mt-1 text-xs text-red-700">{item.error}</p>
                )}
                {!busy && !["complete", "skipped"].includes(item.state) && (
                  <button
                    className="mt-1 text-xs text-slate-600 underline"
                    onClick={() =>
                      setItems((v) => v.filter((x) => x.key !== item.key))
                    }
                  >
                    Remove from queue
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">
          New files are internal-only. Mark selected files eligible for a report
          in their details. Folder uploads preserve subfolders where supported
          by your browser.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Close
          </Button>
          {busy ? (
            <Button
              variant="secondary"
              onClick={() => {
                stopped.current = true;
              }}
            >
              Pause after current file
            </Button>
          ) : (
            <Button
              disabled={
                !items.some((i) => !["complete", "skipped"].includes(i.state))
              }
              onClick={run}
            >
              {items.some((i) => i.state === "failed")
                ? "Retry unfinished files"
                : "Start upload"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
