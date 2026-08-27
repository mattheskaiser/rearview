import { describe, expect, it } from "vitest";

import { formatDateInput, parseDateInput } from "@/lib/time/parse-date";

const ymd = (d: Date | null) =>
  d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe("parseDateInput", () => {
  it("parses month-first slash dates", () => {
    expect(ymd(parseDateInput("1/5/2022"))).toBe("2022-1-5");
    expect(ymd(parseDateInput("01/05/2022"))).toBe("2022-1-5");
    expect(ymd(parseDateInput("12/31/2022"))).toBe("2022-12-31");
  });

  it("parses ISO-ish year-first dates", () => {
    expect(ymd(parseDateInput("2024-02-29"))).toBe("2024-2-29");
    expect(ymd(parseDateInput("2022/07/04"))).toBe("2022-7-4");
  });

  it("parses dash-separated month-first dates", () => {
    expect(ymd(parseDateInput("3-4-2021"))).toBe("2021-3-4");
  });

  it("expands two-digit years with a 70 pivot", () => {
    expect(parseDateInput("1/5/69")?.getFullYear()).toBe(2069);
    expect(parseDateInput("1/5/95")?.getFullYear()).toBe(1995);
  });

  it("trims surrounding whitespace", () => {
    expect(ymd(parseDateInput("  1/5/2022  "))).toBe("2022-1-5");
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDateInput("2/30/2022")).toBeNull();
    expect(parseDateInput("2023-02-29")).toBeNull();
    expect(parseDateInput("13/1/2022")).toBeNull();
  });

  it("rejects unrecognized input", () => {
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput("not a date")).toBeNull();
    expect(parseDateInput("5 Jan 2022")).toBeNull();
  });
});

describe("formatDateInput", () => {
  it("renders M/D/YYYY without zero padding", () => {
    expect(formatDateInput(new Date(2022, 0, 5))).toBe("1/5/2022");
    expect(formatDateInput(new Date(2024, 11, 31))).toBe("12/31/2024");
  });

  it("round-trips with parseDateInput", () => {
    const original = new Date(2022, 0, 5);
    expect(ymd(parseDateInput(formatDateInput(original)))).toBe("2022-1-5");
  });
});
