import { beforeEach, expect, it } from "vitest";
import { listContactsPage, listUpcomingBirthdays } from "@/lib/contacts";
import { ALL_GROUPS, type GroupFilter } from "@/lib/group-filter";
import { signInWithGroups, type TestUser } from "./support/auth";
import { addContact, addUser, findGroupId, putInGroup } from "./support/factories";
import { testEmail } from "./support/mailpit";

let user: TestUser;
const now = new Date("2027-11-15T09:00:00Z");
beforeEach(async () => {
  user = await signInWithGroups(testEmail("birthday-list"));
});
const birthday = (name: string, day = 16) =>
  addContact(user.id, name, { birthdayDay: day, birthdayMonth: 11, birthdayYear: 1990 });
const names = async (filter: GroupFilter = ALL_GROUPS) =>
  (await listUpcomingBirthdays(user.id, filter, now)).map((c) => c.name);
const selected = async (...groups: string[]): Promise<GroupFilter> => ({
  mode: "groups",
  ids: await Promise.all(groups.map((name) => findGroupId(user.id, name))),
});

it("B10 includes days zero and six, excludes day seven, yesterday and no birthday", async () => {
  for (const day of [15, 21, 22, 14]) await birthday(`Day ${day}`, day);
  await addContact(user.id, "No date");
  expect(await names()).toEqual(["Day 15", "Day 21"]);
  const [row] = await listUpcomingBirthdays(user.id, ALL_GROUPS, now);
  expect(Object.keys(row).sort()).toEqual(["date", "id", "name"]);
  expect(row.date).toEqual({ year: 2027, month: 11, day: 15, offset: 0 });
});
it("B20 returns every birthday regardless of list pagination", async () => {
  for (let i = 0; i < 27; i++) await birthday(`Contact ${i.toString().padStart(2, "0")}`);
  expect((await listContactsPage(user.id, "", 2, 20)).items).toHaveLength(7);
  expect(await names()).toHaveLength(27);
});
it("B21 orders by date then Russian name without case separation and stable ids", async () => {
  await birthday("Вера", 15);
  await birthday("борис");
  await birthday("Анна");
  await birthday("Глеб", 21);
  expect(await names()).toEqual(["Вера", "Анна", "борис", "Глеб"]);
  const a = await birthday("Same");
  const b = await birthday("Same");
  expect(
    (await listUpcomingBirthdays(user.id, ALL_GROUPS, now)).filter((c) => c.name === "Same").map((c) => c.id),
  ).toEqual([a.id, b.id].sort());
});
it("B22 uses a single selected group", async () => {
  const anna = await birthday("Анна");
  const boris = await birthday("Борис");
  await putInGroup(user.id, anna.id, "Семья");
  await putInGroup(user.id, boris.id, "Друзья");
  expect(await names(await selected("Семья"))).toEqual(["Анна"]);
  expect(await names()).toEqual(["Анна", "Борис"]);
});
it("B23 intersects groups", async () => {
  const anna = await birthday("Анна");
  const boris = await birthday("Борис");
  const vera = await birthday("Вера");
  await putInGroup(user.id, anna.id, "Друзья");
  await putInGroup(user.id, anna.id, "Теннис");
  await putInGroup(user.id, boris.id, "Друзья");
  await putInGroup(user.id, vera.id, "Теннис");
  expect(await names(await selected("Друзья", "Теннис"))).toEqual(["Анна"]);
});
it("B24 returns only ungrouped contacts", async () => {
  const anna = await birthday("Анна");
  await birthday("Борис");
  await putInGroup(user.id, anna.id, "Друзья");
  expect(await names({ mode: "none" })).toEqual(["Борис"]);
});
it("B25 returns empty when a group excludes every birthday", async () => {
  await birthday("Анна");
  expect(await names(await selected("Теннис"))).toEqual([]);
  expect(await names()).toEqual(["Анна"]);
});
it("B27 excludes another user's birthday", async () => {
  const other = await addUser();
  await addContact(other.id, "Чужой", { birthdayDay: 15, birthdayMonth: 11 });
  expect(await names()).toEqual([]);
});
