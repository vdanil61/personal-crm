"use client";

import { UNDO_DURATION_MS } from "@/components/contacts/use-delete-contact";
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

// Asks before deleting; "undo" in the toast stays as a second chance
export function ConfirmDeleteGroupDialog({
  name,
  peopleCount,
  open,
  onOpenChange,
  onConfirm,
}: {
  name: string;
  peopleCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const undoSeconds = pluralize(UNDO_DURATION_MS / 1000, ["секунды", "секунд", "секунд"]);
  return (
    // A click outside does not close it: the second click of a double click would do just that
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      {/* "Cancel" comes first, so it gets the focus */}
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Удалить группу «{name}»?</DialogTitle>
          <DialogDescription>
            {peopleCount > 0
              ? `В ней ${pluralize(peopleCount, ["человек", "человека", "человек"])}. Они останутся в контактах, просто без этой группы.`
              : "В ней никого нет."}{" "}
            Отменить удаление можно в течение {undoSeconds}.
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
