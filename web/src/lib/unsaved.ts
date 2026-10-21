import { useEffect, useRef } from "react";
const pending = new Map<symbol, string>();
export function confirmLeave() {
  return (
    !pending.size ||
    window.confirm(
      "You have unsaved changes or unfinished uploads. Leave and discard the unfinished work?",
    )
  );
}
export function useUnsaved(active: boolean, message = "Unsaved changes") {
  const key = useRef(Symbol());
  useEffect(() => {
    if (active) pending.set(key.current, message);
    else pending.delete(key.current);
    return () => {
      pending.delete(key.current);
    };
  }, [active, message]);
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (pending.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, []);
}
