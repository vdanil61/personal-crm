const pluralRules = new Intl.PluralRules("ru");
const numberFormat = new Intl.NumberFormat("ru");

// pluralWord(5, ["контакт", "контакта", "контактов"]) -> "контактов"
export function pluralWord(count: number, [one, few, many]: [string, string, string]): string {
  const rule = pluralRules.select(count);
  return rule === "one" ? one : rule === "few" ? few : many;
}

// formatCount(1002) -> "1 002"
export function formatCount(count: number): string {
  return numberFormat.format(count);
}

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "5 контактов"
export function pluralize(count: number, words: [string, string, string]): string {
  return `${formatCount(count)} ${pluralWord(count, words)}`;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}
