import { describe, expect, it } from "vitest";

import {
  composeEntryText,
  parseComposerCommand,
  undoLastLine,
} from "@/lib/cli/composer";

describe("parseComposerCommand", () => {
  it("recognises commands only when they are the whole line", () => {
    expect(parseComposerCommand("/save")).toBe("save");
    expect(parseComposerCommand("  /S  ")).toBe("save");
    expect(parseComposerCommand("/cancel")).toBe("cancel");
    expect(parseComposerCommand("/undo")).toBe("undo");
    expect(parseComposerCommand("I will /save money this month")).toBeNull();
    expect(parseComposerCommand("")).toBeNull();
  });
});

describe("composeEntryText", () => {
  it("keeps line breaks and blank-line paragraph gaps, trimming the edges", () => {
    expect(composeEntryText(["", "First line", "second line", "", "New paragraph", ""])).toBe(
      "First line\nsecond line\n\nNew paragraph",
    );
  });

  it("returns null when nothing meaningful was written", () => {
    expect(composeEntryText([])).toBeNull();
    expect(composeEntryText(["", "   "])).toBeNull();
  });
});

describe("undoLastLine", () => {
  it("removes the last written line along with trailing blank lines", () => {
    expect(undoLastLine(["a", "b", "", ""])).toEqual(["a"]);
    expect(undoLastLine([])).toEqual([]);
  });
});
