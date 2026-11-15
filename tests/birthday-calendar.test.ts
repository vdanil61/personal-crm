import { describe, expect, it } from "vitest";

import {
  birthdayOccurrence,
  birthdayWindow,
  isValidBirthday,
  formatBirthday,
  formatBirthdayOccurrence,
} from "@/lib/birthdays";

const occurrence = (now: string, day: number, month: number) =>
  birthdayOccurrence({ birthdayDay: day, birthdayMonth: month }, birthdayWindow(new Date(now)));

describe("Birthday calendar", () => {
  it("B11 crosses the end of a month", () => {
    expect(occurrence("2027-04-29T09:00:00Z", 30, 4)?.offset).toBe(1);
    expect(occurrence("2027-04-29T09:00:00Z", 1, 5)?.offset).toBe(2);
    expect(occurrence("2027-04-29T09:00:00Z", 6, 5)).toBeNull();
  });
  it("B12 crosses the end of a year", () => {
    for (const [day, month, offset] of [
      [31, 12, 3],
      [1, 1, 4],
      [3, 1, 6],
    ]) {
      expect(occurrence("2027-12-28T09:00:00Z", day, month)?.offset).toBe(offset);
    }
    expect(occurrence("2027-12-28T09:00:00Z", 4, 1)).toBeNull();
  });
  it("B13 uses Moscow rather than the process time zone", () => {
    expect(occurrence("2027-11-14T21:30:00Z", 14, 11)).toBeNull();
    expect(occurrence("2027-11-14T21:30:00Z", 21, 11)?.offset).toBe(6);
  });
  it("B14 recalculates after Moscow midnight", () => {
    expect(occurrence("2027-11-14T20:59:59Z", 14, 11)?.offset).toBe(0);
    expect(occurrence("2027-11-14T20:59:59Z", 21, 11)).toBeNull();
    expect(occurrence("2027-11-14T21:00:00Z", 14, 11)).toBeNull();
    expect(occurrence("2027-11-14T21:00:00Z", 21, 11)?.offset).toBe(6);
  });
  it.each([2027, 2100])("B15 celebrates on February 28 in common year %i", (year) => {
    expect(occurrence(`${year}-02-28T09:00:00Z`, 29, 2)).toEqual({ year, month: 2, day: 28, offset: 0 });
  });
  it.each([2028, 2000])("B16 celebrates on February 29 in leap year %i", (year) => {
    expect(occurrence(`${year}-02-28T09:00:00Z`, 29, 2)).toEqual({ year, month: 2, day: 29, offset: 1 });
    expect(occurrence(`${year}-03-01T09:00:00Z`, 29, 2)).toBeNull();
  });
});

describe("Birthday validation and labels", () => {
  it.each([
    [null, null, null],
    [15, 11, null],
    [15, 11, 1990],
    [29, 2, null],
    [29, 2, 2000],
    [1, 1, 1],
    [31, 12, 9999],
  ])("accepts %s/%s/%s", (birthdayDay, birthdayMonth, birthdayYear) => {
    expect(isValidBirthday({ birthdayDay, birthdayMonth, birthdayYear })).toBe(true);
  });
  it.each([
    [1, null, null],
    [null, 1, null],
    [null, null, 1990],
    [31, 4, null],
    [29, 2, 1991],
    [29, 2, 2100],
    [0, 1, null],
    [1, 13, null],
    [1.5, 1, null],
    [1, 1, 0],
    [1, 1, 10000],
    [NaN, 1, null],
  ])("rejects %s/%s/%s", (birthdayDay, birthdayMonth, birthdayYear) => {
    expect(isValidBirthday({ birthdayDay, birthdayMonth, birthdayYear })).toBe(false);
  });
  it("formats an empty birthday", () => {
    expect(formatBirthday({ birthdayDay: null, birthdayMonth: null })).toBe("не указано");
  });
  it.each([null, 2000])("keeps February 29 on the card with year %s", (birthdayYear) => {
    expect(formatBirthday({ birthdayDay: 29, birthdayMonth: 2, birthdayYear })).toBe(
      `29 февраля${birthdayYear ? ` ${birthdayYear}` : ""}`,
    );
  });
  it("formats the celebration date without a year", () => {
    expect(formatBirthdayOccurrence({ year: 2027, month: 2, day: 28 })).toBe("28 февраля");
  });
});
