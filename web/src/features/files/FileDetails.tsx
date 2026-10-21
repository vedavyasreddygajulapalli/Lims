import { useEffect, useState } from "react";
import {
  fileCategories,
  fileAccess,
  type ClientFile,
  type ClientFolder,
  type FileRevision,
} from "@lims/core";
import {
  Modal,
  Field,
  Select,
  Button,
  Notice,
  Loading,
  Badge,
} from "../../components/ui";
import { request, isDemo } from "../../lib/client";
import type { User } from "../../lib/types";
import { formatBytes, getFileBlob, saveBlob } from "./api";
export function FileDetails({
  file,
  folders,
  user,
  onClose,
  onSaved,
  onReplace,
}: {
  file: ClientFile;
  folders: ClientFolder[];
  user: User;
  onClose: () => void;
  onSaved: () => void;
  onReplace: (f: ClientFile) => void;
}) {
  const [data, setData] = useState<
      (ClientFile & { versions: FileRevision[] }) | null
    >(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [reason, setReason] = useState(""),
    [preview, setPreview] = useState<{
      url: string;
      mime: string;
      name: string;
    } | null>(null),
    [links, setLinks] = useState<any>({ requests: [], samples: [] });
  useEffect(() => {
    let current = true;
    request<any>("/files/assets/" + file._id)
      .then((d) => {
        if (current) setData(d);
      })
      .catch((e) => setError(e.message));
    request("/files/links/" + file.clientId)
      .then(setLinks)
      .catch((e) => setError(e.message));
    return () => {
      current = false;
    };
  }, [file._id]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview.url);
    },
    [preview],
  );
  const edit = data && fileAccess(user.roles, data.category, true);
  const field = (key: string, value: unknown) =>
    setData((d) => (d ? { ...d, [key]: value } : d));
  async function download(v: FileRevision, view = false) {
    setError("");
    setSaving(true);
    try {
      const blob = await getFileBlob(v._id);
      if (view)
        setPreview({
          url: URL.createObjectURL(blob),
          mime: v.mime,
          name: v.name,
        });
      else saveBlob(blob, v.name);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function save() {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      const {
        clientId,
        folderId,
        name,
        description,
        category,
        source,
        visibility,
        trfId,
        sampleId,
        version,
      } = data;
      await request("/files/assets/" + data._id, "PATCH", {
        clientId,
        folderId,
        name,
        description,
        category,
        source,
        visibility,
        trfId,
        sampleId,
        version,
        reason,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      wide
      title={preview ? preview.name : "File details & history"}
      onClose={() => !saving && onClose()}
    >
      {error && <Notice tone="red">{error}</Notice>}
      {!data ? (
        <Loading />
      ) : preview ? (
        <div className="space-y-4">
          <Button variant="secondary" onClick={() => setPreview(null)}>
            Back to file details
          </Button>
          {preview.mime.startsWith("image/") ? (
            <img
              className="max-h-[65vh] w-full rounded-xl object-contain"
              src={preview.url}
              alt={preview.name}
            />
          ) : (
            <iframe
              title={preview.name}
              sandbox=""
              src={preview.url}
              className="h-[65vh] w-full rounded-xl border border-slate-200"
            />
          )}
          <p className="text-xs text-slate-500">
            If your browser cannot preview this PDF, use Download from its
            version history.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data.archived ? "neutral" : "green"}>
              {data.archived ? "Archived" : "Active"}
            </Badge>
            <Badge>
              {data.visibility === "internal"
                ? "Internal only"
                : "Eligible for report selection"}
            </Badge>
            {isDemo && <Badge tone="amber">Demo · not scanned</Badge>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="File name"
              disabled={!edit || saving}
              value={data.name}
              maxLength={150}
              onChange={(e) => field("name", e.target.value)}
            />
            <Select
              label="Folder"
              disabled={!edit || saving}
              value={data.folderId ?? ""}
              onChange={(e) => field("folderId", e.target.value || null)}
            >
              <option value="">Client root</option>
              {folders.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Select
              label="Category"
              disabled={!edit || saving}
              value={data.category}
              onChange={(e) => field("category", e.target.value)}
            >
              {fileCategories
                .filter((c) => fileAccess(user.roles, c, Boolean(edit)))
                .map((c) => (
                  <option key={c}>{c}</option>
                ))}
            </Select>
            <Select
              label="Source"
              disabled={!edit || saving}
              value={data.source}
              onChange={(e) => field("source", e.target.value)}
            >
              <option value="client">Received from client</option>
              <option value="laboratory">Created by laboratory</option>
            </Select>
            <Select
              label="Report inclusion"
              disabled={!edit || saving}
              value={data.visibility}
              onChange={(e) => field("visibility", e.target.value)}
            >
              <option value="internal">Internal only</option>
              <option value="report_eligible">
                Eligible for report selection
              </option>
            </Select>
            <Select
              label="Request link"
              disabled={!edit || saving}
              value={data.trfId ?? ""}
              onChange={(e) => {
                field("trfId", e.target.value || null);
                field("sampleId", null);
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
              label="Sample link"
              disabled={!edit || saving || !data.trfId}
              value={data.sampleId ?? ""}
              onChange={(e) => field("sampleId", e.target.value || null)}
            >
              <option value="">No specific sample</option>
              {links.samples
                .filter((s: any) => s.trfId === data.trfId)
                .map((s: any) => (
                  <option key={s._id} value={s._id}>
                    {s.number}
                  </option>
                ))}
            </Select>
          </div>
          <Field
            label="File description"
            disabled={!edit || saving}
            value={data.description}
            maxLength={1000}
            onChange={(e) => field("description", e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Report eligibility does not publish this file. Attachments are
            selected explicitly when creating a report. Renaming or moving a
            file preserves its history.
          </p>
          {edit && (
            <div className="flex flex-wrap items-end gap-3">
              <Field
                label="Change reason"
                value={reason}
                minLength={3}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
              <Button
                disabled={saving || reason.trim().length < 3}
                onClick={save}
              >
                Save file details
              </Button>
              {!data.archived && (
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() => onReplace(data)}
                >
                  Upload new version
                </Button>
              )}
            </div>
          )}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="mb-3 font-semibold">Version history</h3>
            <div className="space-y-3">
              {data.versions.map((v) => (
                <article
                  key={v._id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Version {v.revision} · {v.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatBytes(v.size)} ·{" "}
                        {new Date(v.createdAt).toLocaleString()} ·{" "}
                        {(v as any).uploaderName ?? "Demo user"} · {v.status}
                      </p>
                    </div>
                    {v.status === "ready" && (
                      <div className="flex gap-2">
                        {[
                          "application/pdf",
                          "image/png",
                          "image/jpeg",
                          "image/webp",
                        ].includes(v.mime) && (
                          <Button
                            variant="secondary"
                            disabled={saving}
                            onClick={() => download(v, true)}
                          >
                            Preview
                          </Button>
                        )}
                        <Button disabled={saving} onClick={() => download(v)}>
                          Download v{v.revision}
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-600">{v.reason}</p>
                  <p className="mt-2 break-all font-mono text-[10px] text-slate-400">
                    SHA-256: {v.sha256}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
