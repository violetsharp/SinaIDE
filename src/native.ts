import { invoke } from "@tauri-apps/api/core";
export const isDesktop = () => "__TAURI_INTERNALS__" in window;
export function native<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isDesktop())
    return Promise.reject(
      Error(
        "This action needs the SinaIDE desktop app. Browser preview does not have access to local files or processes.",
      ),
    );
  return invoke<T>(command, args);
}
