import { describe, it, expect } from "vitest";
import { configuredBreakpoints, debugConfiguration } from "./debugging";
describe("debug launch and adapter capability boundaries", () => {
  it("keeps attach configurations and explicit cwd without interpreting shell strings", () => {
    expect(
      debugConfiguration('{"processId":123,"cwd":"/app"}', "/root"),
    ).toEqual({ cwd: "/app", processId: 123 });
    expect(() => debugConfiguration("[]", "/root")).toThrow("object");
  });
  it("refuses unsupported conditions instead of silently running unconditionally", () => {
    expect(() =>
      configuredBreakpoints([7], { 7: { condition: "value > 2" } }, {}),
    ).toThrow("conditional");
    expect(() =>
      configuredBreakpoints([7], { 7: { hitCondition: "3" } }, {}),
    ).toThrow("hit counts");
    expect(() =>
      configuredBreakpoints([7], { 7: { logMessage: "value {value}" } }, {}),
    ).toThrow("logpoints");
    expect(
      configuredBreakpoints(
        [7],
        { 7: { condition: "value > 2", logMessage: "{value}" } },
        { supportsConditionalBreakpoints: true, supportsLogPoints: true },
      ),
    ).toEqual([{ line: 7, condition: "value > 2", logMessage: "{value}" }]);
  });
});
