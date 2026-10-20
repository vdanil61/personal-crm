"use client";

import Link from "next/link";

import { PAGE_SIZES, type PageSize, contactListHref } from "@/lib/search";
import { cn } from "@/lib/utils";

export function PageSizePicker({ query, page, pageSize }: { query: string; page: number; pageSize: PageSize }) {
  // The first contact on the screen stays on the screen: on page 3 of 50 that is the 101st,
  // which is on page 11 of 10
  const firstShown = (page - 1) * pageSize;

  return (
    <div role="group" aria-label="Сколько контактов показывать на странице" className="flex shrink-0 items-center gap-1">
      <span aria-hidden className="mr-1">
        <span className="hidden sm:inline">Показывать </span>по
      </span>
      {PAGE_SIZES.map((size) => (
        <Link
          key={size}
          href={contactListHref({ query, page: Math.floor(firstShown / size) + 1, size })}
          aria-label={`По ${size}`}
          aria-current={size === pageSize ? "true" : undefined}
          // The list gets shorter or longer: read it from the top, like a new page
          scroll={false}
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey) window.scrollTo({ top: 0 });
          }}
          className={cn(
            // The chip fits the line of text; its invisible margin makes it easier to tap
            "relative inline-flex h-5 min-w-7 items-center justify-center px-1 tabular-nums after:absolute after:-inset-x-0.5 after:-inset-y-2.5 hover:text-foreground",
            size === pageSize
              ? "pointer-events-none bg-primary text-primary-foreground"
              : "text-primary-strong hover:bg-card",
          )}
        >
          {size}
        </Link>
      ))}
    </div>
  );
}
