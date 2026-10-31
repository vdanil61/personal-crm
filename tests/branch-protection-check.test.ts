import { describe, expect, it } from "vitest";

// Fails on purpose: a pull request with it must not get into main.
// Only for checking the main branch protection; never merged.
describe("Проверка защиты main", () => {
  it("заведомо падающий тест", () => {
    expect(1 + 1).toBe(3);
  });
});
