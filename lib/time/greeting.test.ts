import { describe, expect, it } from "vitest";

import { getGreeting } from "@/lib/time/greeting";

const at = (hour: number) => new Date(2026, 0, 1, hour, 30, 0);

describe("getGreeting", () => {
  it("returns morning from 05:00 up to but not including 12:00", () => {
    expect(getGreeting(at(5))).toBe("morning");
    expect(getGreeting(at(8))).toBe("morning");
    expect(getGreeting(at(11))).toBe("morning");
  });

  it("returns afternoon from 12:00 up to but not including 18:00", () => {
    expect(getGreeting(at(12))).toBe("afternoon");
    expect(getGreeting(at(15))).toBe("afternoon");
    expect(getGreeting(at(17))).toBe("afternoon");
  });

  it("returns evening from 18:00 through 04:59", () => {
    expect(getGreeting(at(18))).toBe("evening");
    expect(getGreeting(at(23))).toBe("evening");
    expect(getGreeting(at(0))).toBe("evening");
    expect(getGreeting(at(4))).toBe("evening");
  });

  it("treats the exact boundary hours as the start of the next period", () => {
    expect(getGreeting(new Date(2026, 0, 1, 5, 0, 0))).toBe("morning");
    expect(getGreeting(new Date(2026, 0, 1, 12, 0, 0))).toBe("afternoon");
    expect(getGreeting(new Date(2026, 0, 1, 18, 0, 0))).toBe("evening");
  });
});
