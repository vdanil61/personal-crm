// The filter by groups on the main page: what is selected and what a click changes.
// Pure logic, no database and no screen, so it is easy to test. The filter lives in the address of the page.

import { GROUPS_PARAM, NO_GROUP_VALUE, type PageSize, contactListHref } from "./search";

export type GroupFilter =
  // "Все": nobody is filtered out
  | { mode: "all" }
  // "Без группы": only people who are in no group
  | { mode: "none" }
  // Only people who are in all of these groups at once, in the order they were selected
  | { mode: "groups"; ids: string[] };

export const ALL_GROUPS: GroupFilter = { mode: "all" };

// "Все": drops the whole selection
export function clearFilter(): GroupFilter {
  return ALL_GROUPS;
}

function fromIds(ids: string[]): GroupFilter {
  return ids.length === 0 ? ALL_GROUPS : { mode: "groups", ids };
}

// A click on a group button: selects the group, or drops it if it is selected.
// A group after "Без группы" replaces it.
export function toggleGroup(filter: GroupFilter, groupId: string): GroupFilter {
  if (filter.mode !== "groups") return { mode: "groups", ids: [groupId] };
  return fromIds(filter.ids.includes(groupId) ? filter.ids.filter((id) => id !== groupId) : [...filter.ids, groupId]);
}

// A click on "Без группы": drops the selected groups; a second click drops "Без группы"
export function toggleNoGroup(filter: GroupFilter): GroupFilter {
  return filter.mode === "none" ? ALL_GROUPS : { mode: "none" };
}

// A click on a group label in a row of the list: adds the group to the selected ones.
// A group that is already selected stays as it is (it is not dropped).
export function addGroup(filter: GroupFilter, groupId: string): GroupFilter {
  if (filter.mode !== "groups") return { mode: "groups", ids: [groupId] };
  return filter.ids.includes(groupId) ? filter : { mode: "groups", ids: [...filter.ids, groupId] };
}

// The ids of the selected groups; empty for "Все" and "Без группы"
export function selectedGroupIds(filter: GroupFilter): string[] {
  return filter.mode === "groups" ? filter.ids : [];
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Reads the "groups" parameter of the address. Only the shape of the ids is checked here;
// whether the groups still exist is checked against the database (see resolveGroupFilter).
export function parseGroupFilter(value: string | null | undefined): GroupFilter {
  if (value === NO_GROUP_VALUE) return { mode: "none" };
  const ids = (value ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter((id) => UUID_SHAPE.test(id));
  return fromIds([...new Set(ids)]);
}

// The filter of the list currently open, read at the moment of an event
export function currentGroupFilter(): GroupFilter {
  return parseGroupFilter(new URLSearchParams(window.location.search).get(GROUPS_PARAM));
}

// What the list keeps when the filter changes: the search and the page size, but not the page
type ListState = { query: string; size: PageSize };

// Address of the list after the filter changed: always the first page
export function filterHref({ query, size }: ListState, filter: GroupFilter): string {
  return contactListHref({ query, size, filter });
}

// Address a group label in a row of the list leads to: the group is added to the selected ones
export function labelHref(state: ListState, filter: GroupFilter, groupId: string): string {
  return filterHref(state, addGroup(filter, groupId));
}
