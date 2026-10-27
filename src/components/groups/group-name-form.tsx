"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { GroupFormState } from "@/lib/form-state";

type GroupNameFormProps = {
  action: (prev: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  initialName?: string;
  submitLabel: string;
  onSuccess: (result: Extract<GroupFormState, { status: "success" }>) => void;
  onCancel: () => void;
};

// The one field of the dialogs that create and rename a group
export function GroupNameForm({ action, initialName = "", submitLabel, onSuccess, onCancel }: GroupNameFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // Fixed at open: fresh server data after a save must not change the mounted field
  const [startName] = useState(initialName);
  const formRef = useRef<HTMLFormElement>(null);
  const handledSuccess = useRef<number | null>(null);

  useEffect(() => {
    if (state.status === "success" && handledSuccess.current !== state.savedAt) {
      handledSuccess.current = state.savedAt;
      onSuccess(state);
    }
    if (state.status === "error") {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
    }
  }, [state, onSuccess]);

  // After a failed submit React resets the form, so the field is re-created
  // (new key) with what was typed as its default value
  const name = state.status === "error" ? state.name : startName;
  const error = state.status === "error" ? state.message : undefined;

  return (
    <form ref={formRef} action={formAction} noValidate>
      <FieldGroup key={state.status === "error" ? state.attempt : "initial"} className="gap-4">
        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="group-name">Название</FieldLabel>
          <Input
            id="group-name"
            name="name"
            defaultValue={name}
            autoComplete="off"
            autoFocus
            placeholder="Например, Работа"
            aria-invalid={error ? true : undefined}
          />
          <FieldError>{error}</FieldError>
        </Field>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняю…" : submitLabel}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
