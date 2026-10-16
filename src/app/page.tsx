import { Suspense } from "react";
import { connection } from "next/server";

import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import { ContactBrowser } from "@/components/contacts/contact-browser";
import { Skeleton } from "@/components/ui/skeleton";
import { listContacts } from "@/lib/contacts";

export default function HomePage() {
  return (
    <>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 lg:mb-8">
        <h1 className="text-page-title lg:text-page-title-lg">Контакты</h1>
        <AddContactDialog />
      </div>
      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList />
      </Suspense>
    </>
  );
}

async function ContactList() {
  // Always read fresh data from the database at request time
  await connection();
  const contacts = await listContacts();
  return <ContactBrowser contacts={contacts} />;
}

function ContactListSkeleton() {
  return (
    <div aria-busy aria-label="Загружаю контакты">
      <div className="pt-1 pb-3">
        <Skeleton className="h-12 w-full bg-card" />
        <Skeleton className="mt-2 h-5 w-32" />
      </div>
      <div className="divide-y bg-card">
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
    </div>
  );
}
