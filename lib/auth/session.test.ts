import { describe, expect, it } from "vitest";

import { decideIdleAction } from "@/lib/auth/session";

const MINUTE = 60 * 1000;

describe("decideIdleAction", () => {
  it("does nothing well within the throttle window", () => {
    expect(decideIdleAction(0)).toBe("ok");
    expect(decideIdleAction(MINUTE)).toBe("ok");
  });

  it("touches the session once past the throttle window but still active", () => {
    expect(decideIdleAction(2 * MINUTE + 1)).toBe("touch");
    expect(decideIdleAction(10 * MINUTE)).toBe("touch");
  });

  it("revokes the session once idle past 15 minutes", () => {
    expect(decideIdleAction(15 * MINUTE + 1)).toBe("revoke");
    expect(decideIdleAction(60 * MINUTE)).toBe("revoke");
  });

  it("is exact at the boundaries (idle-for must exceed, not just reach, the limit)", () => {
    expect(decideIdleAction(2 * MINUTE)).toBe("ok");
    expect(decideIdleAction(15 * MINUTE)).toBe("touch");
  });
});
