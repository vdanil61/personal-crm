"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { GroupFilter } from "@/lib/group-filter";
import { type PageSize, contactListHref } from "@/lib/search";
import { cn } from "@/lib/utils";

const MAX_PAGE_ITEMS = 7;

// The first and the last page, the current one with its neighbours, gaps between:
// 1 … 4 5 6 … 21. Near an end the run grows, so the bar keeps its width: 1 2 3 4 5 … 21
function pageItems(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= MAX_PAGE_ITEMS) return Array.from({ length: pageCount }, (_, index) => index + 1);

  let start = page - 1;
  let end = page + 1;
  if (page <= 4) [start, end] = [2, 5];
  if (page >= pageCount - 3) [start, end] = [pageCount - 4, pageCount - 1];

  const items: (number | "gap")[] = [1];
  if (start > 2) items.push("gap");
  for (let item = start; item <= end; item++) items.push(item);
  if (end < pageCount - 1) items.push("gap");
  items.push(pageCount);
  return items;
}

export function ContactPagination({
  query,
  filter,
  page,
  pageCount,
  pageSize,
}: {
  query: string;
  filter: GroupFilter;
  page: number;
  pageCount: number;
  pageSize: PageSize;
}) {
  if (pageCount <= 1) return null;
  // Every link keeps the search query, the filter by groups and the page size
  const list = { query, filter, size: pageSize };

  return (
    <nav aria-label="Страницы списка" className="mt-4 flex items-center justify-between gap-2">
      <PageLink list={list} page={page - 1} disabled={page === 1}>
        <ChevronLeftIcon data-icon="inline-start" />
        Назад
      </PageLink>

      <ul className="hidden items-center gap-1 sm:flex">
        {pageItems(page, pageCount).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden className="w-6 text-center text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              {item === page ? (
                <span aria-current="page" className={cn(buttonVariants({ size: "icon" }), "tabular-nums")}>
                  {item}
                </span>
              ) : (
                <PageLink list={list} page={item} variant="ghost" size="icon" label={`Страница ${item}`}>
                  {item}
                </PageLink>
              )}
            </li>
          ),
        )}
      </ul>
      <p className="text-sm text-muted-foreground tabular-nums sm:hidden">
        Страница {page} из {pageCount}
      </p>

      <PageLink list={list} page={page + 1} disabled={page === pageCount}>
        Дальше
        <ChevronRightIcon data-icon="inline-end" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  list,
  page,
  disabled = false,
  variant = "outline",
  size = "default",
  label,
  children,
}: {
  list: { query: string; filter: GroupFilter; size: PageSize };
  page: number;
  disabled?: boolean;
  variant?: "outline" | "ghost";
  size?: "default" | "icon";
  // For screen readers, when the text alone is unclear (a bare page number)
  label?: string;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant, size }), "tabular-nums", variant === "ghost" && "hover:bg-card");

  if (disabled) {
    return (
      <a role="link" aria-disabled="true" className={cn(className, "pointer-events-none opacity-50")}>
        {children}
      </a>
    );
  }

  return (
    <Link
      href={contactListHref({ ...list, page })}
      aria-label={label}
      // A new page is read from its top. Scroll now, while the page loads,
      // instead of jumping after it appears
      scroll={false}
      onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) window.scrollTo({ top: 0 });
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
