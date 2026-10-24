"use client";

import { useLayoutEffect, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { toast } from "sonner";

import { markContacted } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { MarkContactedResult } from "@/lib/form-state";
import { pluralize } from "@/lib/format";
import { markOpenedFromList } from "@/lib/return-to-list";

import { ContactAvatar } from "./avatar";

export type KeepInTouchItem = {
  id: string;
  name: string;
  // "раз в месяц · связались 22 августа", formatted on the server
  caption: string;
};

// Shown before "Показать всех"
const COLLAPSED_COUNT = 5;

const NO_IDS: ReadonlySet<string> = new Set();

// Overdue contacts, the most overdue first; the server has already sorted them
export function KeepInTouch({ contacts }: { contacts: KeepInTouchItem[] }) {
  const [expanded, setExpanded] = useState(false);
  // A marked contact disappears at once; the fresh list from the server replaces this
  const [hiddenIds, hideContact] = useOptimistic(NO_IDS, (ids, id: string) => new Set(ids).add(id));
  const [, startMarkTransition] = useTransition();
  const visible = useMemo(() => contacts.filter((c) => !hiddenIds.has(c.id)), [contacts, hiddenIds]);
  const shown = expanded ? visible : visible.slice(0, COLLAPSED_COUNT);

  // Keyboard focus on the button of a hidden row moves to the button of the neighbouring row
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterHide = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = focusAfterHide.current;
    if (!id) return;
    focusAfterHide.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-mark-contact="${id}"]`)?.focus();
  });

  function handleMark(contact: KeepInTouchItem) {
    const row = listRef.current?.querySelector(`[data-overdue-row="${contact.id}"]`);
    if (row?.contains(document.activeElement)) {
      const index = shown.findIndex((c) => c.id === contact.id);
      // When collapsed, the sixth contact moves up into the first five
      const remaining = visible.filter((c) => c.id !== contact.id);
      const next = expanded ? remaining : remaining.slice(0, COLLAPSED_COUNT);
      focusAfterHide.current = (next[index] ?? next[index - 1])?.id ?? null;
    }

    startMarkTransition(async () => {
      hideContact(contact.id);
      let result: MarkContactedResult;
      try {
        result = await markContacted(contact.id);
      } catch {
        // No connection: without the catch the error page would replace this one
        result = { status: "error", message: "Не удалось отметить: нет связи с сервером. Попробуйте ещё раз." };
      }
      // On error the row comes back when the transition ends
      if (result.status === "error") toast.error(result.message);
      else toast.success(`Отмечено: ${contact.name}`);
    });
  }

  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="keep-in-touch-title" className="mb-6 bg-card">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5 lg:px-5 lg:pt-4 lg:pb-3">
        <h2 id="keep-in-touch-title" className="text-label text-primary-strong uppercase lg:text-label-lg">
          Пора связаться
        </h2>
        <span
          aria-label={pluralize(visible.length, ["человек", "человека", "человек"])}
          className="inline-flex h-6 min-w-7 items-center justify-center bg-secondary px-2 text-label-lg font-medium tracking-normal text-secondary-foreground tabular-nums"
        >
          {visible.length}
        </span>
      </div>
      <ul ref={listRef}>
        {shown.map((contact) => (
          <li
            key={contact.id}
            data-overdue-row={contact.id}
            className="flex items-center border-t hover:bg-muted/60 has-[a:focus-visible]:bg-muted"
          >
            <Link
              href={`/contacts/${contact.id}`}
              onClick={(event) => {
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey) markOpenedFromList();
              }}
              className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-4 outline-none sm:pr-4 lg:gap-4 lg:pl-5"
            >
              <ContactAvatar name={contact.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{contact.name}</div>
                {/* Wraps on phones instead of hiding the date */}
                <div className="text-sm leading-snug font-light text-muted-foreground sm:truncate sm:leading-normal">
                  {contact.caption}
                </div>
              </div>
            </Link>
            {/* Next to the link, not inside it, so opening the card can't mark the contact */}
            <Button
              type="button"
              variant="outline"
              aria-label={`Связался: ${contact.name}`}
              data-mark-contact={contact.id}
              onClick={() => handleMark(contact)}
              className="mr-3 size-11 border-input bg-card text-primary-strong sm:h-10 sm:w-auto sm:gap-1.5 sm:pr-3.5 sm:pl-2.5 sm:text-foreground lg:mr-5"
            >
              <CheckIcon aria-hidden className="size-4.5 text-primary-strong sm:size-4" />
              <span className="max-sm:hidden">Связался</span>
            </Button>
          </li>
        ))}
      </ul>
      {visible.length > COLLAPSED_COUNT && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="flex h-12 w-full items-center justify-center gap-1.5 border-t text-sm font-medium text-primary-strong outline-none hover:bg-muted/60 focus-visible:bg-muted"
        >
          {expanded ? "Свернуть" : `Показать всех (${visible.length})`}
          {expanded ? <ChevronUpIcon aria-hidden className="size-4" /> : <ChevronDownIcon aria-hidden className="size-4" />}
        </button>
      )}
    </section>
  );
}
