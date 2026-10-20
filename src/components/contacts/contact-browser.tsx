"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { UsersIcon } from "lucide-react";

import type { ContactListItem } from "@/lib/contacts";
import { markOpenedFromList } from "@/lib/return-to-list";
import { ADDED_PARAM, type PageSize, contactListHref } from "@/lib/search";
import { cn } from "@/lib/utils";

import { ContactAvatar } from "./avatar";
import { ContactPagination } from "./contact-pagination";

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

// One page of the list; the server has already searched, sorted and cut it
export function ContactBrowser({
  contacts,
  total,
  query,
  page,
  pageCount,
  pageSize,
}: {
  contacts: ContactListItem[];
  total: number;
  query: string;
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

  const groups = useMemo(() => (isSearching ? null : groupByLetter(contacts)), [isSearching, contacts]);

  if (total === 0) {
    return (
      <EmptyState
        title="Здесь пока никого нет"
        hint="Добавьте первого человека кнопкой «Добавить контакт» вверху."
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
      <div className="overflow-clip bg-card">
        {groups ? (
          groups.map((group) => (
            <section key={group.letter} aria-label={`Буква ${group.letter}`}>
              <h2 className="sticky top-23 z-[1] border-y bg-card px-4 py-2 text-label text-primary-strong uppercase first:border-t-0 lg:px-5 lg:text-label-lg">
                {group.letter}
              </h2>
              <ContactRows items={group.items} highlightedId={highlightedId} />
            </section>
          ))
        ) : (
          <ContactRows items={contacts} highlightedId={highlightedId} />
        )}
      </div>
      <ContactPagination query={query} page={page} pageCount={pageCount} pageSize={pageSize} />
    </div>
  );
}

function ContactRows({ items, highlightedId }: { items: ContactListItem[]; highlightedId: string | null }) {
  return (
    <ul className="divide-y">
      {items.map((contact) => {
        const details = [contact.about, contact.howWeMet].filter(Boolean).join(" · ");
        return (
          <li key={contact.id} id={`contact-${contact.id}`} className="scroll-mt-32">
            <Link
              href={`/contacts/${contact.id}`}
              onClick={(event) => {
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey) markOpenedFromList();
              }}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors duration-700 outline-none hover:bg-muted/60 focus-visible:bg-muted lg:gap-4 lg:px-5",
                contact.id === highlightedId && "bg-secondary hover:bg-secondary",
              )}
            >
              <ContactAvatar name={contact.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{contact.name}</div>
                {details && <div className="truncate text-sm font-light text-muted-foreground">{details}</div>}
              </div>
              {contact.phone && (
                <div className="hidden shrink-0 text-sm text-muted-foreground tabular-nums sm:block">
                  {contact.phone}
                </div>
              )}
            </Link>
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
