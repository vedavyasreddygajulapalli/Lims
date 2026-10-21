import { afterEach, beforeEach, describe, it, expect } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { resetDemo } from "../demo/adapter";
import { referenceSource } from "@lims/core";
beforeEach(resetDemo);
afterEach(cleanup);
describe("laboratory workspace UI", () => {
  it("shows a clearly labelled demo dashboard with derived totals", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Laboratory overview" });
    await screen.findAllByText("32");
    expect(screen.getByText("Demo · synthetic records")).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "samples",
    );
  });
  it("navigates, searches records and opens readable linked details", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Laboratory overview" });
    await user.click(screen.getByRole("button", { name: "Sample register" }));
    await screen.findByRole("heading", { name: "Sample register" });
    await user.type(screen.getByLabelText("Search records"), "Sample 32");
    await waitFor(() => expect(screen.queryByText("SMP-000001")).toBeNull());
    await user.click(
      await screen.findByRole("button", { name: "View SMP-000032" }),
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getAllByText(/Lakeview road widening/).length,
    ).toBeGreaterThan(0);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("creates a client with shared form components", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Laboratory overview" });
    await user.click(screen.getByRole("button", { name: "Clients" }));
    await screen.findByRole("heading", { name: "Clients" });
    await user.click(screen.getByRole("button", { name: "Add record" }));
    await screen.findByLabelText("Client / company name");
    for (const [label, value] of [
      ["Client / company name", "Example Laboratory Client"],
      ["Contact person", "Example contact"],
      ["Email address", "test@example.com"],
      ["Phone number", "1234567890"],
      ["Address", "Demo address"],
    ])
      await user.type(screen.getByLabelText(label), value);
    await user.click(screen.getByRole("button", { name: "Save record" }));
    await screen.findByText("Example Laboratory Client");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("checks three published samples and invalidates stale results when inputs change", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Laboratory overview" });
    await user.click(
      screen.getByRole("button", { name: /Reference calculator/ }),
    );
    await screen.findByText("3 / 3 matched");
    await user.click(
      screen.getByRole("button", { name: "Calculate reference" }),
    );
    await screen.findByText("REFERENCE RESULT");
    expect(
      screen
        .getByRole("link", { name: "Open public source" })
        .getAttribute("href"),
    ).toBe(referenceSource.url);
    await user.clear(screen.getByLabelText("Failure load · kN"));
    await user.type(screen.getByLabelText("Failure load · kN"), "524.6");
    expect(screen.queryByText("REFERENCE RESULT")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Calculate reference" }),
    );
    await screen.findByText("REFERENCE RESULT");
    expect(screen.getAllByText(/23.32/).length).toBeGreaterThan(0);
  });
  it("opens the assignment form with method selection dependent on the sample", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("heading", { name: "Laboratory overview" });
    await user.click(screen.getByRole("button", { name: "Test assignments" }));
    await screen.findByRole("heading", { name: "Test assignments" });
    await user.click(screen.getByRole("button", { name: "Add record" }));
    const select = (await screen.findByLabelText(
      "Matching method",
    )) as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    const sample = screen.getByLabelText(
      "Accepted sample",
    ) as HTMLSelectElement;
    await user.selectOptions(
      sample,
      Array.from(sample.options).find((o) =>
        o.textContent?.includes("Concrete"),
      )!.value,
    );
    expect(select.disabled).toBe(false);
    expect(
      within(select).getByRole("option", { name: /Cube compressive strength/ }),
    ).toBeTruthy();
    expect(
      within(select).queryByRole("option", { name: /Moisture content/ }),
    ).toBeNull();
  });
});

it("completes independent observation review and creates a draft snapshot", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Review queue" }));
  await screen.findByText("TST-000001");
  await u.click(
    screen.getAllByRole("button", { name: "Submit for review" })[0],
  );
  await u.type(
    screen.getByLabelText("Reason / review notes"),
    "Checked source observations",
  );
  await u.click(screen.getByRole("button", { name: "Confirm submit" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await u.selectOptions(
    screen.getByLabelText("Preview role"),
    "000000000000000000000003",
  );
  await u.click(
    await screen.findByRole("button", { name: "Accept observations" }),
  );
  await u.type(
    screen.getByLabelText("Reason / review notes"),
    "Independently verified",
  );
  await u.click(screen.getByRole("button", { name: "Confirm review" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await u.selectOptions(
    screen.getByLabelText("Preview role"),
    "000000000000000000000004",
  );
  await u.click(
    await screen.findByRole("button", { name: "Authorize observations" }),
  );
  await u.type(
    screen.getByLabelText("Reason / review notes"),
    "Reviewed within method scope",
  );
  await u.click(screen.getByRole("button", { name: "Confirm authorize" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await u.click(
    await screen.findByRole("button", { name: "Create draft report" }),
  );
  await u.type(
    screen.getByLabelText("Reason / review notes"),
    "Draft for checking only",
  );
  await u.click(screen.getByRole("button", { name: "Confirm draft" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await u.click(screen.getByRole("button", { name: "Draft reports" }));
  await screen.findByText("RPT-000001 · Revision 0");
  expect(
    screen.getByRole("button", { name: "Download draft PDF" }),
  ).toBeTruthy();
});
it("creates a ledger charge and records an exact partial payment", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Billing ledger" }));
  await u.click(await screen.findByRole("button", { name: "Add record" }));
  await u.selectOptions(
    screen.getByLabelText("Client"),
    "00000000000000000000000a",
  );
  await u.type(screen.getByLabelText("Description"), "Sample testing charge");
  await u.type(screen.getByLabelText("Amount (INR)"), "100.25");
  await u.type(screen.getByLabelText("Due Date"), "2026-11-30");
  await u.click(screen.getByRole("button", { name: "Save record" }));
  await screen.findByText("Sample testing charge");
  await u.click(screen.getByRole("button", { name: "Record payment" }));
  await u.type(screen.getByLabelText("Amount (INR)"), "40.10");
  await u.type(screen.getByLabelText("Reference"), "Bank ref 123");
  await u.click(screen.getByRole("button", { name: "Save payment" }));
  await screen.findByText(/Balance ₹60.15/);
});

it("opens every available screen and explains an empty search", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  for (const [label, title] of [
    ["Clients", "Clients"],
    ["Test requests", "Test requests"],
    ["Sample register", "Sample register"],
    ["Test assignments", "Test assignments"],
    ["Review queue", "Review queue"],
    ["Draft reports", "Draft reports"],
    ["Method catalogue", "Method catalogue"],
    ["Equipment", "Equipment"],
    ["Quality cases", "Quality cases"],
    ["Document register", "Document register"],
    ["Audit history", "Audit history"],
    ["Team & access", "Team & access"],
    ["Account & readiness", "Account & readiness"],
    ["Billing ledger", "Billing ledger"],
  ]) {
    await u.click(screen.getByRole("button", { name: label }));
    await screen.findByRole("heading", { name: title });
    expect(screen.queryByRole("alert")).toBeNull();
  }
  await u.click(screen.getByRole("button", { name: "Equipment" }));
  await screen.findByText("Compression testing machine");
  await u.type(screen.getByLabelText("Search records"), "no-such-equipment");
  await screen.findByText("No matching records");
}, 20000);
it("traps keyboard focus in a form and returns focus when closed", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Clients" }));
  const add = await screen.findByRole("button", { name: "Add record" });
  await u.click(add);
  const dialog = screen.getByRole("dialog");
  await u.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await u.tab({ shift: true });
  expect(dialog.contains(document.activeElement)).toBe(true);
  await u.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(add);
});

it("creates a consolidated report through the shared workspace", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Consolidated reports" }));
  await u.click(
    await screen.findByRole("button", { name: "Create consolidated report" }),
  );
  const select = (await screen.findByLabelText(
    "Test request / project",
  )) as HTMLSelectElement;
  await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
  await u.selectOptions(select, select.options[1].value);
  const checks = await screen.findAllByRole("checkbox");
  await u.click(checks[0]);
  await u.type(
    screen.getByLabelText("Creation / revision reason"),
    "Project draft review",
  );
  await u.click(
    screen.getByRole("button", { name: "Save consolidated draft" }),
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await u.click(await screen.findByRole("button", { name: "View report" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Download PDF",
    }),
  ).toBeTruthy();
});

it("creates a client folder and uploads a file through the shared file workspace", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Client files" }));
  await screen.findByRole("heading", { name: "Client files" });
  await screen.findByRole("button", { name: "Client instructions.pdf" });
  await u.click(screen.getByRole("button", { name: "Create folder" }));
  await u.type(screen.getByLabelText("Folder name"), "Project acceptance");
  await u.click(screen.getByRole("button", { name: "Save folder" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await u.click(
    await screen.findByRole("button", { name: "Project acceptance" }),
  );
  await u.click(screen.getByRole("button", { name: "Upload files" }));
  const { demoRequest, demoFileDownload } = await import("../demo/adapter");
  const rows: any = await demoRequest(
    "/files/list?clientId=00000000000000000000000a",
    "GET",
  );
  const b = await demoFileDownload(rows.items[0].currentId);
  await u.upload(
    screen.getByLabelText("Choose upload files"),
    new File([await b.arrayBuffer()], "Client plan.pdf", {
      type: "application/pdf",
    }),
  );
  await u.type(
    screen.getByLabelText("Upload reason"),
    "Received client drawing",
  );
  await u.click(screen.getByRole("button", { name: "Start upload" }));
  await screen.findByText("complete");
  await u.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }),
  );
  await u.click(await screen.findByRole("button", { name: "Client plan.pdf" }));
  await screen.findByText("Version history");
  expect(screen.getByRole("button", { name: "Download v1" })).toBeTruthy();
});

it("opens a complete client dashboard, scoped records and embedded folders", async () => {
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Clients" }));
  await u.click(await screen.findByRole("button", { name: "View CLI-000001" }));
  await screen.findByRole("heading", { name: "Greenfield Infrastructure" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByText("client1@example.com")).toBeTruthy();
  await screen.findByRole("heading", { name: "Account summary" });
  await u.click(
    within(
      screen.getByRole("navigation", { name: "Client sections" }),
    ).getByRole("button", { name: /Test requests/ }),
  );
  await screen.findByRole("button", { name: "View TRF-000001" });
  expect(screen.queryByRole("button", { name: "View TRF-000002" })).toBeNull();
  await u.click(screen.getByRole("button", { name: "View TRF-000001" }));
  await screen.findByRole("dialog");
  await u.keyboard("{Escape}");
  await u.click(screen.getByRole("button", { name: "Open client files" }));
  await screen.findByRole("button", { name: "Client instructions.pdf" });
  expect(screen.queryByLabelText("Client file workspace")).toBeNull();
  await u.click(screen.getByRole("button", { name: "Back to clients" }));
  await screen.findByRole("heading", { name: "Clients" });
  await u.click(await screen.findByRole("button", { name: "View CLI-000002" }));
  await screen.findByRole("heading", { name: "Summit Buildworks" });
  expect(screen.queryByText("client1@example.com")).toBeNull();
});

it("creates a preselected client request, searches it and saves a favourite", async () => {
  localStorage.clear();
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Clients" }));
  await u.click(await screen.findByRole("button", { name: "View CLI-000001" }));
  await screen.findByRole("heading", { name: "Greenfield Infrastructure" });
  await u.click(screen.getByRole("button", { name: "New test request" }));
  const select = await screen.findByLabelText("Client");
  expect((select as HTMLSelectElement).disabled).toBe(true);
  expect((select as HTMLSelectElement).value).toBe("00000000000000000000000a");
  for (const [label, value] of [
    ["Project name", "Usability test project"],
    ["Project site", "Site A"],
    ["Requested tests", "Concrete"],
    ["Due date", "2026-12-01"],
  ])
    await u.type(screen.getByLabelText(label), value);
  await u.click(screen.getByRole("button", { name: "Save record" }));
  await screen.findByText("Usability test project");
  await u.click(screen.getByRole("button", { name: "Search & recent work" }));
  await u.type(
    screen.getByLabelText("Search clients, requests, samples, tests and files"),
    "Usability test",
  );
  const star = await screen.findByRole("button", { name: /Favourite TRF/ });
  await u.click(star);
  expect(star.getAttribute("aria-pressed")).toBe("true");
  await u.click(
    screen.getByRole("button", {
      name: star.getAttribute("aria-label")!.replace("Favourite ", "Open "),
    }),
  );
  await screen.findByRole("dialog");
  expect(
    within(screen.getByRole("dialog")).getByText("Usability test project"),
  ).toBeTruthy();
});

it("records a payment from the client quick action and rejects overpayment", async () => {
  const { demoRequest } = await import("../demo/adapter");
  const charge: any = await demoRequest("/billing", "POST", {
    clientId: "00000000000000000000000a",
    description: "Quick action charge",
    amountMinor: 10000,
    dueDate: "2026-12-01",
  });
  const u = userEvent.setup();
  render(<App />);
  await screen.findByRole("heading", { name: "Laboratory overview" });
  await u.click(screen.getByRole("button", { name: "Clients" }));
  await u.click(await screen.findByRole("button", { name: "View CLI-000001" }));
  await screen.findByRole("heading", { name: "Greenfield Infrastructure" });
  await u.click(screen.getByRole("button", { name: "Record client payment" }));
  await u.selectOptions(
    await screen.findByLabelText("Client charge"),
    charge._id,
  );
  await u.type(screen.getByLabelText("Payment amount · INR"), "101");
  await u.type(screen.getByLabelText("Payment reference"), "DEMO-RECEIPT");
  await u.click(screen.getByRole("button", { name: "Save payment" }));
  await screen.findByRole("alert");
  await u.clear(screen.getByLabelText("Payment amount · INR"));
  await u.type(screen.getByLabelText("Payment amount · INR"), "40");
  await u.click(screen.getByRole("button", { name: "Save payment" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await screen.findByRole("heading", { name: "Billing & payments" });
  expect(screen.getByText("₹40.00")).toBeTruthy();
});
