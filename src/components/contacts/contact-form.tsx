"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_FREQUENCIES, frequencyOptionLabels } from "@/lib/contact-frequency";
import type { ContactFormState, ContactFormValues } from "@/lib/form-state";
import type { ContactField } from "@/lib/validation";

type ContactFormProps = {
  action: (prev: ContactFormState, formData: FormData) => Promise<ContactFormState>;
  initialValues?: Partial<ContactFormValues>;
  submitLabel: string;
  onSuccess: (result: Extract<ContactFormState, { status: "success" }>) => void;
  onCancel: () => void;
};

const emptyValues: ContactFormValues = {
  name: "",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  contactFrequency: "",
};

// null is "Не задано": the select sends it with the form as an empty string
const frequencyItems = [
  { value: null, label: "Не задано" },
  ...CONTACT_FREQUENCIES.map((value) => ({ value, label: frequencyOptionLabels[value] })),
];

export function ContactForm({ action, initialValues, submitLabel, onSuccess, onCancel }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // Fixed at open: fresh server data after a save must not change mounted fields
  const [startValues] = useState<ContactFormValues>(() => ({ ...emptyValues, ...initialValues }));
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

  // After a failed submit React resets the form, so the fields are re-created
  // (new key) with what was typed as their default values
  const values = state.status === "error" ? state.values : startValues;
  const errors = state.status === "error" ? state.fieldErrors : {};

  const fieldProps = (field: ContactField) => ({
    id: `contact-${field}`,
    name: field,
    defaultValue: values[field],
    "aria-invalid": errors[field] ? true : undefined,
  });

  return (
    <form ref={formRef} action={formAction} noValidate>
      <FieldGroup key={state.status === "error" ? state.attempt : "initial"} className="gap-4">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="contact-name">Имя</FieldLabel>
          <Input {...fieldProps("name")} autoComplete="off" autoFocus required placeholder="Например, Анна Смирнова" />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field data-invalid={errors.about ? true : undefined}>
          <FieldLabel htmlFor="contact-about">Кто это</FieldLabel>
          <Input {...fieldProps("about")} autoComplete="off" placeholder="Дизайнер, сестра Лены, тренер по теннису…" />
          <FieldError>{errors.about}</FieldError>
        </Field>
        <Field data-invalid={errors.howWeMet ? true : undefined}>
          <FieldLabel htmlFor="contact-howWeMet">Откуда знакомы</FieldLabel>
          <Textarea {...fieldProps("howWeMet")} rows={2} placeholder="Учились вместе, познакомились на конференции…" />
          <FieldError>{errors.howWeMet}</FieldError>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={errors.phone ? true : undefined}>
            <FieldLabel htmlFor="contact-phone">Телефон</FieldLabel>
            <Input {...fieldProps("phone")} type="tel" autoComplete="off" placeholder="+7 900 123-45-67" />
            <FieldError>{errors.phone}</FieldError>
          </Field>
          <Field data-invalid={errors.email ? true : undefined}>
            <FieldLabel htmlFor="contact-email">Почта</FieldLabel>
            <Input {...fieldProps("email")} type="email" autoComplete="off" placeholder="anna@example.com" />
            <FieldError>{errors.email}</FieldError>
          </Field>
        </div>
        <Field data-invalid={errors.contactFrequency ? true : undefined}>
          <FieldLabel htmlFor="contact-contactFrequency">Как часто общаться</FieldLabel>
          <Select name="contactFrequency" items={frequencyItems} defaultValue={values.contactFrequency || null}>
            <SelectTrigger
              id="contact-contactFrequency"
              aria-invalid={errors.contactFrequency ? true : undefined}
              className="w-full bg-card pr-2.5 pl-3 text-base data-[size=default]:h-10 md:text-sm data-placeholder:text-foreground data-popup-open:border-ring"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="p-1 shadow-card ring-input">
              {frequencyItems.map((item) => (
                <SelectItem
                  key={item.value ?? "none"}
                  value={item.value}
                  className="h-11 px-2.5 text-base md:h-9 md:px-2 md:text-sm data-selected:bg-secondary data-selected:text-secondary-foreground"
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError>{errors.contactFrequency}</FieldError>
        </Field>

        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

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
