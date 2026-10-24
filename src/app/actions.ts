"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { contacts, notes } from "@/db/schema";
import type {
  ContactFormState,
  ContactFormValues,
  DeleteContactResult,
  MarkContactedResult,
  NoteFormState,
  RestoreContactResult,
} from "@/lib/form-state";
import {
  type ContactField,
  type ContactSnapshot,
  contactFields,
  contactInputSchema,
  contactSnapshotSchema,
  idSchema,
  noteInputSchema,
} from "@/lib/validation";

const SAVE_FAILED = "Не удалось сохранить. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const DELETE_FAILED = "Не удалось удалить. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const RESTORE_FAILED = "Не удалось вернуть контакт. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const MARK_FAILED = "Не удалось отметить. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const CONTACT_GONE = "Этот контакт больше не существует.";

// Database errors carry the failed query with its values (names, phones, note text),
// and the log is less protected than the database. So only the class and code of each
// error in the cause chain are logged, e.g. "DrizzleQueryError > DatabaseError 42P01".
function describeError(err: unknown): string {
  const parts: string[] = [];
  for (let current = err; current instanceof Error && parts.length < 5; current = current.cause) {
    const code = "code" in current && typeof current.code === "string" ? ` ${current.code}` : "";
    parts.push(`${current.constructor.name}${code}`);
  }
  return parts.join(" > ") || "unknown error";
}

function readContactForm(formData: FormData): ContactFormValues {
  const values = {} as ContactFormValues;
  for (const field of contactFields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

function validateContact(formData: FormData) {
  const values = readContactForm(formData);
  const parsed = contactInputSchema.safeParse(values);
  if (parsed.success) {
    return { values, data: parsed.data, error: null } as const;
  }

  const fieldErrors: Partial<Record<ContactField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField;
    fieldErrors[field] ??= issue.message;
  }
  const error: ContactFormState = { status: "error", attempt: Date.now(), values, fieldErrors };
  return { values, data: null, error } as const;
}

export async function createContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const { values, data, error } = validateContact(formData);
  if (error) return error;

  try {
    const [created] = await getDb().insert(contacts).values(data).returning({ id: contacts.id });
    revalidatePath("/", "layout");
    return { status: "success", contactId: created.id, name: data.name, savedAt: Date.now() };
  } catch (err) {
    console.error(`Failed to create contact: ${describeError(err)}`);
    return { status: "error", attempt: Date.now(), values, fieldErrors: {}, message: SAVE_FAILED };
  }
}

export async function updateContact(
  contactId: string,
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  if (!idSchema.safeParse(contactId).success) {
    throw new Error("Invalid contact id");
  }

  const { values, data, error } = validateContact(formData);
  if (error) return error;

  try {
    const updated = await getDb()
      .update(contacts)
      .set({ ...data, updatedAt: sql`now()` })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    if (updated.length === 0) {
      return {
        status: "error",
        attempt: Date.now(),
        values,
        fieldErrors: {},
        message: CONTACT_GONE,
      };
    }
    revalidatePath("/", "layout");
    return { status: "success", contactId, name: data.name, savedAt: Date.now() };
  } catch (err) {
    console.error(`Failed to update contact: ${describeError(err)}`);
    return { status: "error", attempt: Date.now(), values, fieldErrors: {}, message: SAVE_FAILED };
  }
}

export async function addNote(
  contactId: string,
  _prev: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  if (!idSchema.safeParse(contactId).success) {
    throw new Error("Invalid contact id");
  }

  const rawBody = formData.get("body");
  const body = typeof rawBody === "string" ? rawBody : "";
  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { status: "error", body, message: parsed.error.issues[0].message };
  }

  try {
    const saved = await getDb().transaction(async (tx) => {
      const touched = await tx
        .update(contacts)
        .set({ updatedAt: sql`now()` })
        .where(eq(contacts.id, contactId))
        .returning({ id: contacts.id });
      if (touched.length === 0) return false;
      await tx.insert(notes).values({ contactId, body: parsed.data.body });
      return true;
    });
    if (!saved) {
      return { status: "error", body, message: CONTACT_GONE };
    }
    revalidatePath("/", "layout");
    return { status: "success", savedAt: Date.now() };
  } catch (err) {
    console.error(`Failed to add note: ${describeError(err)}`);
    return { status: "error", body, message: SAVE_FAILED };
  }
}

// "Связался" in the keep-in-touch block: the contact was in touch now, without a note.
// The time comes from the database, as for notes, so the two can be compared.
export async function markContacted(contactId: string): Promise<MarkContactedResult> {
  if (!idSchema.safeParse(contactId).success) {
    throw new Error("Invalid contact id");
  }

  try {
    const marked = await getDb()
      .update(contacts)
      .set({ lastContactedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(contacts.id, contactId))
      .returning({ id: contacts.id });
    // Also when the contact was already gone, so the page stops showing it
    revalidatePath("/", "layout");
    if (marked.length === 0) {
      return { status: "error", message: CONTACT_GONE };
    }
    return { status: "success" };
  } catch (err) {
    console.error(`Failed to mark contact as contacted: ${describeError(err)}`);
    return { status: "error", message: MARK_FAILED };
  }
}

// Deletes the contact with its notes and returns them, so the browser can undo it
export async function deleteContact(contactId: string): Promise<DeleteContactResult> {
  if (!idSchema.safeParse(contactId).success) {
    throw new Error("Invalid contact id");
  }

  try {
    const snapshot = await getDb().transaction(async (tx) => {
      // The lock makes a note being added in another tab wait, so it can't be
      // deleted without getting into the snapshot
      const [contact] = await tx.select().from(contacts).where(eq(contacts.id, contactId)).for("update");
      if (!contact) return null;
      const contactNotes = await tx
        .select({ id: notes.id, body: notes.body, createdAt: notes.createdAt })
        .from(notes)
        .where(eq(notes.contactId, contactId));
      // The notes go with it: ON DELETE CASCADE
      await tx.delete(contacts).where(eq(contacts.id, contactId));
      return { contact, notes: contactNotes };
    });
    // Also when the contact was already gone, so the page stops showing it
    revalidatePath("/", "layout");
    if (!snapshot) {
      return { status: "error", message: CONTACT_GONE };
    }
    return { status: "success", snapshot };
  } catch (err) {
    console.error(`Failed to delete contact: ${describeError(err)}`);
    return { status: "error", message: DELETE_FAILED };
  }
}

// Undo of deleteContact: puts the contact and its notes back with the same ids and dates
export async function restoreContact(snapshot: ContactSnapshot): Promise<RestoreContactResult> {
  const parsed = contactSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new Error("Invalid contact snapshot");
  }
  const { contact, notes: contactNotes } = parsed.data;

  try {
    await getDb().transaction(async (tx) => {
      const restored = await tx
        .insert(contacts)
        .values(contact)
        .onConflictDoNothing({ target: contacts.id })
        .returning({ id: contacts.id });
      // Already restored: a second click on "undo" or another tab
      if (restored.length === 0) return;
      for (let i = 0; i < contactNotes.length; i += 1000) {
        const chunk = contactNotes.slice(i, i + 1000).map((note) => ({ ...note, contactId: contact.id }));
        await tx.insert(notes).values(chunk);
      }
    });
    revalidatePath("/", "layout");
    return { status: "success" };
  } catch (err) {
    console.error(`Failed to restore contact: ${describeError(err)}`);
    return { status: "error", message: RESTORE_FAILED };
  }
}
