"use client";

import Link from "next/link";
import { TagIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { markOpenedFromList } from "@/lib/return-to-list";

// "Группы" next to the page title; "back" from there returns to the same list
export function GroupsLink() {
  return (
    <Link
      href="/groups"
      onClick={(event) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey) markOpenedFromList();
      }}
      className={buttonVariants({ variant: "outline", size: "lg", className: "shrink-0" })}
    >
      <TagIcon data-icon="inline-start" aria-hidden />
      Группы
    </Link>
  );
}
