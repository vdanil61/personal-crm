"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import type { GroupOption } from "@/lib/form-state";
import {
  type GroupFilter,
  clearFilter,
  filterHref,
  selectedGroupIds,
  toggleGroup,
  toggleNoGroup,
} from "@/lib/group-filter";
import { QUERY_PARAM, SIZE_PARAM, parsePageSize } from "@/lib/search";
import { cn } from "@/lib/utils";

// "Все", the groups by the alphabet, "Без группы". The selection lives in the address of the page,
// so every button is a link: a click changes the address and the server makes the list again.
// On a wide screen the buttons wrap to the next line; on a phone they are one row to scroll sideways.
export function GroupFilterBar({ groups, filter }: { groups: GroupOption[]; filter: GroupFilter }) {
  const searchParams = useSearchParams();
  // A new filter keeps the search and the page size, and opens the first page
  const list = {
    query: searchParams.get(QUERY_PARAM) ?? "",
    size: parsePageSize(searchParams.get(SIZE_PARAM)),
  };
  const selectedIds = selectedGroupIds(filter);

  return (
    <nav
      aria-label="Фильтр по группам"
      className="mb-6 -mx-5 flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <FilterButton href={filterHref(list, clearFilter())} selected={filter.mode === "all"}>
        Все
      </FilterButton>
      {groups.map((group) => (
        <FilterButton
          key={group.id}
          href={filterHref(list, toggleGroup(filter, group.id))}
          selected={selectedIds.includes(group.id)}
        >
          {group.name}
        </FilterButton>
      ))}
      {/* The divider is for the phone, where the row does not wrap; on a wide screen it would be left alone
          at the end or at the start of a line */}
      <div className="flex shrink-0 items-center gap-2">
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-input sm:hidden" />
        <FilterButton href={filterHref(list, toggleNoGroup(filter))} selected={filter.mode === "none"}>
          Без группы
        </FilterButton>
      </div>
    </nav>
  );
}

function FilterButton({ href, selected, children }: { href: string; selected: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      // Read the new list from its top, like a new page; the filter stays where it is
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center border border-input bg-card px-4 text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 max-sm:h-11 max-sm:px-4.5",
        selected && "border-primary bg-primary text-primary-foreground hover:bg-primary-strong",
      )}
    >
      {children}
    </Link>
  );
}
