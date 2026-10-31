import { describe, expect, it } from "vitest";

import { formatOverdueCaption } from "@/lib/contact-frequency";

// Months count from zero: 7 is August
const now = new Date(2026, 9, 31, 12);

// The date keeps no-break spaces, so it stays on one line when the caption wraps on a phone
const nbsp = (text: string) => text.replaceAll(" ", "\u00a0");

describe("Что видно у человека в блоке", () => {
  it("Строка с датой общения", () => {
    const caption = formatOverdueCaption({ frequency: "month", lastContactAt: new Date(2026, 7, 22, 18) }, now);

    expect(caption).toBe(`раз в месяц · связались ${nbsp("22 августа")}`);
  });

  it("Общение в прошлом году", () => {
    const caption = formatOverdueCaption({ frequency: "year", lastContactAt: new Date(2025, 2, 3, 9) }, now);

    expect(caption).toBe(`раз в год · связались ${nbsp("3 марта 2025")}`);
  });

  it("Строка без общения", () => {
    const caption = formatOverdueCaption({ frequency: "week", lastContactAt: null }, now);

    expect(caption).toBe("раз в неделю · ещё не связывались");
  });
});
