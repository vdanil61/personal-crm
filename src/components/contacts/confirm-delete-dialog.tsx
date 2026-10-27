"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pluralize } from "@/lib/format";

import { UNDO_DURATION_MS } from "./use-delete-contact";

// Asks before deleting; "undo" in the toast stays as a second chance
export function ConfirmDeleteDialog({
  name,
  open,
  onOpenChange,
  onConfirm,
  finalFocus,
}: {
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  // Where focus goes when the dialog closes; by default back to the button that opened it
  finalFocus?: () => HTMLElement | boolean;
}) {
  return (
    // A click outside does not close it: the second click of a double click would do just that
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {/* "Cancel" comes first, so it gets the focus */}
      <DialogContent showCloseButton={false} finalFocus={finalFocus}>
        <DialogHeader>
          <DialogTitle>Вы точно хотите удалить контакт?</DialogTitle>
          <DialogDescription>
            «{name}» удалится вместе с заметками. Отменить удаление можно в течение{" "}
            {pluralize(UNDO_DURATION_MS / 1000, ["секунды", "секунд", "секунд"])}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
          <Button variant="destructive" onClick={onConfirm}>
            Удалить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
