const pluralRules = new Intl.PluralRules("ru");
const numberFormat = new Intl.NumberFormat("ru");

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "5 контактов"
export function pluralize(count: number, [one, few, many]: [string, string, string]): string {
  const rule = pluralRules.select(count);
  const word = rule === "one" ? one : rule === "few" ? few : many;
  return `${numberFormat.format(count)} ${word}`;
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
