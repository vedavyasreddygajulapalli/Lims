# Client files — implementation and activation

## What is implemented

The React/Tailwind Client files workspace uses the existing shared controls. Open it from navigation or a client detail. Choose a client, create nested named folders, upload files or a device folder, search/filter, rename/relink, move/category/archive/restore up to 100 selected files, download versions and export selected files as ZIP with a manifest. The upload queue accepts 100 files, shows per-file transfer/processing status, skips identical content in the same folder or keeps both, and retries unfinished files. Folder import preserves up to 10 levels where the browser supports directory selection. Closing/reloading loses the browser queue; completed live uploads remain stored.

Allowed: PDF, PNG, JPG/JPEG, WEBP, DOCX and XLSX. Maximum 24 MB each. Legacy DOC/XLS, macros, executables and arbitrary ZIP uploads are rejected. Server content detection must match the extension. Office files download; images/PDF have a browser preview. Bulk ZIP export is limited to 100 MB per operation to bound browser memory. File lists are paginated at 50; select across pages up to 100. Client search returns 100 matches; request/sample dropdowns show the latest 500 requests/1,000 samples. Folders are capped at 1,000 per client. Archive retains bytes and all versions; it does not free storage. No permanent deletion endpoint is exposed.

Folders and file records live in MongoDB. Bytes are scanned by ClamAV, encrypted with AES-256-GCM, then uploaded as private opaque .bin objects to Supabase. No original names or client names appear in the Supabase object paths. Backend-only service credentials retrieve encrypted objects; users receive decrypted, checksum-verified downloads only after authentication and role checks. Encryption keys and private API keys never go to the frontend, preview or repository.

Each version has its own object, SHA-256, uploader, time and reason. Replacement cannot overwrite historical bytes. A report pins explicit ready PDF/PNG/JPG versions marked report eligible, from the same client and compatible request. Internal and commercial files are excluded. Up to 10 appendices, 50 MB and 100 pages. Original PDF pages are embedded as visible page content in newly labelled draft appendix pages; image pages are fitted into A4. A later rename, new upload or archive does not change the pinned bytes. There is no client portal, public sharing or final-report issuance.

## Permissions

- Admin/manager: all file categories, folders, uploads, metadata, archive/restore.
- Reception: all categories, folders and file management.
- Accounts: commercial files only; cannot manage folders or inspect technical files.
- Reviewer/signatory: read non-commercial files; no file mutation.
- Technician: no access to the client file workspace in this release. Observation work is unchanged.

This is a single-laboratory app, not a multi-tenant client portal. `client`/`laboratory` is provenance; `internal`/`report_eligible` is report-selection eligibility. Neither makes a file public. Uploaded files do not alter calculations.

## Activate live uploads

1. Keep Supabase on its Free plan. Use an account dedicated to LIMS, or ensure adequate free capacity remains. The app reserves a conservative 900 MB including encrypted overhead; this covers only uploads through this app, not other Supabase account content. Supabase account bandwidth limits still apply; no plan upgrade is triggered by the app.
2. Create a private `lims-private` bucket without public access policies. Set `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` and `SUPABASE_STORAGE_BUCKET` on the backend only.
3. Generate `FILE_ENCRYPTION_KEY` using `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` in a secure administrator environment. Store it in backend secrets and back it up separately. Do not paste secrets into chat or commit them. Do not rotate it in place: existing ciphertext needs the original key.
4. Run an updated ClamAV daemon on a trusted/private network; set `CLAMAV_HOST` and `CLAMAV_PORT`. The scanner uses INSTREAM and fails closed on rejection, timeout or unavailability. The daemon must support at least 24 MB streams. Keep its signatures current. ClamAV is free software but hosting resource availability/cost is separate; no scanner service is silently purchased.
5. Configure persistent MongoDB and the authenticated backend deployment. The public static preview never calls Supabase and is not a private production deployment.
6. Verify a live upload/download checksum, an unauthenticated denial, restricted roles, scan rejection (EICAR test file), private encrypted provider objects, upload retry, quota enforcement and backup restoration. Provider credentials and scanner access are required for these checks. Mock-provider integration tests do not constitute live provider acceptance.

## Failure and recovery

A metadata reservation allocates storage before transfer. Upload attempts are idempotent by request key. The server validates SHA-256, exact size and format before scanning and sending bytes to Supabase. A failed attempt releases its reservation only after provider deletion is confirmed. Unknown outcomes keep their reservation and cannot be downloaded. Administrators can use Recover expired uploads for interrupted attempts older than one hour; deterministic object paths let the recovery remove provider-side orphan objects before freeing capacity. Re-run if provider cleanup is temporarily unavailable. At most two transfers are buffered per backend process; overload returns a retryable error.

Back up the MongoDB database, encrypted Supabase objects and encryption key as separate protected assets. An exported client ZIP contains decrypted documents and a manifest; protect it accordingly. It is not a complete server recovery backup. Automatic offsite backups, point-in-time database recovery and a verified operational restore depend on the final hosting setup and remain activation work. Archive/restore in the UI is available now and is distinct from disaster recovery.

## Preview and verification limits

The public preview generates synthetic PDFs and can hold selected local files in browser memory only. It does not upload those files to Supabase or claim a malware scan. Reload clears local changes. A 100 MB session cap bounds preview memory. Use demonstration files. Local browser visual QA is unavailable in this execution environment; DOM interaction tests cover the new flow. Production builds exclude the demo adapter and synthetic file generator.

Supabase Free currently includes 1 GB object storage; the 900 MB application cap leaves headroom. Free projects may pause after inactivity and provider bandwidth limits still apply. Reference: https://supabase.com/pricing and https://supabase.com/docs/guides/storage/pricing (checked 21 October 2026). No ImageKit integration is used.
