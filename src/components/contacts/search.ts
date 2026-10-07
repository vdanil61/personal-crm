// URL parameter with the id of a just-added contact, to highlight it in the list
export const ADDED_PARAM = "added";
export const QUERY_PARAM = "q";

// Lowercase and treat "ё" as "е", so "Семён" is found by "семен"
export function normalizeForSearch(value: string): string {
  return value.toLocaleLowerCase("ru").replaceAll("ё", "е");
}

// Every word of the query must appear somewhere in the name, in any order
export function matchesQuery(normalizedName: string, queryWords: string[]): boolean {
  return queryWords.every((word) => normalizedName.includes(word));
}

export function toQueryWords(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}
