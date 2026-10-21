import type { SearchHit } from "@lims/core";
export interface SavedWork {
  recent: SearchHit[];
  favourites: SearchHit[];
}
const key = (user: string) => "lims-work-" + user;
export function savedWork(user: string): SavedWork {
  try {
    const v = JSON.parse(localStorage.getItem(key(user)) || "{}");
    const valid = (a: any) =>
      Array.isArray(a)
        ? a
            .filter(
              (x) =>
                x &&
                /^[a-f0-9]{24}$/.test(x.id) &&
                ["clients", "trfs", "samples", "assignments", "files"].includes(
                  x.kind,
                ) &&
                typeof x.label === "string" &&
                typeof x.detail === "string",
            )
            .slice(0, 20)
        : [];
    return { recent: valid(v.recent), favourites: valid(v.favourites) };
  } catch {
    return { recent: [], favourites: [] };
  }
}
export function updateWork(
  user: string,
  hit: SearchHit,
  action: "visit" | "favourite",
) {
  const state = savedWork(user),
    same = (x: SearchHit) => x.id === hit.id && x.kind === hit.kind;
  if (action === "visit")
    state.recent = [hit, ...state.recent.filter((x) => !same(x))].slice(0, 12);
  else
    state.favourites = state.favourites.some(same)
      ? state.favourites.filter((x) => !same(x))
      : [hit, ...state.favourites].slice(0, 20);
  try {
    localStorage.setItem(key(user), JSON.stringify(state));
  } catch {}
  window.dispatchEvent(new Event("lims-work-changed"));
}
export function clearRecent(user: string) {
  const state = savedWork(user);
  try {
    localStorage.setItem(key(user), JSON.stringify({ ...state, recent: [] }));
  } catch {}
  window.dispatchEvent(new Event("lims-work-changed"));
}
