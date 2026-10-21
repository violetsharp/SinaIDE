export type BreakpointRule = {
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
};
export type DebugCapabilities = {
  supportsConditionalBreakpoints?: boolean;
  supportsHitConditionalBreakpoints?: boolean;
  supportsLogPoints?: boolean;
  supportsConfigurationDoneRequest?: boolean;
};
export function configuredBreakpoints(
  lines: number[],
  rules: Record<number, BreakpointRule>,
  capabilities: DebugCapabilities,
) {
  return lines.map((line) => {
    const rule = rules[line] ?? {};
    if (rule.condition && !capabilities.supportsConditionalBreakpoints)
      throw Error("This adapter does not support conditional breakpoints.");
    if (rule.hitCondition && !capabilities.supportsHitConditionalBreakpoints)
      throw Error("This adapter does not support hit counts.");
    if (rule.logMessage && !capabilities.supportsLogPoints)
      throw Error("This adapter does not support logpoints.");
    return { line, ...rule };
  });
}
export function debugConfiguration(text: string, root: string) {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw Error("Debug configuration must be an object.");
  return { cwd: root, ...parsed };
}
