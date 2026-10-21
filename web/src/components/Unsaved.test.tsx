import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, Field } from "./ui";
import { confirmLeave } from "../lib/unsaved";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("protects changed forms on close and navigation, and cleans up on unmount", async () => {
  const close = vi.fn(),
    confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  const u = userEvent.setup();
  const view = render(
    <Modal title="Edit details" onClose={close}>
      <Field label="Name" defaultValue="Original" />
    </Modal>,
  );
  await u.type(screen.getByLabelText("Name"), " edited");
  await u.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(close).not.toHaveBeenCalled();
  expect(confirmLeave()).toBe(false);
  expect(confirm).toHaveBeenCalled();
  confirm.mockReturnValue(true);
  await u.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(close).toHaveBeenCalledOnce();
  view.unmount();
  expect(confirmLeave()).toBe(true);
});
