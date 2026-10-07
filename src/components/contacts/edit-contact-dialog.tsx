"use client";

import { useCallback, useState } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { updateContact } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ContactFormValues } from "@/lib/form-state";

import { ContactForm } from "./contact-form";

export function EditContactDialog({ contactId, values }: { contactId: string; values: ContactFormValues }) {
  const [open, setOpen] = useState(false);
  const action = updateContact.bind(null, contactId);

  const handleSuccess = useCallback(() => {
    setOpen(false);
    toast.success("Изменения сохранены");
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" aria-label="Изменить контакт" />}>
        <PencilIcon data-icon="inline-start" />
        {/* Icon-only on phones, so a long name has room */}
        <span className="max-sm:hidden">Изменить</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Изменить контакт</DialogTitle>
          <DialogDescription>Поправьте данные и нажмите «Сохранить».</DialogDescription>
        </DialogHeader>
        <ContactForm
          action={action}
          initialValues={values}
          submitLabel="Сохранить"
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
