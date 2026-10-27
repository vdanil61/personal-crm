import { describe, expect, it } from "vitest";

import { ALL_GROUPS, type GroupFilter, addGroup, clearFilter, toggleGroup, toggleNoGroup } from "@/lib/group-filter";

// The ids here are stand-ins: the click logic does not look at them
const friends = "friends";
const tennis = "tennis";
const family = "family";

const selected = (...ids: string[]): GroupFilter => ({ mode: "groups", ids });

describe("Фильтр по группам: нажатия на кнопки", () => {
  it("Одна группа", () => {
    expect(toggleGroup(ALL_GROUPS, family)).toEqual(selected(family));
  });

  it("Ещё одна группа добавляется к выбранным", () => {
    expect(toggleGroup(selected(friends), tennis)).toEqual(selected(friends, tennis));
  });

  it("Снять одну из групп", () => {
    expect(toggleGroup(selected(friends, tennis), tennis)).toEqual(selected(friends));
  });

  it("Снял последнюю группу — снова «Все»", () => {
    expect(toggleGroup(selected(friends), friends)).toEqual(ALL_GROUPS);
  });

  it("Без группы", () => {
    expect(toggleNoGroup(selected(friends, tennis))).toEqual({ mode: "none" });
    expect(toggleNoGroup(ALL_GROUPS)).toEqual({ mode: "none" });
  });

  it("Группа после «Без группы» снимает «Без группы»", () => {
    expect(toggleGroup({ mode: "none" }, tennis)).toEqual(selected(tennis));
  });

  it("Повторное нажатие «Без группы» снимает его", () => {
    expect(toggleNoGroup({ mode: "none" })).toEqual(ALL_GROUPS);
  });

  it("Вернуть всех", () => {
    expect(clearFilter()).toEqual(ALL_GROUPS);
  });
});

describe("Фильтр по группам: метка в строке списка", () => {
  it("Метка при пустом фильтре", () => {
    expect(addGroup(ALL_GROUPS, family)).toEqual(selected(family));
  });

  it("Метка добавляет свою группу к выбранным", () => {
    expect(addGroup(selected(friends), tennis)).toEqual(selected(friends, tennis));
  });

  it("Метка уже выбранной группы ничего не меняет", () => {
    expect(addGroup(selected(friends, tennis), friends)).toEqual(selected(friends, tennis));
  });

  it("Метка при выбранном «Без группы» оставляет только свою группу", () => {
    expect(addGroup({ mode: "none" }, family)).toEqual(selected(family));
  });
});
