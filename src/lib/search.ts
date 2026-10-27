import type { GroupFilter } from "./group-filter";

// URL parameters of the contact list
export const QUERY_PARAM = "q";
export const PAGE_PARAM = "page";
export const SIZE_PARAM = "size";
// Filter by groups: ids of the selected groups separated by commas, or NO_GROUP_VALUE for "Без группы";
// no parameter means "Все"
export const GROUPS_PARAM = "groups";
export const NO_GROUP_VALUE = "none";
// Id of a just-added contact: the list opens the page with it and highlights it
export const ADDED_PARAM = "added";

// How many contacts one page shows; the default is left out of the address
export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 50;

export function parsePageSize(value: string | null | undefined): PageSize {
  return PAGE_SIZES.find((size) => String(size) === value) ?? DEFAULT_PAGE_SIZE;
}

// Lowercase and treat "ё" as "е", so "Семён" is found by "семен"
export function normalizeForSearch(value: string): string {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

export function toQueryWords(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

// Address of the list; the first page, the default page size and "Все" are left out
export function contactListHref({
  query = "",
  page = 1,
  size = DEFAULT_PAGE_SIZE,
  added,
  filter,
}: {
  query?: string;
  page?: number;
  size?: PageSize;
  added?: string;
  filter?: GroupFilter;
}): string {
  const params = new URLSearchParams();
  if (added) params.set(ADDED_PARAM, added);
  if (query.trim()) params.set(QUERY_PARAM, query);
  if (filter?.mode === "none") params.set(GROUPS_PARAM, NO_GROUP_VALUE);
  if (filter?.mode === "groups") params.set(GROUPS_PARAM, filter.ids.join(","));
  if (page > 1) params.set(PAGE_PARAM, String(page));
  if (size !== DEFAULT_PAGE_SIZE) params.set(SIZE_PARAM, String(size));
  // A comma is fine in an address: "?groups=a,b" reads better than "?groups=a%2Cb"
  const search = params.toString().replaceAll("%2C", ",");
  return search ? `/?${search}` : "/";
}

// Page size of the list currently open, read at the moment of an event
export function currentPageSize(): PageSize {
  return parsePageSize(new URLSearchParams(window.location.search).get(SIZE_PARAM));
}
