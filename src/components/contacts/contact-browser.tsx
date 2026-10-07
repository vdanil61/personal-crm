"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SearchIcon, UsersIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ContactListItem } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import { markOpenedFromList } from "@/lib/return-to-list";
import { cn } from "@/lib/utils";

import { ContactAvatar } from "./avatar";
import { ADDED_PARAM, QUERY_PARAM, matchesQuery, normalizeForSearch, toQueryWords } from "./search";

const CONTACT_WORDS: [string, string, string] = ["контакт", "контакта", "контактов"];
// After "из": "1 из 21 контакта", "1 из 1 000 контактов"
const OUT_OF_CONTACT_WORDS: [string, string, string] = ["контакта", "контактов", "контактов"];

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

function replaceUrlParams(update: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  update(url.searchParams);
  window.history.replaceState(null, "", url);
}

export function ContactBrowser({ contacts }: { contacts: ContactListItem[] }) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get(QUERY_PARAM) ?? "");
  const deferredQuery = useDeferredValue(query);

  // A contact was just added: clear the search and point at it in the list
  const addedId = searchParams.get(ADDED_PARAM);
  const [handledAddedId, setHandledAddedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  if (addedId && addedId !== handledAddedId && contacts.some((c) => c.id === addedId)) {
    setHandledAddedId(addedId);
    setHighlightedId(addedId);
    setQuery("");
  }

  useEffect(() => {
    if (!highlightedId) return;
    document
      .getElementById(`contact-${highlightedId}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
    replaceUrlParams((params) => params.delete(ADDED_PARAM));
    const timer = setTimeout(() => setHighlightedId(null), 4000);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  const searchable = useMemo(
    () => contacts.map((contact) => ({ contact, name: normalizeForSearch(contact.name) })),
    [contacts],
  );

  const queryWords = useMemo(() => toQueryWords(deferredQuery), [deferredQuery]);
  const isSearching = queryWords.length > 0;
  const results = useMemo(
    () =>
      isSearching
        ? searchable.filter(({ name }) => matchesQuery(name, queryWords)).map(({ contact }) => contact)
        : contacts,
    [contacts, searchable, queryWords, isSearching],
  );
  const groups = useMemo(() => (isSearching ? null : groupByLetter(results)), [isSearching, results]);

  function handleQueryChange(value: string) {
    setQuery(value);
    replaceUrlParams((params) => {
      if (value.trim()) params.set(QUERY_PARAM, value);
      else params.delete(QUERY_PARAM);
    });
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 bg-neutral-50/95 px-4 pt-1 pb-3 backdrop-blur">
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") handleQueryChange("");
            }}
            placeholder="Найти по имени"
            aria-label="Найти контакт по имени"
            className="h-10 bg-background pl-9 text-base md:text-base"
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {isSearching
            ? `Найдено: ${results.length} из ${pluralize(contacts.length, OUT_OF_CONTACT_WORDS)}`
            : pluralize(contacts.length, CONTACT_WORDS)}
        </p>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          title="Здесь пока никого нет"
          hint="Добавьте первого человека кнопкой «Добавить контакт» вверху."
        />
      ) : results.length === 0 ? (
        <EmptyState
          title={`Никого не нашли по запросу «${deferredQuery.trim()}»`}
          hint="Поиск идёт по имени. Проверьте написание или попробуйте часть имени."
        />
      ) : (
        <div className="overflow-clip rounded-xl border bg-background">
          {groups ? (
            groups.map((group) => (
              <section key={group.letter} aria-label={`Буква ${group.letter}`}>
                <h2 className="sticky top-[5.25rem] z-[1] border-y bg-muted px-4 py-1 text-xs font-semibold text-muted-foreground first:border-t-0">
                  {group.letter}
                </h2>
                <ContactRows items={group.items} highlightedId={highlightedId} />
              </section>
            ))
          ) : (
            <ContactRows items={results} highlightedId={highlightedId} />
          )}
        </div>
      )}
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
                "flex items-center gap-3 px-4 py-3 transition-colors duration-700 outline-none hover:bg-muted/60 focus-visible:bg-muted",
                contact.id === highlightedId && "bg-amber-100 hover:bg-amber-100",
              )}
            >
              <ContactAvatar id={contact.id} name={contact.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{contact.name}</div>
                {details && <div className="truncate text-sm text-muted-foreground">{details}</div>}
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
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-background px-6 py-12 text-center">
      <UsersIcon aria-hidden className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
