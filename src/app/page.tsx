import { Suspense, cache } from "react";

import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import { ContactBrowser } from "@/components/contacts/contact-browser";
import { ContactSearch } from "@/components/contacts/contact-search";
import { KeepInTouch as KeepInTouchBlock } from "@/components/contacts/keep-in-touch";
import { PageSizePicker } from "@/components/contacts/page-size-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { frequencyLabels } from "@/lib/contact-frequency";
import { findContactPage, listContactsPage, listOverdueContacts } from "@/lib/contacts";
import { formatCount, formatDayMonth, pluralWord, pluralize } from "@/lib/format";
import { ADDED_PARAM, PAGE_PARAM, type PageSize, QUERY_PARAM, SIZE_PARAM, parsePageSize } from "@/lib/search";
import { idSchema } from "@/lib/validation";

const CONTACT_WORDS: [string, string, string] = ["контакт", "контакта", "контактов"];
// After "из": "1 из 21 контакта", "1 из 1 000 контактов"
const OUT_OF_CONTACT_WORDS: [string, string, string] = ["контакта", "контактов", "контактов"];

type SearchParams = PageProps<"/">["searchParams"];

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:mb-8">
        <h1 className="text-page-title lg:text-page-title-lg">Контакты</h1>
        <AddContactDialog />
      </div>
      {/* Nothing while loading: the block is often absent, a skeleton would flash */}
      <Suspense>
        <KeepInTouch searchParams={searchParams} />
      </Suspense>
      {/* The search field stays outside the list's Suspense: loading a new page
          of results must not replace it with a skeleton while someone is typing */}
      <div className="sticky top-0 z-10 -mx-5 bg-page px-5 pt-1 pb-3">
        <Suspense fallback={<Skeleton className="h-12 w-full bg-card" />}>
          <ContactSearch />
        </Suspense>
        <Suspense fallback={<Skeleton className="mt-2 h-5 w-32" />}>
          <ContactCount searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function readListParams(searchParams: SearchParams) {
  const params = await searchParams;
  const page = Number(firstValue(params[PAGE_PARAM]));
  const addedId = firstValue(params[ADDED_PARAM]);
  return {
    query: firstValue(params[QUERY_PARAM]),
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    size: parsePageSize(firstValue(params[SIZE_PARAM])),
    addedId: idSchema.safeParse(addedId).success ? addedId : null,
  };
}

// The count and the list render separately but show the same data:
// cache() makes them share one set of database queries per request
const loadContactList = cache(async (query: string, page: number, size: PageSize, addedId: string | null) => {
  // A contact was just added: open the full list on the page with it, the list highlights it
  if (addedId) {
    const addedPage = await findContactPage(addedId, size);
    if (addedPage) return listContactsPage("", addedPage, size);
  }
  return listContactsPage(query, page, size);
});

// Hidden while searching: the found contacts matter then
async function KeepInTouch({ searchParams }: { searchParams: SearchParams }) {
  const { query } = await readListParams(searchParams);
  if (query.trim()) return null;

  const overdue = await listOverdueContacts();
  if (overdue.length === 0) return null;

  const now = new Date();
  const items = overdue.map((contact) => {
    // No-break spaces keep the date on one line when the caption wraps on a phone
    const lastContact = contact.lastContactAt
      ? `связались ${formatDayMonth(contact.lastContactAt, now).replaceAll(" ", "\u00a0")}`
      : "ещё не связывались";
    return { id: contact.id, name: contact.name, caption: `${frequencyLabels[contact.frequency]} · ${lastContact}` };
  });
  return <KeepInTouchBlock contacts={items} />;
}

async function ContactCount({ searchParams }: { searchParams: SearchParams }) {
  const { query, page, size, addedId } = await readListParams(searchParams);
  const list = await loadContactList(query, page, size, addedId);
  return (
    <div className="mt-2 flex h-5 items-center justify-between gap-4 text-sm text-muted-foreground">
      <p aria-live="polite" className="min-w-0 truncate">
        {list.query.trim() ? (
          <>
            {`Найдено: ${formatCount(list.matched)} из ${formatCount(list.total)}`}
            {/* On a phone the line is shared with the page size picker: the word would wrap */}
            <span className="hidden sm:inline">{` ${pluralWord(list.total, OUT_OF_CONTACT_WORDS)}`}</span>
          </>
        ) : (
          pluralize(list.total, CONTACT_WORDS)
        )}
      </p>
      {list.matched > 0 && <PageSizePicker query={list.query} page={list.page} pageSize={list.pageSize} />}
    </div>
  );
}

async function ContactList({ searchParams }: { searchParams: SearchParams }) {
  const { query, page, size, addedId } = await readListParams(searchParams);
  const list = await loadContactList(query, page, size, addedId);
  return (
    <ContactBrowser
      contacts={list.items}
      total={list.total}
      query={list.query}
      page={list.page}
      pageCount={list.pageCount}
      pageSize={list.pageSize}
    />
  );
}

function ContactListSkeleton() {
  return (
    <div aria-busy aria-label="Загружаю контакты" className="divide-y bg-card">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3 lg:gap-4 lg:px-5">
          <Skeleton className="size-10" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
