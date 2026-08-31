import { describe, expect, it } from "vitest";

import { formatJournalHeading } from "@/lib/time/journal-date";

describe("formatJournalHeading", () => {
  it("formats a date as 'Weekday, Month Ordinal Year'", () => {
    expect(formatJournalHeading("2026-08-31")).toBe("Monday, August 31st 2026");
    expect(formatJournalHeading("2002-01-02")).toBe("Wednesday, January 2nd 2002");
  });

  it("uses the correct ordinal suffix, including the 11–13 exception", () => {
    expect(formatJournalHeading("2022-03-01")).toContain("March 1st");
    expect(formatJournalHeading("2022-03-03")).toContain("March 3rd");
    expect(formatJournalHeading("2022-03-04")).toContain("March 4th");
    expect(formatJournalHeading("2022-03-11")).toContain("March 11th");
    expect(formatJournalHeading("2022-03-12")).toContain("March 12th");
    expect(formatJournalHeading("2022-03-13")).toContain("March 13th");
    expect(formatJournalHeading("2022-03-21")).toContain("March 21st");
    expect(formatJournalHeading("2022-03-23")).toContain("March 23rd");
  });

  it("reads the calendar day in UTC, never shifting with the host timezone", () => {
    // Midnight-UTC Date for 2026-08-31 — must not roll back to the 30th.
    expect(formatJournalHeading(new Date("2026-08-31T00:00:00.000Z"))).toBe(
      "Monday, August 31st 2026",
    );
  });
});
