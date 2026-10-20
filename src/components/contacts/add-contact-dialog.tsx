"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createContact } from "@/app/actions";
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
import type { ContactFormState } from "@/lib/form-state";
import { contactListHref, currentPageSize } from "@/lib/search";

import { ContactForm } from "./contact-form";

export function AddContactDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const handleSuccess = useCallback(
    (result: Extract<ContactFormState, { status: "success" }>) => {
      setOpen(false);
      toast.success(`Контакт «${result.name}» добавлен`);
      // The full list opens on the page with the new contact, scrolls to it and highlights it
      router.replace(contactListHref({ added: result.contactId, size: currentPageSize() }), { scroll: false });
    },
    [router],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" className="relative w-full sm:w-auto" />}>
        <PlusIcon data-icon="inline-start" />
        Добавить контакт
        <CornerMarks />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый контакт</DialogTitle>
          <DialogDescription>Обязательно только имя — остальное можно дописать позже.</DialogDescription>
        </DialogHeader>
        <ContactForm
          action={createContact}
          submitLabel="Добавить"
          onSuccess={handleSuccess}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
