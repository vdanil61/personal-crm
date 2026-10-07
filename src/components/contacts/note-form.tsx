"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { addNote } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NoteFormState } from "@/lib/form-state";

export function NoteForm({ contactId }: { contactId: string }) {
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(
    addNote.bind(null, contactId),
    { status: "idle" },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const handledSuccess = useRef<number | null>(null);

  useEffect(() => {
    if (state.status === "success" && handledSuccess.current !== state.savedAt) {
      handledSuccess.current = state.savedAt;
      toast.success("Заметка сохранена");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <Textarea
        name="body"
        // After a failed submit React resets the form, so refill it with what was typed
        defaultValue={state.status === "error" ? state.body : ""}
        rows={3}
        placeholder="О чём поговорили, о чём договорились…"
        aria-label="Новая заметка"
        aria-invalid={state.status === "error" ? true : undefined}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        ) : (
          <p className="hidden text-xs text-muted-foreground sm:block">⌘ + Enter — сохранить</p>
        )}
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? "Сохраняю…" : "Добавить заметку"}
        </Button>
      </div>
    </form>
  );
}
