import { writeFile, mkdir } from "node:fs/promises";
import { consolidatedPdf, REPORT_TEMPLATE } from "@lims/core";
const tests = [
  [
    "Concrete",
    "Cube compressive strength",
    { length_mm: "150.00", width_mm: "150.00", failure_load_kN: "519.3000" },
  ],
  [
    "Steel",
    "Tensile properties",
    {
      nominal_diameter_mm: "16.00",
      initial_gauge_length_mm: "80.000",
      maximum_force_kN: "124.500",
    },
  ],
  [
    "Soil",
    "Moisture content",
    {
      container_mass_g: "24.630",
      container_and_wet_soil_g: "75.420",
      container_and_dry_soil_g: "69.180",
    },
  ],
].map(([material, method, observations], i) => ({
  id: String(i + 1).padStart(24, "0"),
  version: 1,
  assignmentNumber: "TST-DEMO-00" + (i + 1),
  sampleId: "sample-" + i,
  sampleNumber: "SMP-DEMO-00" + (i + 1),
  description: material + " demonstration specimen",
  material,
  condition: "Received intact - synthetic example",
  storage: "Demonstration rack",
  receiptStatus: "accepted",
  method,
  methodVersion: "unconfigured",
  status: "observations_draft",
  observations,
  technician: "Demo Technician",
  reviewer: "",
  signatory: "",
  equipment: "Demonstration instrument - reference only",
}));
const snapshot = {
  template: REPORT_TEMPLATE,
  title: "Materials testing - consolidated report template",
  summary:
    "Illustrative report for three material categories. All names and observation values in this sample are synthetic and are provided only to demonstrate the report layout.",
  client: {
    name: "Demonstration Infrastructure",
    contact: "Demo Project Coordinator",
    email: "demo@example.com",
    phone: "Not supplied",
    address: "Demonstration project office",
  },
  request: {
    id: "demo-request",
    number: "TRF-DEMO-001",
    project: "Demonstration construction project",
    site: "Demo site - Block A",
    dueDate: "Not applicable",
    requestedTests:
      "Concrete cube, steel tensile properties and soil moisture observations",
  },
  tests,
  preparedBy: "Demo Laboratory Manager",
  capturedAt: "2026-10-20T00:00:00.000Z",
};
await mkdir("output/pdf", { recursive: true });
await writeFile(
  "output/pdf/Sainath_Consolidated_Template.pdf",
  await consolidatedPdf({
    number: "CTR-DEMO-001",
    revision: 0,
    status: "draft",
    reason: "Synthetic template demonstration; not a client test report",
    snapshot,
  }),
);
