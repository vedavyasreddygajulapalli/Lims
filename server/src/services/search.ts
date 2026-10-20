/** Escape user input before passing it to MongoDB's regex operator. */
export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
