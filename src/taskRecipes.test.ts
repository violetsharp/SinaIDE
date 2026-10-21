import { afterEach, expect, it, vi } from "vitest";
import { makeRecipe, readRecipes } from "./taskRecipes";
afterEach(() => vi.unstubAllGlobals());
it("recovers only validated task recipes and never starts a process", () => {
  const valid = makeRecipe("PHP", "php", '["-S","127.0.0.1:8000"]', "", false);
  const getItem = vi.fn(() =>
    JSON.stringify([valid, { name: "bad", args: "shell" }, null]),
  );
  vi.stubGlobal("localStorage", { getItem });
  expect(readRecipes("/project")).toEqual([valid]);
  expect(getItem).toHaveBeenCalledWith("sinaide.tasks.v1:/project");
  expect(() => makeRecipe("a", "php", '"shell"', "", false)).toThrow();
});
