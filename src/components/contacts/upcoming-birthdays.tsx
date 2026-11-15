"use client";

import Link from "next/link";

import { markOpenedFromList } from "@/lib/return-to-list";

import { ContactAvatar } from "./avatar";

export type UpcomingBirthdayItem = { id: string; name: string; caption: string };

export function UpcomingBirthdays({ contacts }: { contacts: UpcomingBirthdayItem[] }) {
  if (contacts.length === 0) return null;

  return (
    <section aria-labelledby="upcoming-birthdays-title" className="mb-6 bg-card">
      <h2
        id="upcoming-birthdays-title"
        className="px-4 pt-3.5 pb-2.5 text-label text-primary-strong uppercase lg:px-5 lg:pt-4 lg:pb-3 lg:text-label-lg"
      >
        Скоро день рождения
      </h2>
      <ul>
        {contacts.map((contact) => (
          <li key={contact.id} className="border-t hover:bg-muted/60 has-[a:focus-visible]:bg-muted">
            <Link
              href={`/contacts/${contact.id}`}
              onClick={(event) => {
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey) markOpenedFromList();
              }}
              className="flex min-w-0 items-center gap-3 px-4 py-3 outline-none lg:gap-4 lg:px-5"
            >
              <ContactAvatar name={contact.name} />
              <div className="min-w-0 flex-1">
                <div className="font-medium break-words">{contact.name}</div>
                <div className="text-sm leading-snug font-light text-muted-foreground">{contact.caption}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
