"use client";

import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { leaveForList, markOpenedFromList } from "@/lib/return-to-list";

import { useDeleteContact } from "./use-delete-contact";

export function DeleteContactButton({ contact }: { contact: { id: string; name: string } }) {
  const router = useRouter();
  const { deleteWithUndo, pending } = useDeleteContact();

  return (
    <Button
      variant="destructive"
      aria-label={`Удалить контакт ${contact.name}`}
      disabled={pending}
      onClick={() =>
        deleteWithUndo(contact, {
          leave: () => leaveForList(router),
          // Undo brings you back to the card, and "all contacts" then to the same list
          onUndone: () => {
            if (window.location.pathname === "/") markOpenedFromList();
            router.push(`/contacts/${contact.id}`);
          },
        })
      }
    >
      <Trash2Icon data-icon="inline-start" />
      {/* Icon-only on phones, like "edit" */}
      <span className="max-sm:hidden">{pending ? "Удаляю…" : "Удалить"}</span>
    </Button>
  );
}
