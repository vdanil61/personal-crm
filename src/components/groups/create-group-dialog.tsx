"use client";

import { useCallback, useState } from "react";
import { PlusIcon } from "lucide-react";

import { createGroup } from "@/app/actions";
import { CornerMarks } from "@/components/corner-marks";
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

export function CreateGroupDialog() {
  const [open, setOpen] = useState(false);
  const handleSuccess = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="relative w-full sm:w-auto" />}>
        <PlusIcon data-icon="inline-start" />
        Создать группу
        <CornerMarks />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Новая группа</DialogTitle>
          <DialogDescription>Название — до 50 символов.</DialogDescription>
        </DialogHeader>
        <GroupNameForm
          action={createGroup}
          submitLabel="Сохранить"
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
