"use client";

import { startTransition, useTransition } from "react";
import { toast } from "sonner";

import { deleteGroup, restoreGroup } from "@/app/actions";
import { UNDO_DURATION_MS } from "@/components/contacts/use-delete-contact";
import type { DeleteGroupResult, RestoreGroupResult } from "@/lib/form-state";
import type { GroupSnapshot } from "@/lib/validation";

// Groups being deleted right now: a second click must not start another delete
const deleting = new Set<string>();

// Deletes a group and offers "undo" in a toast for a few seconds
export function useDeleteGroup() {
  const [pending, startDeleteTransition] = useTransition();

  function deleteWithUndo(group: { id: string; name: string }) {
    if (deleting.has(group.id)) return;
    deleting.add(group.id);

    startDeleteTransition(async () => {
      try {
        let result: DeleteGroupResult;
        try {
          result = await deleteGroup(group.id);
        } catch {
          // No connection: without the catch the error page would replace this one
          toast.error("Не удалось удалить: нет связи с сервером. Попробуйте ещё раз.");
          return;
        }
        if (result.status === "error") {
          toast.error(result.message);
          return;
        }
        showUndoToast(result.snapshot);
      } finally {
        deleting.delete(group.id);
      }
    });
  }

  return { deleteWithUndo, pending };
}

function showUndoToast(snapshot: GroupSnapshot) {
  toast.success(`Группа «${snapshot.group.name}» удалена`, {
    duration: UNDO_DURATION_MS,
    action: { label: "Отменить", onClick: () => undoDelete(snapshot) },
  });
}

// Not tied to a component: the page the group was deleted on may be gone by now
function undoDelete(snapshot: GroupSnapshot) {
  startTransition(async () => {
    let result: RestoreGroupResult;
    try {
      result = await restoreGroup(snapshot);
    } catch {
      // The deleted group exists only in this tab now, so the message stays until dismissed
      toast.error("Не удалось вернуть группу: нет связи с сервером. Попробуйте ещё раз.", {
        duration: Infinity,
        closeButton: true,
        action: { label: "Повторить", onClick: () => undoDelete(snapshot) },
      });
      return;
    }
    if (result.status === "error") {
      // The server says why (e.g. the name is taken now), so trying again would not help
      toast.error(result.message, { duration: Infinity, closeButton: true });
    }
  });
}
