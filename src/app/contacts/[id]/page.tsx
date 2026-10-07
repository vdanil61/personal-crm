import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MailIcon, PhoneIcon, UsersIcon } from "lucide-react";

import { ContactAvatar } from "@/components/contacts/avatar";
import { BackToList } from "@/components/contacts/back-to-list";
import { EditContactDialog } from "@/components/contacts/edit-contact-dialog";
import { NoteForm } from "@/components/contacts/note-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getContact, listNotes } from "@/lib/contacts";
import { formatDateTime, pluralize } from "@/lib/format";
import { idSchema } from "@/lib/validation";

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <>
      <BackToList />
      <Suspense fallback={<ContactSkeleton />}>
        <ContactDetails params={params} />
      </Suspense>
    </>
  );
}

async function ContactDetails({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const [contact, notes] = await Promise.all([getContact(id), listNotes(id)]);
  if (!contact) notFound();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-background p-5">
        <div className="flex items-start gap-4">
          <ContactAvatar id={contact.id} name={contact.name} className="size-12 text-base sm:size-14 sm:text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{contact.name}</h1>
            {contact.about && <p className="mt-1 text-muted-foreground">{contact.about}</p>}
          </div>
          <EditContactDialog
            contactId={contact.id}
            values={{
              name: contact.name,
              about: contact.about ?? "",
              howWeMet: contact.howWeMet ?? "",
              phone: contact.phone ?? "",
              email: contact.email ?? "",
            }}
          />
        </div>

        <dl className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2">
          <InfoItem icon={<UsersIcon />} label="Откуда знакомы" className="sm:col-span-2">
            {contact.howWeMet}
          </InfoItem>
          <InfoItem icon={<PhoneIcon />} label="Телефон">
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">
                {contact.phone}
              </a>
            )}
          </InfoItem>
          <InfoItem icon={<MailIcon />} label="Почта">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="break-all hover:underline">
                {contact.email}
              </a>
            )}
          </InfoItem>
        </dl>
      </section>

      <section className="rounded-xl border bg-background p-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Заметки</h2>
          {notes.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {pluralize(notes.length, ["заметка", "заметки", "заметок"])}
            </span>
          )}
        </div>

        <NoteForm contactId={contact.id} />

        {notes.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Заметок пока нет. Запишите, о чём поговорили и о чём договорились.
          </p>
        ) : (
          <ol className="mt-6 space-y-4">
            {notes.map((note) => (
              <li key={note.id} className="border-l-2 border-primary/20 pl-4">
                <time dateTime={note.createdAt.toISOString()} className="text-xs text-muted-foreground">
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1 whitespace-pre-wrap break-words">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">
        {children || <span className="text-muted-foreground">не указано</span>}
      </dd>
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Загружаю контакт">
      <div className="rounded-xl border bg-background p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2">
          <Skeleton className="h-10 sm:col-span-2" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <div className="rounded-xl border bg-background p-5">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    </div>
  );
}
