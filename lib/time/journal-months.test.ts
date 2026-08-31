import { describe, expect, it } from "vitest";

import {
  monthName,
  monthOf,
  monthsWithEntries,
} from "@/lib/time/journal-months";

describe("monthOf", () => {
  it("reads the 1-based month straight off a YYYY-MM-DD string", () => {
    expect(monthOf("2026-01-20")).toBe(1);
    expect(monthOf("2026-08-04")).toBe(8);
    expect(monthOf("2022-12-28")).toBe(12);
  });
});

describe("monthName", () => {
  it("maps 1-based months to full English names", () => {
    expect(monthName(1)).toBe("January");
    expect(monthName(12)).toBe("December");
  });

  it("returns an empty string for an out-of-range month", () => {
    expect(monthName(0)).toBe("");
    expect(monthName(13)).toBe("");
  });
});

describe("monthsWithEntries", () => {
  it("returns the distinct months present, ascending", () => {
    const dates = [
      "2026-08-25",
      "2026-01-20",
      "2026-08-04",
      "2026-03-08",
    ];
    expect(monthsWithEntries(dates)).toEqual([1, 3, 8]);
  });

  it("is empty for no dates", () => {
    expect(monthsWithEntries([])).toEqual([]);
  });
});
