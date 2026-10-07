"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { consumeOpenedFromList } from "@/lib/return-to-list";

export function BackToList() {
  const router = useRouter();

  return (
    <Link
      href="/"
      onClick={(event) => {
        // Going back keeps the search query and scroll position of the list
        if (consumeOpenedFromList() && window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      Все контакты
    </Link>
  );
}
