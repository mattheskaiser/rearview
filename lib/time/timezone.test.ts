import { describe, expect, it } from "vitest";

import {
  FALLBACK_TIME_ZONE,
  getZonedParts,
  resolveTimeZone,
  zonedTodayString,
} from "@/lib/time/timezone";

describe("resolveTimeZone", () => {
  it("returns a usable IANA zone (the host's, in this environment)", () => {
    const zone = resolveTimeZone();
    expect(typeof zone).toBe("string");
    // Must not throw when handed back to Intl.
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: zone })).not.toThrow();
  });

  it("exposes Pacific Time as the documented fallback", () => {
    expect(FALLBACK_TIME_ZONE).toBe("America/Los_Angeles");
  });
});

describe("getZonedParts", () => {
  const instant = new Date("2026-03-01T06:30:00Z");

  it("reports wall-clock parts for the given zone", () => {
    expect(getZonedParts(instant, "America/Los_Angeles")).toEqual({
      year: 2026,
      month: 2,
      day: 28,
      hour: 22,
    });
    expect(getZonedParts(instant, "Europe/Berlin")).toEqual({
      year: 2026,
      month: 3,
      day: 1,
      hour: 7,
    });
  });

  it("falls back to Pacific Time for an unknown zone", () => {
    expect(getZonedParts(instant, "Bogus/Zone")).toEqual(
      getZonedParts(instant, FALLBACK_TIME_ZONE),
    );
  });
});

describe("zonedTodayString", () => {
  it("formats the zoned calendar day as YYYY-MM-DD", () => {
    const instant = new Date("2026-08-27T04:00:00Z"); // still Aug 26 in LA
    expect(zonedTodayString(instant, "America/Los_Angeles")).toBe("2026-08-26");
    expect(zonedTodayString(instant, "Europe/Berlin")).toBe("2026-08-27");
  });
});
