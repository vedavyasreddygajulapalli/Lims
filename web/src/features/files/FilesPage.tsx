import { useEffect, useState } from "react";
import {
  Folder,
  FolderPlus,
  Upload,
  Search,
  Files,
  Archive,
  Download,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import {
  fileCategories,
  fileAccess,
  canManageFiles,
  folderPath,
  type ClientFile,
  type ClientFolder,
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
  Pagination,
  Badge,
} from "../../components/ui";
import { useQuery } from "../../lib/useQuery";
import { request, isDemo } from "../../lib/client";
import type { User } from "../../lib/types";
import { UploadDialog } from "./UploadDialog";
import { FileDetails } from "./FileDetails";
import { formatBytes, downloadFiles, saveBlob } from "./api";
export function FilesPage({
  user,
  initialClient = "",
}: {
  user: User;
  initialClient?: string;
}) {
  const [clientId, setClient] = useState(initialClient),
    [clientSearch, setClientSearch] = useState(""),
    [folderId, setFolder] = useState("all"),
    [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [source, setSource] = useState(""),
    [archived, setArchived] = useState(false),
    [page, setPage] = useState(1),
    [mime, setMime] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [upload, setUpload] = useState(false),
    [replacement, setReplacement] = useState<ClientFile | undefined>(),
    [detail, setDetail] = useState<ClientFile | null>(null),
    [selection, setSelection] = useState<Record<string, ClientFile>>({}),
    [folderDialog, setFolderDialog] = useState<"new" | "edit" | null>(null),
    [folderName, setFolderName] = useState(""),
    [parent, setParent] = useState(""),
    [reason, setReason] = useState(""),
    [action, setAction] = useState(""),
    [destination, setDestination] = useState(""),
    [newCategory, setNewCategory] = useState("general");
  const clients = useQuery<any[]>(
      "/files/clients?q=" + encodeURIComponent(clientSearch),
    ),
    status = useQuery<any>("/files/status"),
    folders = useQuery<ClientFolder[]>(
      "/files/folders/" + (clientId || "000000000000000000000000"),
    );
  const query = new URLSearchParams({
    clientId: clientId || "000000000000000000000000",
    folderId,
    q,
    category,
    source,
    archived: String(archived),
    page: String(page),
    mime,
    from,
    to,
  });
  const list = useQuery<{ items: ClientFile[]; total: number; page: number }>(
    "/files/list?" + query,
  );
  const selected = Object.values(selection);
  const currentFolder = folders.data?.find((f) => f._id === folderId);
  const write = canManageFiles(user.roles),
    manageFolders = user.roles.some((r) =>
      ["admin", "manager", "reception"].includes(r),
    );
  useEffect(() => {
    if (!clientId && clients.data?.length) setClient(clients.data[0]._id);
  }, [clients.data, clientId]);
  useEffect(() => {
    setPage(1);
    setSelection({});
  }, [clientId, folderId, q, category, source, archived, mime, from, to]);
  function reload() {
    list.reload();
    folders.reload();
    status.reload();
    setSelection({});
  }
  const toggle = (row: ClientFile) =>
    setSelection((old) => {
      const next = { ...old };
      if (next[row._id]) delete next[row._id];
      else if (Object.keys(next).length < 100) next[row._id] = row;
      return next;
    });
  async function run(task: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveFolder() {
    await run(async () => {
      if (folderDialog === "edit") {
        await request("/files/folders/" + folderId, "PATCH", {
          version: currentFolder!.version,
          name: folderName,
          parentId: parent || null,
          reason,
        });
      } else
        await request("/files/folders", "POST", {
          clientId,
          parentId: parent || null,
          name: folderName,
        });
      setFolderDialog(null);
      folders.reload();
    });
  }
  async function bulk() {
    await run(async () => {
      await request("/files/bulk", "POST", {
        clientId,
        items: selected.map((r) => ({ id: r._id, version: r.version })),
        action,
        reason,
        ...(action === "move" ? { folderId: destination || null } : {}),
        ...(action === "categorize" ? { category: newCategory } : {}),
      });
      setMessage(selected.length + " files updated");
      setAction("");
      reload();
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="CLIENT WORKSPACE"
        title="Client files"
        description="Organize client documents, laboratory files and supporting evidence in one place."
        action={
          <Button
            disabled={!clientId || !write || !status.data?.ready}
            onClick={() => {
              setReplacement(undefined);
              setUpload(true);
            }}
          >
            <Upload size={16} />
            Upload files
          </Button>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Files size={15} />
            Files in this view
          </div>
          <p className="mt-3 text-2xl font-semibold">{list.data?.total ?? 0}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Folder size={15} />
            Client folders
          </div>
          <p className="mt-3 text-2xl font-semibold">
            {folders.data?.length ?? 0}
          </p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <ShieldCheck size={15} />
            {isDemo ? "Demo storage" : "Application storage allowance"}
          </div>
          <p className="mt-3 text-lg font-semibold">
            {formatBytes(status.data?.usedBytes ?? 0)}{" "}
            <span className="text-sm font-normal text-slate-400">/ 900 MB</span>
          </p>
          <progress
            className="mt-3 h-1.5 w-full accent-teal-700"
            aria-label="File storage usage"
            max={status.data?.limitBytes ?? 1}
            value={status.data?.usedBytes ?? 0}
          />
        </Card>
      </div>
      <Notice tone={status.data?.ready && !isDemo ? "green" : "amber"}>
        {status.data?.message ?? "Checking file storage…"}
      </Notice>
      {(error ||
        list.error ||
        folders.error ||
        clients.error ||
        status.error) && (
        <Notice tone="red">
          {error ||
            list.error ||
            folders.error ||
            clients.error ||
            status.error}
        </Notice>
      )}
      {message && <Notice tone="green">{message}</Notice>}
      <div className="my-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="Find client"
          placeholder="Search company or client number"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
        />
        <Select
          label="Client file workspace"
          value={clientId}
          onChange={(e) => {
            setClient(e.target.value);
            setFolder("all");
            setDetail(null);
            setMessage("");
          }}
        >
          <option value="">Select client</option>
          {clientId && !clients.data?.some((c) => c._id === clientId) && (
            <option value={clientId}>Selected client</option>
          )}
          {clients.data?.map((c) => (
            <option value={c._id} key={c._id}>
              {c.number} · {c.name}
            </option>
          ))}
        </Select>
      </div>
      {!clientId ? (
        <Empty
          title="Choose a client"
          description="Create a client first, then organize their files here."
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <Card className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Folders</h2>
              {manageFolders && (
                <Button
                  variant="ghost"
                  aria-label="Create folder"
                  onClick={() => {
                    setFolderDialog("new");
                    setFolderName("");
                    setParent(currentFolder ? folderId : "");
                    setReason("");
                  }}
                >
                  <FolderPlus size={17} />
                </Button>
              )}
            </div>
            <button
              className={
                "mb-1 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm " +
                (folderId === "all" && !archived
                  ? "bg-teal-50 font-semibold text-teal-800"
                  : "text-slate-600")
              }
              onClick={() => {
                setFolder("all");
                setArchived(false);
              }}
            >
              <Files size={16} />
              All client files
            </button>
            <button
              className={
                "mb-1 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm " +
                (folderId === "root"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600")
              }
              onClick={() => {
                setFolder("root");
                setArchived(false);
              }}
            >
              <Folder size={16} />
              Client root
            </button>
            <div className="max-h-80 overflow-auto">
              {folders.data?.map((f) => (
                <button
                  key={f._id}
                  title={folderPath(folders.data!, f._id)}
                  className={
                    "mb-1 flex w-full items-start gap-2 rounded-lg p-3 text-left text-xs " +
                    (folderId === f._id
                      ? "bg-teal-50 font-semibold text-teal-800"
                      : "text-slate-600 hover:bg-slate-50")
                  }
                  onClick={() => {
                    setFolder(f._id);
                    setArchived(false);
                  }}
                >
                  <Folder size={15} className="shrink-0" />
                  <span className="break-words">
                    {folderPath(folders.data!, f._id)}
                  </span>
                </button>
              ))}
            </div>
            <button
              className={
                "mt-4 flex w-full items-center gap-2 border-t border-slate-100 p-3 text-left text-sm " +
                (archived ? "text-teal-700 font-semibold" : "text-slate-500")
              }
              onClick={() => {
                setFolder("all");
                setArchived(true);
              }}
            >
              <Archive size={16} />
              Archived files
            </button>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Folders organize files. Access is controlled by roles and file
              categories.
            </p>
          </Card>
          <Card className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <h2 className="font-semibold">
                  {archived
                    ? "Archive"
                    : (currentFolder?.name ??
                      (folderId === "root"
                        ? "Client root"
                        : "All client files"))}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {currentFolder
                    ? folderPath(folders.data ?? [], folderId)
                    : "Select files to move, download or archive"}{" "}
                  · {selected.length}/100 selected
                </p>
              </div>
              <div className="flex gap-2">
                {currentFolder && manageFolders && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFolderDialog("edit");
                      setFolderName(currentFolder.name);
                      setParent(currentFolder.parentId ?? "");
                      setReason("");
                    }}
                  >
                    Edit folder
                  </Button>
                )}
                <Button
                  variant="secondary"
                  aria-label="Refresh files"
                  onClick={reload}
                >
                  <RefreshCw size={15} />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-2 xl:grid-cols-3">
              <Field
                label="Search files"
                value={q}
                placeholder="Name or description"
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                label="Filter category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {fileCategories
                  .filter((c) => fileAccess(user.roles, c))
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </Select>
              <Select
                label="Filter source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">All sources</option>
                <option value="client">Received from client</option>
                <option value="laboratory">Laboratory files</option>
              </Select>
              <Select
                label="File type"
                value={mime}
                onChange={(e) => setMime(e.target.value)}
              >
                <option value="">All types</option>
                <option value="application/pdf">PDF</option>
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WEBP</option>
                <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">
                  Word (DOCX)
                </option>
                <option value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
                  Excel (XLSX)
                </option>
              </Select>
              <Field
                label="Uploaded from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Field
                label="Uploaded through"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            {!!selected.length && (
              <div className="flex flex-wrap items-center gap-2 border-b border-teal-100 bg-teal-50/60 p-4">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(() => downloadFiles(selected))}
                >
                  <Download size={14} />
                  Download ZIP
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    saveBlob(
                      new Blob([JSON.stringify(selected, null, 2)], {
                        type: "application/json",
                      }),
                      "file-manifest.json",
                    )
                  }
                >
                  Export manifest
                </Button>
                {write &&
                  ["move", "categorize", archived ? "restore" : "archive"].map(
                    (a) => (
                      <Button
                        key={a}
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setAction(a);
                          setReason("");
                          setDestination("");
                        }}
                      >
                        {a[0].toUpperCase() + a.slice(1)}
                      </Button>
                    ),
                  )}
                <Button variant="ghost" onClick={() => setSelection({})}>
                  Clear selection
                </Button>
              </div>
            )}
            {list.loading ? (
              <Loading />
            ) : !list.data?.items.length ? (
              <Empty
                title="No files found"
                description="Upload files to this client or adjust the current filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="p-4">
                        <input
                          aria-label="Select visible files"
                          type="checkbox"
                          checked={
                            Boolean(list.data.items.length) &&
                            list.data.items.every((r) => selection[r._id])
                          }
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelection((old) => {
                              const next = { ...old };
                              for (const row of list.data!.items) {
                                if (!checked) delete next[row._id];
                                else if (Object.keys(next).length < 100)
                                  next[row._id] = row;
                              }
                              return next;
                            });
                          }}
                        />
                      </th>
                      <th className="p-4">File</th>
                      <th className="p-4">Source / category</th>
                      <th className="p-4">Version / size</th>
                      <th className="p-4">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {list.data.items.map((row) => (
                      <tr key={row._id} className="hover:bg-slate-50/60">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            aria-label={"Select " + row.name}
                            checked={Boolean(selection[row._id])}
                            onChange={() => toggle(row)}
                          />
                        </td>
                        <td className="min-w-48 p-4">
                          <button
                            className="break-all text-left font-semibold text-teal-800 hover:underline"
                            onClick={() => setDetail(row)}
                          >
                            {row.name}
                          </button>
                          <p className="mt-1 text-xs text-slate-400">
                            {row.folderId
                              ? folders.data?.some(
                                  (f) => f._id === row.folderId,
                                )
                                ? folderPath(folders.data, row.folderId)
                                : "Linked folder"
                              : "Client root"}
                          </p>
                        </td>
                        <td className="p-4">
                          <p>
                            {row.source === "client"
                              ? "Client shared"
                              : "Laboratory"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            {row.category}
                          </p>
                        </td>
                        <td className="whitespace-nowrap p-4">
                          {row.current
                            ? "v" +
                              row.current.revision +
                              " · " +
                              formatBytes(row.current.size)
                            : "No completed upload"}
                          <p className="mt-1 text-xs text-slate-400">
                            {new Date(row.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="p-4">
                          <Badge
                            tone={
                              row.visibility === "internal" ? "neutral" : "blue"
                            }
                          >
                            {row.visibility === "internal"
                              ? "Internal"
                              : "Report eligible"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination
              page={page}
              total={list.data?.total ?? 0}
              onChange={setPage}
            />
          </Card>
        </div>
      )}
      {!!status.data?.cleanupCount && user.roles.includes("admin") && (
        <Notice>
          {status.data.cleanupCount} interrupted uploads need recovery.{" "}
          <Button
            disabled={busy}
            variant="secondary"
            onClick={() =>
              run(async () => {
                const r: any = await request("/files/recover", "POST", {});
                setMessage(
                  r.recovered +
                    " uploads recovered; " +
                    r.remaining +
                    " require another attempt",
                );
                reload();
              })
            }
          >
            Recover expired uploads
          </Button>
        </Notice>
      )}
      {upload && (
        <UploadDialog
          clientId={clientId}
          folderId={currentFolder ? folderId : null}
          folders={folders.data ?? []}
          user={user}
          source={replacement}
          onClose={() => {
            setUpload(false);
            setReplacement(undefined);
          }}
          onSaved={reload}
        />
      )}
      {detail && (
        <FileDetails
          file={detail}
          folders={folders.data ?? []}
          user={user}
          onClose={() => setDetail(null)}
          onSaved={reload}
          onReplace={(r) => {
            setDetail(null);
            setReplacement(r);
            setUpload(true);
          }}
        />
      )}
      {folderDialog && (
        <Modal
          title={folderDialog === "new" ? "Create folder" : "Edit folder"}
          onClose={() => !busy && setFolderDialog(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveFolder();
            }}
          >
            {error && <Notice tone="red">{error}</Notice>}
            <Field
              label="Folder name"
              required
              maxLength={150}
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
            />
            <Select
              label="Parent folder"
              value={parent}
              onChange={(e) => setParent(e.target.value)}
            >
              <option value="">Client root</option>
              {folders.data
                ?.filter((f) => folderDialog !== "edit" || f._id !== folderId)
                .map((f) => (
                  <option key={f._id} value={f._id}>
                    {folderPath(folders.data!, f._id)}
                  </option>
                ))}
            </Select>
            {folderDialog === "edit" && (
              <Field
                label="Folder change reason"
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            )}
            <Button disabled={busy}>Save folder</Button>
          </form>
        </Modal>
      )}
      {action && (
        <Modal
          title={action[0].toUpperCase() + action.slice(1) + " selected files"}
          onClose={() => !busy && setAction("")}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              bulk();
            }}
          >
            {error && <Notice tone="red">{error}</Notice>}
            <p className="text-sm text-slate-600">
              Apply to {selected.length} files. Previous file versions will be
              retained.
            </p>
            {action === "move" && (
              <Select
                label="Destination folder"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Client root</option>
                {folders.data?.map((f) => (
                  <option key={f._id} value={f._id}>
                    {folderPath(folders.data!, f._id)}
                  </option>
                ))}
              </Select>
            )}
            {action === "categorize" && (
              <Select
                label="New category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {fileCategories
                  .filter((c) => fileAccess(user.roles, c, true))
                  .map((c) => (
                    <option key={c}>{c}</option>
                  ))}
              </Select>
            )}
            <Field
              label="File action reason"
              required
              minLength={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button disabled={busy}>Confirm {action}</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
