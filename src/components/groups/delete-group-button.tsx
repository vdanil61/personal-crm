"use client";

import { useState } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ConfirmDeleteGroupDialog } from "./confirm-delete-group-dialog";
import { useDeleteGroup } from "./use-delete-group";

export function DeleteGroupButton({ group }: { group: { id: string; name: string; peopleCount: number } }) {
  const { deleteWithUndo, pending } = useDeleteGroup();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirm() {
    setConfirmOpen(false);
    deleteWithUndo(group);
  }

  return (
    <>
      <Button
        variant="destructive"
        aria-label={`Удалить группу ${group.name}`}
        disabled={pending}
        onClick={() => setConfirmOpen(true)}
        className="max-sm:size-11 max-sm:px-0"
      >
        <Trash2Icon data-icon="inline-start" />
        {/* Icon-only on phones, like "rename" */}
        <span className="max-sm:hidden">{pending ? "Удаляю…" : "Удалить"}</span>
      </Button>
      <ConfirmDeleteGroupDialog
        name={group.name}
        peopleCount={group.peopleCount}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={handleConfirm}
      />
    </>
  );
}
