export type CalendarDate = { year: number; month: number; day: number };
export type Birthday = { birthdayDay: number | null; birthdayMonth: number | null; birthdayYear?: number | null };
export type BirthdayOccurrence = CalendarDate & { offset: number };

const moscowDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

function calendarDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function birthdayWindow(now: Date): BirthdayOccurrence[] {
  const parts = moscowDate.formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)!.value);
  const date = calendarDate(part("year"), part("month"), part("day"));
  return Array.from({ length: 7 }, (_, offset) => {
    const current = new Date(date);
    current.setUTCDate(current.getUTCDate() + offset);
    return { year: current.getUTCFullYear(), month: current.getUTCMonth() + 1, day: current.getUTCDate(), offset };
  });
}

export function birthdayOccurrence(birthday: Birthday, window: BirthdayOccurrence[]): BirthdayOccurrence | null {
  return (
    window.find((date) => {
      const day =
        birthday.birthdayMonth === 2 && birthday.birthdayDay === 29 && !isLeapYear(date.year)
          ? 28
          : birthday.birthdayDay;
      return date.month === birthday.birthdayMonth && date.day === day;
    }) ?? null
  );
}

export function isValidBirthday({
  birthdayDay: day,
  birthdayMonth: month,
  birthdayYear: year = null,
}: Birthday): boolean {
  if (day === null && month === null && year === null) return true;
  if (day === null || month === null || !Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 9999)) return false;
  const date = calendarDate(year ?? 2000, month, day);
  return date.getUTCFullYear() === (year ?? 2000) && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
}

const dayMonth = new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", day: "numeric", month: "long" });

export function formatBirthday(birthday: Birthday): string {
  if (birthday.birthdayDay === null || birthday.birthdayMonth === null) return "не указано";
  const label = dayMonth.format(calendarDate(2000, birthday.birthdayMonth, birthday.birthdayDay));
  return birthday.birthdayYear == null ? label : `${label} ${birthday.birthdayYear}`;
}

export function formatBirthdayOccurrence(date: CalendarDate): string {
  return dayMonth.format(calendarDate(date.year, date.month, date.day));
}
