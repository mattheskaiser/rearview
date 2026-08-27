import { describe, expect, it } from "vitest";

import { buildActivityGrid } from "@/lib/time/activity-grid";

/** Local-time "today" — the function reads local Y/M/D from this Date. */
const TODAY = new Date(2026, 7, 27); // Thu 2026-08-27

const flat = (grid: ReturnType<typeof buildActivityGrid>) =>
  grid.weeks.flat();

const cell = (grid: ReturnType<typeof buildActivityGrid>, date: string) => {
  const found = flat(grid).find((d) => d.date === date);
  if (!found) throw new Error(`no cell for ${date}`);
  return found;
};

describe("buildActivityGrid", () => {
  it("with no entries, spans only the week containing today", () => {
    const grid = buildActivityGrid([], TODAY);
    expect(grid.weeks).toHaveLength(1);
    expect(cell(grid, "2026-08-27").inRange).toBe(true);
    expect(cell(grid, "2026-08-27").filled).toBe(false);
    // Days before today in the same week are padding, not in range.
    expect(cell(grid, "2026-08-25").inRange).toBe(false);
  });

  it("derives the range from the earliest entry through today", () => {
    const grid = buildActivityGrid(["2026-08-10", "2026-08-25"], TODAY);
    expect(cell(grid, "2026-08-10").inRange).toBe(true);
    expect(cell(grid, "2026-08-09").inRange).toBe(false);
    expect(cell(grid, "2026-08-27").inRange).toBe(true);
  });

  it("fills cells binarily — only dates with an entry", () => {
    const grid = buildActivityGrid(["2026-08-10", "2026-08-25"], TODAY);
    expect(cell(grid, "2026-08-10").filled).toBe(true);
    expect(cell(grid, "2026-08-25").filled).toBe(true);
    expect(cell(grid, "2026-08-11").filled).toBe(false);
  });

  it("marks an entry dated today as filled", () => {
    const grid = buildActivityGrid(["2026-08-27"], TODAY);
    expect(cell(grid, "2026-08-27").filled).toBe(true);
    expect(cell(grid, "2026-08-27").inRange).toBe(true);
  });

  it("emits a month label at column 0 and again when the month changes", () => {
    const grid = buildActivityGrid(["2026-07-01"], TODAY);
    expect(grid.monthLabels[0].column).toBe(0);
    const labels = grid.monthLabels.map((l) => l.label);
    expect(labels).toContain("Jul");
    expect(labels).toContain("Aug");
  });
});
