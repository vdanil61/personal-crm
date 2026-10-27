"use client";

import { startTransition, useTransition } from "react";
import { toast } from "sonner";

import { deleteContact, restoreContact } from "@/app/actions";
import type { DeleteContactResult, RestoreContactResult } from "@/lib/form-state";
import type { ContactSnapshot } from "@/lib/validation";

export const UNDO_DURATION_MS = 10_000;

// Contacts being deleted right now: a second click must not start another delete
const deleting = new Set<string>();

type DeleteOptions = {
  // Runs at once inside the transition, e.g. to hide the row
  onStart?: () => void;
  // Leaves the page of the deleted contact; the transition waits for it
  leave?: () => Promise<void>;
  // Runs after "undo" has put the contact back
  onUndone?: () => void;
};

// Deletes a contact at once and offers "undo" in a toast for a few seconds
export function useDeleteContact() {
  const [pending, startDeleteTransition] = useTransition();

  function deleteWithUndo(contact: { id: string; name: string }, options: DeleteOptions = {}) {
    if (deleting.has(contact.id)) return;
    deleting.add(contact.id);

    startDeleteTransition(async () => {
      try {
        options.onStart?.();
        let result: DeleteContactResult;
        try {
          result = await deleteContact(contact.id);
        } catch {
          // No connection: without the catch the error page would replace this one
          toast.error("Не удалось удалить: нет связи с сервером. Попробуйте ещё раз.");
          return;
        }
        if (result.status === "error") {
          toast.error(result.message);
          return;
        }
        // Still inside the transition, so the page changes together with the fresh data
        await options.leave?.();
        showUndoToast(result.snapshot, options.onUndone);
      } finally {
        deleting.delete(contact.id);
      }
    });
  }

  return { deleteWithUndo, pending };
}

function showUndoToast(snapshot: ContactSnapshot, onUndone?: () => void) {
  toast.success(`Контакт «${snapshot.contact.name}» удалён`, {
    duration: UNDO_DURATION_MS,
    action: { label: "Отменить", onClick: () => undoDelete(snapshot, onUndone) },
  });
}

// Not tied to a component: the page the contact was deleted on is usually gone by now
function undoDelete(snapshot: ContactSnapshot, onUndone?: () => void) {
  startTransition(async () => {
    let result: RestoreContactResult;
    try {
      result = await restoreContact(snapshot);
    } catch {
      result = { status: "error", message: "Не удалось вернуть контакт: нет связи с сервером. Попробуйте ещё раз." };
    }
    if (result.status === "error") {
      // The deleted contact exists only in this tab now, so the message stays until dismissed
      toast.error(result.message, {
        duration: Infinity,
        closeButton: true,
        action: { label: "Повторить", onClick: () => undoDelete(snapshot, onUndone) },
      });
      return;
    }
    startTransition(() => onUndone?.());
    toast.success(`Контакт «${snapshot.contact.name}» восстановлен`);
  });
}
