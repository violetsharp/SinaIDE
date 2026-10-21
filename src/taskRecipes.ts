import { parseArgs } from "./types";
export type TaskRecipe = {
  name: string;
  executable: string;
  args: string[];
  cwd: string;
  terminal: boolean;
};
export function readRecipes(root: string): TaskRecipe[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`sinaide.tasks.v1:${root}`) ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (v): v is TaskRecipe =>
          !!v &&
          typeof v === "object" &&
          typeof v.name === "string" &&
          typeof v.executable === "string" &&
          typeof v.cwd === "string" &&
          typeof v.terminal === "boolean" &&
          Array.isArray(v.args) &&
          v.args.every((a: unknown) => typeof a === "string"),
      )
      .slice(0, 20);
  } catch {
    return [];
  }
}
export function makeRecipe(
  name: string,
  executable: string,
  args: string,
  cwd: string,
  terminal: boolean,
): TaskRecipe {
  if (!name.trim() || !executable.trim())
    throw Error("Give your task a name and an executable.");
  return {
    name: name.trim().slice(0, 80),
    executable,
    args: parseArgs(args),
    cwd,
    terminal,
  };
}
