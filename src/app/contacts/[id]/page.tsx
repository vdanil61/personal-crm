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
import { cn } from "@/lib/utils";
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
    <div className="space-y-3">
      <section className="bg-card p-5 lg:p-7">
        <div className="flex items-start gap-4">
          <ContactAvatar name={contact.name} className="size-12 text-base sm:size-14 sm:text-lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-card-name break-words lg:text-card-name-lg">{contact.name}</h1>
            {contact.about && <p className="mt-1 text-card-meta text-muted-foreground">{contact.about}</p>}
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

        <dl className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2 lg:mt-7 lg:pt-7">
          <InfoItem icon={<UsersIcon />} label="Откуда знакомы" className="sm:col-span-2">
            {contact.howWeMet}
          </InfoItem>
          <InfoItem icon={<PhoneIcon />} label="Телефон">
            {contact.phone && (
              <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="text-primary-strong hover:underline">
                {contact.phone}
              </a>
            )}
          </InfoItem>
          <InfoItem icon={<MailIcon />} label="Почта">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="break-all text-primary-strong hover:underline">
                {contact.email}
              </a>
            )}
          </InfoItem>
        </dl>
      </section>

      <section className="bg-card p-5 lg:p-7">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-label text-primary-strong uppercase lg:text-label-lg">Заметки</h2>
          {notes.length > 0 && (
            <span className="text-sm font-light text-muted-foreground">
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
          <ol className="mt-6">
            {/* The newest note is marked with the accent line, as on the landing */}
            {notes.map((note, index) => (
              <li
                key={note.id}
                className={cn(
                  "border-l-2 py-3 pl-4 lg:pl-4.5",
                  index === 0 ? "border-primary" : "border-input text-soft-foreground",
                )}
              >
                <time dateTime={note.createdAt.toISOString()} className="text-note-date text-muted-foreground">
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1 text-note whitespace-pre-wrap break-words">{note.body}</p>
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
      <dt className="flex items-center gap-1.5 text-label text-primary-strong uppercase lg:text-label-lg [&_svg]:size-3.5">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap break-words">
        {children || <span className="font-light text-muted-foreground">не указано</span>}
      </dd>
    </div>
  );
}

function ContactSkeleton() {
  return (
    <div className="space-y-3" aria-busy aria-label="Загружаю контакт">
      <div className="bg-card p-5 lg:p-7">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 sm:size-14" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2 lg:mt-7 lg:pt-7">
          <Skeleton className="h-10 sm:col-span-2" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      </div>
      <div className="bg-card p-5 lg:p-7">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    </div>
  );
}
