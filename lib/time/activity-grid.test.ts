import { describe, expect, it } from "vitest";

import { buildYearGrid, listActivityYears } from "@/lib/time/activity-grid";

const TODAY = "2026-08-27";

const flat = (grid: ReturnType<typeof buildYearGrid>) => grid.weeks.flat();

const cell = (grid: ReturnType<typeof buildYearGrid>, date: string) =>
  flat(grid).find((d) => d.date === date);

describe("listActivityYears", () => {
  it("returns an empty list when there are no entries", () => {
    expect(listActivityYears([])).toEqual([]);
  });

  it("spans the earliest through the latest entry year, inclusive", () => {
    expect(listActivityYears(["2024-05-05", "2022-01-01", "2023-09-09"])).toEqual([
      2022, 2023, 2024,
    ]);
  });

  it("returns a single year when all entries share it", () => {
    expect(listActivityYears(["2022-01-01", "2022-12-31"])).toEqual([2022]);
  });
});

describe("buildYearGrid", () => {
  it("lays out full Sunday-first weeks of 7 days", () => {
    const grid = buildYearGrid(2022, [], TODAY);
    for (const week of grid.weeks) expect(week).toHaveLength(7);
    // 2022-01-01 is a Saturday, so its week starts on 2021-12-26.
    expect(grid.weeks[0][0].date).toBe("2021-12-26");
    expect(grid.weeks[0][0].inYear).toBe(false);
    expect(cell(grid, "2022-01-01")?.inYear).toBe(true);
  });

  it("keeps the last day of the year and pads the final week", () => {
    const grid = buildYearGrid(2022, [], TODAY);
    const dec31 = cell(grid, "2022-12-31");
    expect(dec31?.inYear).toBe(true);
    // 2022-12-31 is a Saturday — it ends its week with no in-year padding after.
    expect(grid.weeks.at(-1)?.at(-1)?.date).toBe("2022-12-31");
  });

  it("handles leap years", () => {
    expect(cell(buildYearGrid(2024, [], TODAY), "2024-02-29")?.inYear).toBe(true);
  });

  it("has no Feb 29 in a non-leap year", () => {
    const grid = buildYearGrid(2023, [], TODAY);
    expect(cell(grid, "2023-02-29")).toBeUndefined();
    expect(cell(grid, "2023-02-28")?.inYear).toBe(true);
    expect(cell(grid, "2023-03-01")?.inYear).toBe(true);
  });

  it("fills cells binarily — only dates with an entry, only within the year", () => {
    const grid = buildYearGrid(2022, ["2022-01-05", "2021-12-31"], TODAY);
    expect(cell(grid, "2022-01-05")?.filled).toBe(true);
    expect(cell(grid, "2022-01-06")?.filled).toBe(false);
    // A padding day from the previous year is never treated as in-year.
    expect(cell(grid, "2021-12-31")?.inYear).toBe(false);
    expect(cell(grid, "2021-12-31")?.filled).toBe(true);
  });

  it("marks dates after `today` as future", () => {
    const grid = buildYearGrid(2026, [], TODAY);
    expect(cell(grid, "2026-08-27")?.isFuture).toBe(false);
    expect(cell(grid, "2026-08-28")?.isFuture).toBe(true);
    expect(cell(grid, "2026-01-01")?.isFuture).toBe(false);
  });

  it("emits a month label at column 0 and one per month", () => {
    const grid = buildYearGrid(2022, [], TODAY);
    expect(grid.monthLabels[0].column).toBe(0);
    expect(grid.monthLabels.map((l) => l.label)).toEqual([
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]);
  });
});
