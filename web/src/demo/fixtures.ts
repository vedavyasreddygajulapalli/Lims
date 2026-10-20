import type { LabRecord, User } from "../lib/types";
export const demoUser: User = {
  id: "000000000000000000000001",
  name: "Demo Administrator",
  roles: ["admin", "manager", "technician", "reviewer"],
};
const id = (n: number) => n.toString(16).padStart(24, "0");
const date = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
};
/** Synthetic workflow records. These are not public laboratory records. */
export function makeFixtures(): Record<string, LabRecord[]> {
  const clients = [
    "Greenfield Infrastructure",
    "Summit Buildworks",
    "Eastline Projects",
    "Cedar Engineering",
  ].map((name, i) => ({
    _id: id(i + 10),
    number: `CLI-${String(i + 1).padStart(6, "0")}`,
    name,
    contact: "Demo contact",
    email: `client${i + 1}@example.com`,
    phone: "Demo contact number",
    address: "Synthetic project address",
    createdAt: date(-10 + i),
  }));
  const trfs = [
    "Greenfield · Block A",
    "Lakeview road widening",
    "Summit · Foundation works",
    "Eastline · Water line",
    "Cedar · Structural checks",
    "Greenfield · Block B",
  ].map((project, i) => ({
    _id: id(i + 30),
    number: `TRF-${String(i + 1).padStart(6, "0")}`,
    clientId: clients[i % 4]._id,
    project,
    site: "Demo site " + (i + 1),
    requestedTests: "As per demo request",
    dueDate: date(i + 1).slice(0, 10),
    createdAt: date(-5 + i),
  }));
  const materials = [
    "Concrete",
    "Soil",
    "Aggregates",
    "Steel",
    "Water",
    "Road materials",
    "Cement",
  ];
  const names = [
    "Cube compressive strength",
    "Moisture content",
    "Sieve analysis",
    "Tensile properties",
    "Parameter-specific tests",
    "Marshall test",
    "Compressive strength",
  ];
  const methods = materials.map((material, i) => ({
    _id: id(i + 60),
    name: names[i],
    material,
    status: "awaiting_source",
    version: "unconfigured",
  }));
  const samples = Array.from({ length: 32 }, (_, i) => ({
    _id: id(i + 100),
    number: `SMP-${String(i + 1).padStart(6, "0")}`,
    trfId: trfs[i % 6]._id,
    description: `${materials[i < 15 ? 0 : i % 7]} · Sample ${i + 1}`,
    material: materials[i < 15 ? 0 : i % 7],
    condition: "Received intact",
    storage: "Rack " + String.fromCharCode(65 + (i % 4)),
    receiptStatus:
      i === 6 || i === 17 ? "quarantined" : i === 22 ? "rejected" : "accepted",
    createdAt: date(-((i * 3 + (i % 4)) % 7)),
  }));
  const assignments = samples
    .filter((s) => s.receiptStatus === "accepted")
    .slice(0, 20)
    .map((s, i) => ({
      _id: id(i + 200),
      number: `TST-${String(i + 1).padStart(6, "0")}`,
      sampleId: s._id,
      methodId: methods.find((m) => m.material === s.material)!._id,
      technicianId: demoUser.id,
      status: i < 8 ? "observations_draft" : "assigned",
      observations: i < 8 ? { source_reading: "0001.2300" } : {},
      version: i < 8 ? 1 : 0,
      createdAt: date(-i % 6),
    }));
  const users = [
    {
      _id: demoUser.id,
      name: demoUser.name,
      email: "admin@example.com",
      roles: demoUser.roles,
      active: true,
    },
    {
      _id: id(2),
      name: "Demo Technician",
      email: "technician@example.com",
      roles: ["technician"],
      active: true,
    },
    {
      _id: id(3),
      name: "Demo Reviewer",
      email: "reviewer@example.com",
      roles: ["reviewer"],
      active: true,
    },
  ];
  const audit = assignments.slice(0, 6).map((a, i) => ({
    _id: id(300 + i),
    actorId: demoUser.id,
    entity: "assignments",
    entityId: a._id,
    action: "create",
    after: a,
    reason: "Synthetic demonstration record",
    createdAt: date(-i % 3),
  }));
  const people = users.map((u) => ({
    ...u,
    version: 0,
    methodIds: [] as string[],
  }));
  people.push({
    _id: id(4),
    name: "Demo Signatory",
    email: "signatory@example.com",
    roles: ["signatory"],
    active: true,
    version: 0,
    methodIds: methods.map((m) => m._id),
  });
  const equipment = [
    {
      _id: id(400),
      number: "EQP-000001",
      name: "Compression testing machine",
      serial: "DEMO-CTM-01",
      location: "Concrete laboratory",
      calibrationDue: date(90).slice(0, 10),
      status: "active",
      certificateReference: "DEMO-CAL-001",
      version: 0,
    },
  ];
  const quality = [
    {
      _id: id(410),
      number: "QLT-000001",
      title: "Sample label clarification",
      type: "nonconformity",
      sampleId: samples[6]._id,
      owner: "Demo Manager",
      dueDate: date(5).slice(0, 10),
      status: "investigating",
      description:
        "Synthetic case: confirm the received sample identification.",
      rootCause: "",
      correction: "",
      correctiveAction: "",
      effectiveness: "",
      version: 0,
    },
  ];
  const documents = [
    {
      _id: id(420),
      number: "DOC-000001",
      title: "Sample reception procedure",
      reference: "DEMO-SOP-001",
      revision: "Draft 1",
      owner: "Demo Manager",
      reviewDue: date(30).slice(0, 10),
      status: "draft",
      location: "Demonstration reference only",
      version: 0,
    },
  ];
  return {
    clients,
    trfs,
    samples,
    assignments,
    methods,
    users: people,
    audit,
    equipment,
    quality,
    documents,
    billing: [],
    reports: [], consolidated:[],
  };
}
