import type { ContactField, ContactSnapshot, GroupSnapshot } from "./validation";

// A group as the contact form and the group list of the contact card offer it
export type GroupOption = { id: string; name: string };

export type ContactFormValues = Record<ContactField, string> & {
  // Ids of the groups ticked in the form; apart from the text fields, so an error keeps them ticked
  groupIds: string[];
};

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

// The dialogs for creating and renaming a group have one field, the name
export type GroupFormState =
  | { status: "idle" }
  | {
      status: "error";
      // Changes on every failed submit, so the dialog can show the error again
      attempt: number;
      // As typed, so the field keeps its text
      name: string;
      message: string;
    }
  | { status: "success"; groupId: string; name: string; savedAt: number };

export type NoteFormState =
  { status: "idle" } | { status: "error"; body: string; message: string } | { status: "success"; savedAt: number };

export type DeleteContactResult =
  { status: "success"; snapshot: ContactSnapshot } | { status: "error"; message: string };

export type RestoreContactResult = { status: "success" } | { status: "error"; message: string };

export type SetContactGroupResult = { status: "success" } | { status: "error"; message: string };

export type DeleteGroupResult = { status: "success"; snapshot: GroupSnapshot } | { status: "error"; message: string };

export type RestoreGroupResult = { status: "success" } | { status: "error"; message: string };

export type MarkContactedResult = { status: "success" } | { status: "error"; message: string };

// The login form: "sent" keeps the address the email really went to (trimmed, in lower case)
export type LoginFormState =
  | { status: "idle" }
  | { status: "sent"; email: string; sentAt: number }
  | {
      status: "error";
      // "email" is shown under the field, "form" under the button
      field: "email" | "form";
      // As typed, so the field keeps its text
      email: string;
      message: string;
      attempt: number;
    };
