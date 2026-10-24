import type { useRouter } from "next/navigation";

// Remembers that the contact page was opened from the list in this tab,
// so "back to list" can return to the same search and scroll position.
const KEY = "crm:opened-from-list";

// The same, but only for this page load. After a reload a script-driven "back"
// may load the list anew, and the "undo" toast would be lost with the old page.
let openedInThisPageLoad = false;
// Scroll position of the list when the contact was opened, and the one the list
// has to put back itself after leaving a deleted contact (see takeListScrollToRestore)
let listScrollY = 0;
let scrollToRestore: number | null = null;

export function markOpenedFromList() {
  openedInThisPageLoad = true;
  listScrollY = window.scrollY;
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Storage unavailable (private mode): fall back to a plain link
  }
}

export function consumeOpenedFromList(): boolean {
  openedInThisPageLoad = false;
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value === "1";
  } catch {
    return false;
  }
}

// Leaves the page of a just-deleted contact for the list. Called inside the delete
// transition: it resolves once the navigation has started, so the list replaces the
// card in one go instead of showing "no such contact" first.
export function leaveForList(router: ReturnType<typeof useRouter>): Promise<void> {
  const inThisPageLoad = openedInThisPageLoad;
  if (consumeOpenedFromList() && inThisPageLoad && window.history.length > 1) {
    return new Promise((resolve) => {
      // Next starts its navigation in its own popstate listener, added before this one
      const done = () => {
        window.removeEventListener("popstate", done);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(done, 2000);
      window.addEventListener("popstate", done);
      scrollToRestore = listScrollY;
      // Going back keeps the search query, page and scroll position of the list
      router.back();
    });
  }
  // Replace, so that "back" does not lead to the deleted contact
  router.replace("/");
  return Promise.resolve();
}

// The browser restores the scroll position of "back" at once, but after a delete the
// list shows up only when the delete has finished, so the list puts it back itself
export function takeListScrollToRestore(): number | null {
  const y = scrollToRestore;
  scrollToRestore = null;
  return y;
}
