# Consolidated reports

The Consolidated reports workspace captures selected tests for one request into a versioned draft. The Sainath Signature v1.0 renderer is shared by the API, preview and sample generator. Select up to 30 assignments, preview the snapshot, download a PDF, create a revision or withdraw the current draft.

Snapshots retain exact observation strings, source assignment versions, sample and client details, equipment and recorded review identities. Revision and withdrawal require a current version and audit reason. Admin, manager, reviewer and signatory roles can access this workspace. Creation, revision and audit writes share a MongoDB transaction. Previous snapshots remain unchanged.

These documents are drafts only. Approved formulas, validated results, units, acceptance limits and final issuance are pending laboratory input. Reviewer names are workflow records, not signatures. No accreditation is asserted. Non-ASCII characters are visibly escaped in PDFs; original stored strings are retained. The list shows the latest 200 records.

Generate the synthetic sample after building core: `node scripts/report-sample.mjs`. Output: `output/pdf/Sainath_Consolidated_Template.pdf`.
