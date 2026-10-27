"use client";

import { useEffect, useLayoutEffect, useMemo, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Trash2Icon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ContactListItem } from "@/lib/contacts";
import { markOpenedFromList, takeListScrollToRestore } from "@/lib/return-to-list";
import { type GroupFilter, labelHref } from "@/lib/group-filter";
import { ADDED_PARAM, type PageSize, contactListHref } from "@/lib/search";
import { cn } from "@/lib/utils";

import { ContactAvatar } from "./avatar";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { ContactPagination } from "./contact-pagination";
import { markRowsMoved, rowsJustMoved } from "./row-shift-guard";
import { useDeleteContact } from "./use-delete-contact";

type Group = { letter: string; items: ContactListItem[] };

function groupLetter(name: string): string {
  const first = name.trim().charAt(0).toLocaleUpperCase("ru");
  if (first === "Ё") return "Е";
  return /\p{L}/u.test(first) ? first : "#";
}

function groupByLetter(items: ContactListItem[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    const letter = groupLetter(item.name);
    const last = groups.at(-1);
    if (last?.letter === letter) {
      last.items.push(item);
    } else {
      groups.push({ letter, items: [item] });
    }
  }
  return groups;
}

const NO_IDS: ReadonlySet<string> = new Set();

// Focus leaves a row that is about to disappear for the next row, or the previous one
function rowNeighbour(list: HTMLElement | null, contactId: string): HTMLElement | null {
  if (!list) return null;
  const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-contact-row]"));
  const index = rows.findIndex((row) => row.dataset.contactRow === contactId);
  const neighbour = rows[index + 1] ?? rows[index - 1];
  return neighbour?.querySelector<HTMLElement>("a") ?? list;
}

// One page of the list; the server has already searched, sorted and cut it
export function ContactBrowser({
  contacts,
  total,
  query,
  filter,
  page,
  pageCount,
  pageSize,
}: {
  contacts: ContactListItem[];
  total: number;
  query: string;
  filter: GroupFilter;
  page: number;
  pageCount: number;
  pageSize: PageSize;
}) {
  const searchParams = useSearchParams();
  const isSearching = query.trim() !== "";

  // A contact was just added: the server opened the page with it, point at it in the list
  const addedId = searchParams.get(ADDED_PARAM);
  const [handledAddedId, setHandledAddedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  if (addedId && addedId !== handledAddedId && contacts.some((c) => c.id === addedId)) {
    setHandledAddedId(addedId);
    setHighlightedId(addedId);
  }

  useEffect(() => {
    if (!highlightedId) return;
    document
      .getElementById(`contact-${highlightedId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    // Keep the page in the address instead of the added contact: reload and "back" return here
    window.history.replaceState(null, "", contactListHref({ page, size: pageSize }));
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedId, page, pageSize]);

  // A deleted contact disappears at once; the fresh list from the server replaces this
  const listRef = useRef<HTMLDivElement>(null);
  const [hiddenIds, hideContact] = useOptimistic(NO_IDS, (ids, id: string) => new Set(ids).add(id));
  const { deleteWithUndo } = useDeleteContact();
  const visibleContacts = useMemo(() => contacts.filter((c) => !hiddenIds.has(c.id)), [contacts, hiddenIds]);

  // Back here after deleting a contact on its card
  useLayoutEffect(() => {
    const y = takeListScrollToRestore();
    if (y !== null) window.scrollTo(0, y);
  }, []);

  const groups = useMemo(
    () => (isSearching ? null : groupByLetter(visibleContacts)),
    [isSearching, visibleContacts],
  );
  // A group label in a row leads to the same list with this group added to the filter
  const labels = { query, filter, size: pageSize };

  // The contact stays after closing, so the dialog doesn't lose the name while it fades out
  const [toDelete, setToDelete] = useState<ContactListItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const focusAfterDelete = useRef<HTMLElement | null>(null);

  function handleDelete(contact: ContactListItem) {
    if (rowsJustMoved()) return;
    setToDelete(contact);
    setConfirmOpen(true);
  }

  function handleConfirmDelete() {
    if (!toDelete) return;
    const contact = toDelete;
    setConfirmOpen(false);
    focusAfterDelete.current = rowNeighbour(listRef.current, contact.id);
    deleteWithUndo(contact, {
      onStart: () => {
        markRowsMoved();
        hideContact(contact.id);
      },
    });
  }

  // After a delete focus goes to the neighbouring row, after "cancel" back to the trash button
  function finalFocus() {
    const target = focusAfterDelete.current;
    focusAfterDelete.current = null;
    return target ?? true;
  }

  if (total === 0) {
    return (
      <EmptyState
        title="Здесь пока никого нет"
        hint="Добавьте первого человека кнопкой «Добавить контакт» вверху."
      />
    );
  }

  if (contacts.length === 0 && filter.mode !== "all") {
    return (
      <EmptyState
        title="По выбранным группам никого нет"
        hint="Показываем только тех, кто входит во все выбранные группы сразу. Попробуйте снять часть групп."
      />
    );
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        title={`Никого не нашли по запросу «${query.trim()}»`}
        hint="Поиск идёт по имени. Проверьте написание или попробуйте часть имени."
      />
    );
  }

  return (
    <div>
      <div ref={listRef} tabIndex={-1} className="overflow-clip bg-card outline-none">
        {groups ? (
          groups.map((group) => (
            <section key={group.letter} aria-label={`Буква ${group.letter}`}>
              <h2 className="sticky top-23 z-[1] border-y bg-card px-4 py-2 text-label text-primary-strong uppercase first:border-t-0 lg:px-5 lg:text-label-lg">
                {group.letter}
              </h2>
              <ContactRows items={group.items} highlightedId={highlightedId} onDelete={handleDelete} labels={labels} />
            </section>
          ))
        ) : (
          <ContactRows items={visibleContacts} highlightedId={highlightedId} onDelete={handleDelete} labels={labels} />
        )}
      </div>
      <ContactPagination query={query} filter={filter} page={page} pageCount={pageCount} pageSize={pageSize} />
      <ConfirmDeleteDialog
        name={toDelete?.name ?? ""}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirmDelete}
        finalFocus={finalFocus}
      />
    </div>
  );
}

type RowLabels = { query: string; filter: GroupFilter; size: PageSize };

function ContactRows({
  items,
  highlightedId,
  onDelete,
  labels,
}: {
  items: ContactListItem[];
  highlightedId: string | null;
  onDelete: (contact: ContactListItem) => void;
  labels: RowLabels;
}) {
  return (
    <ul className="divide-y">
      {items.map((contact) => {
        const details = [contact.about, contact.howWeMet].filter(Boolean).join(" · ");
        return (
          <li
            key={contact.id}
            id={`contact-${contact.id}`}
            data-contact-row={contact.id}
            className={cn(
              "group/row relative flex scroll-mt-32 items-start transition-colors duration-700 hover:bg-muted/60 has-[a:focus-visible]:bg-muted",
              contact.id === highlightedId && "bg-secondary hover:bg-secondary",
            )}
          >
            <Link
              href={`/contacts/${contact.id}`}
              onClick={(event) => {
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey) markOpenedFromList();
              }}
              className={cn(
                "flex min-w-0 flex-1 items-start gap-3 py-3 pr-2 pl-4 outline-none lg:gap-4 lg:pl-5",
                // Room for the row of group labels under the name
                contact.groups.length > 0 && "pb-9.5",
              )}
            >
              <ContactAvatar name={contact.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{contact.name}</div>
                {details && <div className="truncate text-sm font-light text-muted-foreground">{details}</div>}
              </div>
              {contact.phone && (
                <div className="hidden shrink-0 pt-2.5 text-sm text-muted-foreground tabular-nums sm:block">
                  {contact.phone}
                </div>
              )}
            </Link>
            {/* Next to the link, not inside it; with a mouse it shows on hover or keyboard focus */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Удалить контакт ${contact.name}`}
              onClick={() => onDelete(contact)}
              className="mt-3 mr-2 text-muted-foreground transition-opacity hover:bg-destructive/10 hover:text-destructive pointer-fine:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 lg:mr-3"
            >
              <Trash2Icon aria-hidden />
            </Button>
            {contact.groups.length > 0 && (
              // Over the empty strip under the name; a label that does not fit is cut off at the edge.
              // The strip lets clicks through, so the empty part of it still opens the card
              <div className="pointer-events-none absolute right-4 bottom-2 left-[65px] flex h-7.5 items-center overflow-hidden [mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)] lg:right-5 lg:left-[73px]">
                {contact.groups.map((group) => (
                  <Link
                    key={group.id}
                    href={labelHref(labels, labels.filter, group.id)}
                    scroll={false}
                    className="pointer-events-auto inline-flex h-7.5 shrink-0 items-center border-[3px] border-transparent bg-secondary bg-clip-padding px-2 text-xs font-medium whitespace-nowrap text-secondary-foreground transition-colors outline-none hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)] focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {group.name}
                  </Link>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 bg-card px-6 py-12 text-center">
      <div className="mb-2 grid size-12 place-items-center bg-secondary text-primary-strong">
        <UsersIcon aria-hidden className="size-6" />
      </div>
      <p className="text-title">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
