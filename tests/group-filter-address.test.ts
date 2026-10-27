import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { groups } from "@/db/schema";
import { ALL_GROUPS, type GroupFilter, filterHref, labelHref, parseGroupFilter } from "@/lib/group-filter";
import { resolveGroupFilter } from "@/lib/groups";
import { contactListHref } from "@/lib/search";

import { findGroupId } from "./support/factories";

const selected = (...ids: string[]): GroupFilter => ({ mode: "groups", ids });

// The address as a browser sees it: path and the decoded parameters
function parts(href: string) {
  const url = new URL(href, "http://localhost");
  return { path: url.pathname, params: Object.fromEntries(url.searchParams) };
}

describe("Фильтр по группам хранится в адресе", () => {
  it("Обновил страницу", async () => {
    const chosen = selected(await findGroupId("Друзья"), await findGroupId("Теннис"));

    const href = contactListHref({ filter: chosen });
    // What the server reads from the address after a reload
    const afterReload = await resolveGroupFilter(parts(href).params.groups);

    expect(afterReload).toEqual(chosen);
  });

  it("«Без группы» и «Все» в адресе", async () => {
    expect(parts(contactListHref({ filter: { mode: "none" } })).params).toEqual({ groups: "none" });
    expect(parts(contactListHref({ filter: ALL_GROUPS })).params).toEqual({});
    expect(await resolveGroupFilter("none")).toEqual({ mode: "none" });
    expect(await resolveGroupFilter(null)).toEqual(ALL_GROUPS);
  });

  it("Смена фильтра открывает первую страницу", async () => {
    const friendsId = await findGroupId("Друзья");

    // The list is on page 3 with a search and 20 per page; a new filter keeps the search and the size only
    const href = filterHref({ query: "Анна", size: 20 }, selected(friendsId));

    expect(parts(href).params).toEqual({ q: "Анна", size: "20", groups: friendsId });
  });

  it("Ссылка на удалённую группу", async () => {
    const tennisId = await findGroupId("Теннис");
    const familyId = await findGroupId("Семья");
    await getDb().delete(groups).where(eq(groups.id, tennisId));

    // Only the deleted group: "Все", no error
    expect(await resolveGroupFilter(tennisId)).toEqual(ALL_GROUPS);
    // One of two is gone: the other stays
    expect(await resolveGroupFilter(`${tennisId},${familyId}`)).toEqual(selected(familyId));
    // Not an id at all
    expect(await resolveGroupFilter("абракадабра,123")).toEqual(ALL_GROUPS);
  });

  it("Добавил контакт, пока выбран фильтр", () => {
    // After adding, the list opens by this address: the filter is not in it
    const href = contactListHref({ added: "3b241101-e2bb-4255-8caf-4136c566a962", size: 20 });

    expect(parts(href).params).toEqual({ added: "3b241101-e2bb-4255-8caf-4136c566a962", size: "20" });
  });

  it("Нажал метку в карточке", async () => {
    const tennisId = await findGroupId("Теннис");

    const href = contactListHref({ filter: selected(tennisId) });

    // Only this group, empty search
    expect(href).toBe(`/?groups=${tennisId}`);
  });

  it("Нажал метку в строке списка", async () => {
    const friendsId = await findGroupId("Друзья");
    const tennisId = await findGroupId("Теннис");

    const href = labelHref({ query: "Анна", size: 20 }, selected(friendsId), tennisId);

    // The group is added to the selected ones; the search and the size stay; the first page
    expect(parts(href).params).toEqual({ q: "Анна", size: "20", groups: `${friendsId},${tennisId}` });
    // The group is already selected: the address leads to the same filter
    expect(labelHref({ query: "", size: 50 }, selected(friendsId), friendsId)).toBe(`/?groups=${friendsId}`);
  });

  it("Разбор адреса не зависит от регистра и повторов", () => {
    const id = "3b241101-e2bb-4255-8caf-4136c566a962";

    expect(parseGroupFilter(`${id.toUpperCase()},${id}`)).toEqual(selected(id));
  });
});
