export type FileEntry = {
  name: string;
  path: string;
  kind: "directory" | "file";
  hidden: boolean;
  symlink: boolean;
};
export type DiskDocument = {
  path: string;
  contents: string;
  revision: string;
  uri: string;
};
export type Document = DiskDocument & { saved: string };
export type Project = { root: string; uri: string; entries: FileEntry[] };
export type ProcessPoll = {
  chunks: string[];
  errors: string[];
  dropped: boolean;
  finished: boolean;
  exitCode: number | null;
  elapsedMs: number;
};
export type ToolConfig = { executable: string; args: string[]; cwd: string };
export type GitResult = { code: number; stdout: string; stderr: string };
export const dirty = (d: Document) => d.contents !== d.saved;
export function uriIdentity(uri: string) {
  return decodeURIComponent(uri).replace(
    /^file:\/\/\/([A-Z]):/,
    (_, drive: string) => `file:///${drive.toLowerCase()}:`,
  );
}
export function applySave(
  d: Document,
  snapshot: string,
  revision: string,
): Document {
  return { ...d, saved: snapshot, revision };
}
export function parseArgs(text: string): string[] {
  const value: unknown = JSON.parse(text);
  if (
    !Array.isArray(value) ||
    !value.every((v) => typeof v === "string") ||
    value.length > 256
  )
    throw Error("Arguments must be a JSON array of strings.");
  return value;
}
export function parseGitStatus(text: string) {
  const parts = text.split("\0");
  const result: { status: string; path: string; original?: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const status = parts[i].slice(0, 2),
      path = parts[i].slice(3);
    result.push({
      status,
      path,
      original: /[RC]/.test(status) ? parts[++i] : undefined,
    });
  }
  return result;
}
