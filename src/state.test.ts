import { describe, expect, it } from "vitest";
import { applySave, dirty, parseArgs, parseGitStatus } from "./types";
import { validatePreferences } from "./preferences";
describe("document safety", () => {
  it("keeps edits made while a save was in flight dirty", () => {
    const doc = {
      path: "file.php",
      uri: "file:///file.php",
      contents: "newer edits",
      saved: "original",
      revision: "old",
    };
    const result = applySave(doc, "saved snapshot", "new");
    expect(result.contents).toBe("newer edits");
    expect(result.saved).toBe("saved snapshot");
    expect(result.revision).toBe("new");
    expect(dirty(result)).toBe(true);
  });
  it("clears dirty only for the content actually saved", () => {
    expect(
      dirty(
        applySave(
          {
            path: "a",
            uri: "file:///a",
            contents: "edited",
            saved: "old",
            revision: "old",
          },
          "edited",
          "new",
        ),
      ),
    ).toBe(false);
  });
});
describe("untrusted settings and arguments", () => {
  it("rejects command strings and objects instead of executing shell syntax", () => {
    expect(() => parseArgs('"rm -rf something"')).toThrow();
    expect(() => parseArgs("[1]")).toThrow();
    expect(parseArgs('["a b","$(echo x)"]')).toEqual(["a b", "$(echo x)"]);
  });
  it("validates and bounds stored layout values", () => {
    expect(validatePreferences({ version: 99, theme: "oops" }).theme).toBe(
      "midnight",
    );
    const p = validatePreferences({
      version: 1,
      fontSize: -1,
      gardenWidth: 99999,
      name: "<script>",
      recent: [1, "/my/project"],
    });
    expect(p.fontSize).toBe(10);
    expect(p.gardenWidth).toBe(420);
    expect(p.recent).toEqual(["/my/project"]);
    expect(p.name).toBe("<script>");
  });
  it("parses Git filenames with spaces, newlines, Unicode and rename source", () => {
    expect(parseGitStatus(" M a b.php\0R  новый.php\0old\nname.php\0")).toEqual(
      [
        { status: " M", path: "a b.php", original: undefined },
        { status: "R ", path: "новый.php", original: "old\nname.php" },
      ],
    );
  });
});
