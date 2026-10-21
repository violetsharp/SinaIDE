export type Preferences = {
  version: 1;
  theme: "midnight" | "garden" | "berry";
  name: string;
  note: string;
  fontSize: number;
  reducedMotion: boolean;
  focus: boolean;
  gardenWidth: number;
  observatoryWidth: number;
  basementHeight: number;
  swapSides: boolean;
  recent: string[];
};
export const defaults: Preferences = {
  version: 1,
  theme: "midnight",
  name: "",
  note: "remember to leave a little room for the impossible ✷",
  fontSize: 14,
  reducedMotion: false,
  focus: false,
  gardenWidth: 260,
  observatoryWidth: 290,
  basementHeight: 240,
  swapSides: false,
  recent: [],
};
export function validatePreferences(value: unknown): Preferences {
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1
  )
    return { ...defaults };
  const v = value as Partial<Preferences>;
  const num = (n: unknown, d: number, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n)
      ? Math.min(max, Math.max(min, n))
      : d;
  return {
    ...defaults,
    theme: ["midnight", "garden", "berry"].includes(v.theme ?? "")
      ? v.theme!
      : defaults.theme,
    name: typeof v.name === "string" ? v.name.slice(0, 50) : "",
    note: typeof v.note === "string" ? v.note.slice(0, 20000) : defaults.note,
    fontSize: num(v.fontSize, 14, 10, 28),
    gardenWidth: num(v.gardenWidth, 260, 200, 420),
    observatoryWidth: num(v.observatoryWidth, 290, 240, 500),
    basementHeight: num(v.basementHeight, 240, 150, 600),
    reducedMotion: v.reducedMotion === true,
    focus: v.focus === true,
    swapSides: v.swapSides === true,
    recent: Array.isArray(v.recent)
      ? v.recent.filter((s): s is string => typeof s === "string").slice(0, 8)
      : [],
  };
}
export function loadPreferences(): Preferences {
  try {
    return validatePreferences(
      JSON.parse(localStorage.getItem("sinaide.world.v1") || "null"),
    );
  } catch {
    return { ...defaults };
  }
}
