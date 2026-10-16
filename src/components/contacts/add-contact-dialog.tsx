"use client";

import { useCallback, useState } from "react";
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

import { ContactForm } from "./contact-form";
import { ADDED_PARAM } from "./search";

export function AddContactDialog() {
  const [open, setOpen] = useState(false);

  const handleSuccess = useCallback((result: Extract<ContactFormState, { status: "success" }>) => {
    setOpen(false);
    toast.success(`Контакт «${result.name}» добавлен`);
    // The contact list picks this up, scrolls to the new contact and highlights it
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    url.searchParams.set(ADDED_PARAM, result.contactId);
    window.history.replaceState(null, "", url);
  }, []);

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
