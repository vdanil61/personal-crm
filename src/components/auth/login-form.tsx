"use client";

import { useActionState } from "react";

import { requestLoginLink } from "@/app/login/actions";
import { CornerMarks } from "@/components/corner-marks";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// The one field of the login page. The form stays in place after sending, so a link can be asked for again
// or for another email; the answer appears under it.
export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestLoginLink, { status: "idle" });

  // After a submit React resets the form, so the field is re-created (new key) with the email as it was
  const email = state.status === "idle" ? "" : state.email;
  const formKey = state.status === "error" ? state.attempt : state.status === "sent" ? state.sentAt : "initial";
  const emailError = state.status === "error" && state.field === "email" ? state.message : undefined;

  return (
    <form action={formAction} noValidate className="bg-card p-5 lg:p-8">
      <FieldGroup key={formKey} className="gap-5">
        <Field data-invalid={emailError ? true : undefined}>
          <FieldLabel htmlFor="login-email">Почта</FieldLabel>
          <Input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            defaultValue={email}
            placeholder="anna@example.com"
            aria-invalid={emailError ? true : undefined}
            className="h-12"
          />
          <FieldError>{emailError}</FieldError>
        </Field>

        <Button type="submit" size="lg" disabled={pending} className="relative w-full sm:w-auto sm:self-start">
          {pending ? "Отправляю…" : "Получить ссылку"}
          <CornerMarks />
        </Button>

        <div aria-live="polite">
          {state.status === "sent" && (
            <p role="status" className="bg-secondary px-3.5 py-3 text-sm break-words">
              Ссылка для входа отправлена на <b className="font-semibold">{state.email}</b>
            </p>
          )}
          {state.status === "error" && state.field === "form" && (
            <p role="alert" className="bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              {state.message}
            </p>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}
