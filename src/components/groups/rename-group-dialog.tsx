"use client";

import { useCallback, useState } from "react";
import { PencilIcon } from "lucide-react";

import { renameGroup } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { GroupNameForm } from "./group-name-form";

export function RenameGroupDialog({ group }: { group: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const action = renameGroup.bind(null, group.id);
  const handleSuccess = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Icon-only on phones, so the name has room */}
      <DialogTrigger
        render={<Button variant="outline" aria-label={`Переименовать группу ${group.name}`} className="max-sm:size-11 max-sm:px-0" />}
      >
        <PencilIcon data-icon="inline-start" />
        <span className="max-sm:hidden">Переименовать</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Переименовать группу</DialogTitle>
          <DialogDescription>Люди в группе останутся прежними.</DialogDescription>
        </DialogHeader>
        <GroupNameForm
          action={action}
          initialName={group.name}
          submitLabel="Сохранить"
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
