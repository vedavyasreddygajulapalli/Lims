import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({
  destroy: vi.fn(),
  render: vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() })),
  getPage: vi.fn(),
}));
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    destroy: mocks.destroy,
    promise: Promise.resolve({ numPages: 2, getPage: mocks.getPage }),
  }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?raw", () => ({ default: "" }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renders PDF pages with paging, zoom, download and cleanup controls", async () => {
  URL.createObjectURL = vi.fn(() => "blob:worker");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private cb: any) {}
      observe() {
        this.cb([{ contentRect: { width: 600 } }]);
      }
      disconnect() {}
    },
  );
  mocks.getPage.mockImplementation(async () => ({
    getViewport: ({ scale }: any) => ({
      width: 600 * scale,
      height: 800 * scale,
    }),
    render: mocks.render,
  }));
  const { PdfViewer } = await import("./PdfViewer");
  const u = userEvent.setup();
  const view = render(<PdfViewer url="blob:test" name="instructions.pdf" />);
  await screen.findByText("Page 1 of 2");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Next" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  await u.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Page 2 of 2");
  await waitFor(() =>
    expect(
      (screen.getByRole("button", { name: "Zoom in" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false),
  );
  await u.click(screen.getByRole("button", { name: "Zoom in" }));
  await screen.findByText("125%");
  expect(
    screen.getByRole("link", { name: "Download PDF" }).getAttribute("download"),
  ).toBe("instructions.pdf");
  view.unmount();
  expect(mocks.destroy).toHaveBeenCalled();
});
