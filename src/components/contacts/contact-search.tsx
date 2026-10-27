"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { currentGroupFilter } from "@/lib/group-filter";
import { QUERY_PARAM, contactListHref, currentPageSize } from "@/lib/search";
import { cn } from "@/lib/utils";

// Search runs on the server: wait for a pause in typing instead of sending every keystroke
const SEARCH_DELAY_MS = 250;

export function ContactSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get(QUERY_PARAM) ?? "";

  const [query, setQuery] = useState(urlQuery);
  // The query of the last search sent from here, and the address query of the last render
  const [requestedQuery, setRequestedQuery] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The address changed for another reason (logo link, a contact was added): show its query
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    if (urlQuery !== requestedQuery && !isPending) {
      setRequestedQuery(urlQuery);
      setQuery(urlQuery);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(value: string) {
    clearTimeout(timer.current);
    const next = value.trim() ? value : "";
    if (next === requestedQuery) return;
    setRequestedQuery(next);
    // A new query starts from the first page and keeps the page size and the filter by groups
    const href = contactListHref({ query: next, size: currentPageSize(), filter: currentGroupFilter() });
    startTransition(() => router.replace(href, { scroll: false }));
  }

  function handleQueryChange(value: string, { immediately = false } = {}) {
    setQuery(value);
    clearTimeout(timer.current);
    if (immediately) search(value);
    else timer.current = setTimeout(() => search(value), SEARCH_DELAY_MS);
  }

  const Icon = isPending ? LoaderCircleIcon : SearchIcon;

  return (
    <div className="relative">
      <Icon
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-primary-strong",
          isPending && "animate-spin",
        )}
      />
      <Input
        type="search"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") handleQueryChange("", { immediately: true });
          if (event.key === "Enter") search(query);
        }}
        placeholder="Найти по имени"
        aria-label="Найти контакт по имени"
        aria-busy={isPending}
        className="h-12 border-transparent pl-12 text-base md:text-base"
      />
    </div>
  );
}
