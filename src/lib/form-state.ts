import type { ContactField, ContactSnapshot } from "./validation";

export type ContactFormValues = Record<ContactField, string>;

export type ContactFormState =
  | { status: "idle" }
  | {
      status: "error";
      // Changes on every failed submit, so the form can re-create its fields
      attempt: number;
      values: ContactFormValues;
      fieldErrors: Partial<Record<ContactField, string>>;
      message?: string;
    }
  | { status: "success"; contactId: string; name: string; savedAt: number };

export type NoteFormState =
  | { status: "idle" }
  | { status: "error"; body: string; message: string }
  | { status: "success"; savedAt: number };

export type DeleteContactResult =
  | { status: "success"; snapshot: ContactSnapshot }
  | { status: "error"; message: string };

export type RestoreContactResult = { status: "success" } | { status: "error"; message: string };
