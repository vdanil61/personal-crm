import { describe, expect, it } from "vitest";

import { createGroup } from "@/app/actions";
import { listGroups } from "@/lib/groups";

import { addGroup } from "./support/factories";

const idle = { status: "idle" } as const;

function nameForm(name: string) {
  const formData = new FormData();
  formData.set("name", name);
  return formData;
}

const groupNames = async () => (await listGroups()).map((group) => group.name);

describe("Создать группу", () => {
  it("Новая группа", async () => {
    const result = await createGroup(idle, nameForm("Работа"));

    expect(result).toMatchObject({ status: "success", name: "Работа" });
    const created = (await listGroups()).find((group) => group.name === "Работа");
    expect(created).toMatchObject({ peopleCount: 0 });
    // On its place by the alphabet: between "Знакомые" and "Семья"
    expect(await groupNames()).toEqual(["Аналитики", "Друзья", "Знакомые", "Работа", "Семья", "Теннис"]);
  });

  it("Пробелы по краям отбрасываются", async () => {
    const result = await createGroup(idle, nameForm("  Работа  "));

    expect(result).toMatchObject({ status: "success", name: "Работа" });
    expect(await groupNames()).toContain("Работа");
  });

  it("Пустое название", async () => {
    for (const empty of ["", "   "]) {
      const result = await createGroup(idle, nameForm(empty));

      expect(result).toMatchObject({ status: "error", name: empty, message: "Укажите название" });
    }
    expect(await groupNames()).toHaveLength(5);
  });

  it("Такая группа уже есть", async () => {
    const result = await createGroup(idle, nameForm("семья"));

    expect(result).toMatchObject({ status: "error", name: "семья", message: "Такая группа уже есть" });
    expect(await groupNames()).toHaveLength(5);
  });

  it("Ёлки и Елки", async () => {
    await addGroup("Ёлки");

    const result = await createGroup(idle, nameForm("Елки"));

    expect(result).toMatchObject({ status: "error", message: "Такая группа уже есть" });
    expect(await groupNames()).toHaveLength(6);
  });

  it("Слишком длинное название", async () => {
    const tooLong = "а".repeat(51);

    const result = await createGroup(idle, nameForm(tooLong));

    expect(result).toMatchObject({
      status: "error",
      name: tooLong,
      message: "Название слишком длинное — до 50 символов",
    });
    expect(await groupNames()).toHaveLength(5);

    // 50 characters is still fine
    expect(await createGroup(idle, nameForm("а".repeat(50)))).toMatchObject({ status: "success" });
  });
});
