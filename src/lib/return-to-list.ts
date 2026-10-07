// Remembers that the contact page was opened from the list in this tab,
// so "back to list" can return to the same search and scroll position.
const KEY = "crm:opened-from-list";

export function markOpenedFromList() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable (private mode): fall back to a plain link
  }
}

export function consumeOpenedFromList(): boolean {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value === "1";
  } catch {
    return false;
  }
}
