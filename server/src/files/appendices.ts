import type mongoose from "mongoose";
import { fileAccess, type ReportAppendix } from "@lims/core";
import { FileAsset, FileVersion } from "./models.js";
import { DomainError } from "../domain.js";
import { readFileVersion } from "./router.js";
import type { FileStorage } from "./storage.js";
export async function captureAppendices(
  ids: string[],
  clientId: string,
  trfId: string,
  user: any,
  session?: mongoose.ClientSession,
) {
  const result: ReportAppendix[] = [];
  let bytes = 0,
    pages = 0;
  for (const id of ids) {
    const v: any = await FileVersion.findOne({ _id: id, status: "ready" })
      .session(session ?? null)
      .lean();
    const a: any =
      v &&
      (await FileAsset.findOne({
        _id: v.assetId,
        clientId,
        archived: false,
        visibility: "report_eligible",
      })
        .session(session ?? null)
        .lean());
    if (
      !v ||
      !a ||
      a.category === "commercial" ||
      !fileAccess(user.roles, a.category) ||
      (a.trfId && String(a.trfId) !== trfId)
    )
      throw new DomainError(
        422,
        "Appendix is not eligible for this client and request",
      );
    if (!["application/pdf", "image/png", "image/jpeg"].includes(v.mime))
      throw new DomainError(422, "Select PDF, PNG or JPG appendices");
    bytes += v.size;
    pages += v.pageCount ?? 1;
    if (pages > 100)
      throw new DomainError(422, "Appendices cannot exceed 100 pages");
    if (bytes > 50_000_000)
      throw new DomainError(422, "Appendices cannot exceed 50 MB combined");
    result.push({
      versionId: String(v._id),
      assetId: String(a._id),
      name: v.name,
      mime: v.mime,
      size: v.size,
      sha256: v.sha256,
      revision: v.revision,
    });
  }
  return result;
}
export async function appendixBytes(
  storage: FileStorage,
  entries: ReportAppendix[],
) {
  const files = [];
  for (const meta of entries) {
    const { data, version } = await readFileVersion(storage, meta.versionId);
    if (version.sha256 !== meta.sha256)
      throw new DomainError(409, "Appendix version mismatch");
    files.push({ meta, bytes: new Uint8Array(data) });
  }
  return files;
}
