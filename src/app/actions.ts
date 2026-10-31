"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDb } from "@/db";
import { contactGroups, contacts, notes } from "@/db/schema";
import type {
  ContactFormState,
  ContactFormValues,
  DeleteContactResult,
  DeleteGroupResult,
  GroupFormState,
  MarkContactedResult,
  NoteFormState,
  RestoreContactResult,
  RestoreGroupResult,
  SetContactGroupResult,
} from "@/lib/form-state";
import {
  deleteGroupWithSnapshot,
  insertGroup,
  renameGroupRow,
  replaceContactGroups,
  restoreGroupFromSnapshot,
  setContactGroupMembership,
} from "@/lib/groups";
import {
  type ContactField,
  type ContactSnapshot,
  type GroupSnapshot,
  contactFields,
  contactInputSchema,
  contactSnapshotSchema,
  groupIdsSchema,
  groupNameSchema,
  groupSnapshotSchema,
  idSchema,
  noteInputSchema,
} from "@/lib/validation";

const SAVE_FAILED = "Не удалось сохранить. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const DELETE_FAILED = "Не удалось удалить. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const RESTORE_FAILED = "Не удалось вернуть контакт. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const RESTORE_GROUP_FAILED = "Не удалось вернуть группу. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const GROUP_TICK_FAILED = "Не удалось сохранить группы. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const MARK_FAILED = "Не удалось отметить. Проверьте, что база данных запущена, и попробуйте ещё раз.";
const CONTACT_GONE = "Этот контакт больше не существует.";
const GROUP_EXISTS = "Такая группа уже есть";
const GROUP_GONE = "Эта группа больше не существует.";

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

// Postgres reports a broken unique index with code 23505; the driver may wrap that error
function isUniqueViolation(err: unknown): boolean {
  for (let current = err; current instanceof Error; current = current.cause) {
    if ("code" in current && current.code === "23505") return true;
  }
  return false;
}

function readContactForm(formData: FormData): ContactFormValues {
  const values = { groupIds: [] } as unknown as ContactFormValues;
  for (const field of contactFields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  values.groupIds = formData.getAll("groupIds").filter((id): id is string => typeof id === "string");
  return values;
}

function validateContact(formData: FormData) {
  const values = readContactForm(formData);
  const groupIds = groupIdsSchema.safeParse(values.groupIds);
  if (!groupIds.success) {
    // Only a hand-made request can send this: the form offers existing groups
    throw new Error("Invalid group id");
  }

  const parsed = contactInputSchema.safeParse(values);
  if (parsed.success) {
    return { values, data: parsed.data, groupIds: groupIds.data, error: null } as const;
  }

  const fieldErrors: Partial<Record<ContactField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField;
    fieldErrors[field] ??= issue.message;
  }
  const error: ContactFormState = { status: "error", attempt: Date.now(), values, fieldErrors };
  return { values, data: null, groupIds: groupIds.data, error } as const;
}

export async function createContact(_prev: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const { values, data, groupIds, error } = validateContact(formData);
  if (error) return error;

  try {
    const created = await getDb().transaction(async (tx) => {
      const [contact] = await tx.insert(contacts).values(data).returning({ id: contacts.id });
      await replaceContactGroups(tx, contact.id, groupIds);
      return contact;
    });
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

  const { values, data, groupIds, error } = validateContact(formData);
  if (error) return error;

  try {
    const found = await getDb().transaction(async (tx) => {
      const updated = await tx
        .update(contacts)
        .set({ ...data, updatedAt: sql`now()` })
        .where(eq(contacts.id, contactId))
        .returning({ id: contacts.id });
      if (updated.length === 0) return false;
      await replaceContactGroups(tx, contactId, groupIds);
      return true;
    });
    if (!found) {
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

export async function createGroup(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName : "";
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { status: "error", attempt: Date.now(), name, message: parsed.error.issues[0].message };
  }

  try {
    const created = await insertGroup(parsed.data);
    revalidatePath("/", "layout");
    return { status: "success", groupId: created.id, name: created.name, savedAt: Date.now() };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { status: "error", attempt: Date.now(), name, message: GROUP_EXISTS };
    }
    console.error(`Failed to create group: ${describeError(err)}`);
    return { status: "error", attempt: Date.now(), name, message: SAVE_FAILED };
  }
}

export async function renameGroup(groupId: string, _prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  if (!idSchema.safeParse(groupId).success) {
    throw new Error("Invalid group id");
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName : "";
  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { status: "error", attempt: Date.now(), name, message: parsed.error.issues[0].message };
  }

  try {
    const renamed = await renameGroupRow(groupId, parsed.data);
    // Also when the group was already gone, so the page stops showing it
    revalidatePath("/", "layout");
    if (!renamed) {
      return { status: "error", attempt: Date.now(), name, message: GROUP_GONE };
    }
    return { status: "success", groupId, name: renamed.name, savedAt: Date.now() };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { status: "error", attempt: Date.now(), name, message: GROUP_EXISTS };
    }
    console.error(`Failed to rename group: ${describeError(err)}`);
    return { status: "error", attempt: Date.now(), name, message: SAVE_FAILED };
  }
}

// A tick in the group list of the contact card: puts the contact in the group or takes it out, at once
export async function setContactGroup(
  contactId: string,
  groupId: string,
  member: boolean,
): Promise<SetContactGroupResult> {
  if (!idSchema.safeParse(contactId).success) {
    throw new Error("Invalid contact id");
  }
  if (!idSchema.safeParse(groupId).success) {
    throw new Error("Invalid group id");
  }

  try {
    const outcome = await setContactGroupMembership(contactId, groupId, member);
    // Also when something was already gone, so the page stops showing it
    revalidatePath("/", "layout");
    if (outcome === "no-contact") return { status: "error", message: CONTACT_GONE };
    if (outcome === "no-group") return { status: "error", message: GROUP_GONE };
    return { status: "success" };
  } catch (err) {
    console.error(`Failed to change a group of a contact: ${describeError(err)}`);
    return { status: "error", message: GROUP_TICK_FAILED };
  }
}

// Deletes the group (its people stay in contacts) and returns it with their ids, so the browser can undo it
export async function deleteGroup(groupId: string): Promise<DeleteGroupResult> {
  if (!idSchema.safeParse(groupId).success) {
    throw new Error("Invalid group id");
  }

  try {
    const snapshot = await deleteGroupWithSnapshot(groupId);
    // Also when the group was already gone, so the page stops showing it
    revalidatePath("/", "layout");
    if (!snapshot) {
      return { status: "error", message: GROUP_GONE };
    }
    return { status: "success", snapshot };
  } catch (err) {
    console.error(`Failed to delete group: ${describeError(err)}`);
    return { status: "error", message: DELETE_FAILED };
  }
}

// Undo of deleteGroup: puts the group back with the same id and the people who are still in contacts
export async function restoreGroup(snapshot: GroupSnapshot): Promise<RestoreGroupResult> {
  const parsed = groupSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) {
    throw new Error("Invalid group snapshot");
  }

  try {
    await restoreGroupFromSnapshot(parsed.data);
    revalidatePath("/", "layout");
    return { status: "success" };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { status: "error", message: `Не удалось вернуть группу: группа «${parsed.data.group.name}» уже есть.` };
    }
    console.error(`Failed to restore group: ${describeError(err)}`);
    return { status: "error", message: RESTORE_GROUP_FAILED };
  }
}

export async function addNote(contactId: string, _prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
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
      const memberships = await tx
        .select({ groupId: contactGroups.groupId })
        .from(contactGroups)
        .where(eq(contactGroups.contactId, contactId));
      // The notes and the rows of contact_groups go with it: ON DELETE CASCADE
      await tx.delete(contacts).where(eq(contacts.id, contactId));
      return { contact, notes: contactNotes, groupIds: memberships.map((row) => row.groupId) };
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
  const { contact, notes: contactNotes, groupIds } = parsed.data;

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
      // Only the groups that still exist; one deleted meanwhile is skipped without an error
      await replaceContactGroups(tx, contact.id, groupIds);
    });
    revalidatePath("/", "layout");
    return { status: "success" };
  } catch (err) {
    console.error(`Failed to restore contact: ${describeError(err)}`);
    return { status: "error", message: RESTORE_FAILED };
  }
}
