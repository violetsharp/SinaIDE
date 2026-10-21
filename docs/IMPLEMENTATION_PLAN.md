# SinaIDE Implementation Plan

> Implementation contract for ChatGPT Work and other coding agents. Read this before changing code.
>
> Repository: `violetsharp/SinaIDE`  
> Current stack: Tauri 2, Rust, React, TypeScript, Vite.  
> Product identity: an expressive, maximal, experimental creative IDE—not a corporate IDE with a decorative skin.

## Current implementation checkpoint (0.2)

The user requested a broad personal-use IDE build with HTML/CSS/PHP/PostgreSQL as the PAP priority. The `feat/personal-ide-workspace` branch extends the existing filesystem slice and adds the core editor/tools and installers while retaining the studio identity. This checkpoint does not mark every phase below complete.

| Phase | Current evidence / remaining work |
|---|---|
| 0–1 filesystem | Native picker, scoped paths, guarded UTF-8 reads, atomic saves, dirty prompts, create/rename/recovery operations implemented; Windows tests pass. Explicit tree refresh; macOS runtime still unverified. |
| 2 editor | Monaco, models/tabs, view state, dirty/save/close and core editing implemented. No crash recovery for unsaved edits. |
| 3 personal workspace | Notebook, name, three themes, validated settings, panel size/side controls, quiet/reduced motion and searchable command palette implemented. Free dragging remains open. |
| 4 search | Cancellable literal and filename search, ignores/exclusions, previews and limits implemented. Regex and live indexing remain open. |
| 5 tools | Real multi-session PTY and structured tasks implemented; PHP server/lint and PostgreSQL presets. Persistent task configs and full environment editor remain open. |
| 6 Git | Status/branch/diff/stage/unstage/commit implemented; destructive and remote UI operations omitted. |
| 7 LSP | Explicit external stdio server with diagnostics/hover/plain completion/definition; transport failure tests. Real PHP server compatibility, references and richer edits remain open. |
| 8 DAP | Explicit external adapter, launch/breakpoints/stepping/stack/scopes/variables; protocol tests. Actual adapter programs, attach/watch/conditions and PHP Xdebug integration remain unverified. |
| 9 quality | Unit tests, browser regression checks, Windows native/PHP/PostgreSQL smoke and cross-platform CI/installer workflow added. Signed distribution, Mac hardware, profiling and upgrade testing remain open. |

See [VERIFICATION.md](VERIFICATION.md), [PHP_POSTGRES.md](PHP_POSTGRES.md), and [INSTALLERS.md](INSTALLERS.md). Do not describe this checkpoint as every acceptance criterion below being fulfilled.

## Mission

Turn the existing visual prototype into a dependable, usable desktop development environment without flattening its unusual creative identity. Implement features incrementally, validate each slice, preserve the current Tauri/Rust + React/TypeScript architecture unless a concrete technical reason requires a change, and never describe mocked UI as implemented functionality.

The first filesystem-backed workflow is on the `feat/filesystem-workbench` branch / draft PR #2. Treat the actual checked-out code as the source of truth; inspect the branch and existing native commands before implementation.

## Non-negotiable working rules

1. **Inspect first.** Read `README.md`, `DEPENDENCIES.md`, `src/App.tsx`, `src/styles.css`, `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, Tauri capabilities/configuration, and package scripts before coding.
2. **Preserve identity.** Keep the dark, vivid, whimsical, maximalist visual language and the File Garden / Workbench / Notebook / Inspector / Console concepts. Do not replace the interface with a generic VS Code clone.
3. **Implement, don't simulate.** Buttons must perform their advertised action. If a feature is not ready, label it unavailable or leave it out; don't fake filesystem, terminal, Git, or debugger results.
4. **Keep native work in Rust/Tauri.** Use small, typed Tauri commands and explicit permissions. React/TypeScript should own presentation and interaction state, not privileged filesystem or process access.
5. **Secure by default.** Validate paths and inputs, avoid shell-string interpolation, do not grant broad filesystem or process permissions unnecessarily, do not execute project code automatically, and make destructive actions explicit.
6. **No silent data loss.** Track dirty documents, confirm before discarding edits, handle failed writes, and detect or warn about external file modifications before overwriting.
7. **Small, testable increments.** Implement one phase at a time. Keep builds green, update docs and dependency/license records, and report exactly what was and wasn't tested.
8. **No unrelated rewrites.** Avoid rewriting the entire app or changing the tech stack as a side effect of adding a feature.
9. **Accessibility and keyboard use matter.** Add visible focus states, meaningful labels, keyboard navigation, sensible shortcuts, and reduced-motion behavior.
10. **Do not merge to main automatically.** Work on a feature branch and open/update a PR unless the user explicitly asks otherwise.

## Phase 0 — Stabilize the current filesystem slice

Before adding larger features, validate the existing feature branch.

- Run `npm ci` (or the repository's documented package install if lockfile constraints require it).
- Run `npm run build`.
- Run `cargo check` in `src-tauri` and run formatting/lint checks available in the repository.
- Launch `npm run tauri dev` and verify on the user's target OS.
- Test opening a folder, listing and expanding directories, opening text files, editing, dirty indicators, Ctrl+S, and error handling.
- Check Windows paths, Unicode paths/names, large files, unreadable files, directories, and binary files.
- Fix any compilation, runtime, security, or UX regressions before proceeding.
- Add a native folder picker and document safety constraints before broadening file operations.

**Acceptance:** frontend and Rust checks pass; manual smoke tests are recorded; failed operations are visible and do not silently lose edits.

## Phase 1 — Native project/folder picker and safe file operations

### Deliverables
- Native directory picker through a maintained Tauri-compatible dialog plugin or supported API.
- Remember/reopen the current project only if persistence is implemented transparently and safely.
- Add explicit create-file and create-folder actions.
- Add rename and delete actions with confirmation for destructive operations.
- Refresh the tree after file operations and external filesystem changes where practical.
- Sort directories before files; handle hidden files through an intentional UI control.
- Show readable errors for permission failures, invalid paths, and unsupported file types.
- Prevent accidental writes outside the opened project for project-scoped operations. If external paths are supported, clearly distinguish them.
- Keep binary/large-file handling safe: do not load arbitrary large or binary content into a text editor without warning.

### Acceptance
- Users can select a folder using the native dialog.
- Create, rename, and delete operations update the tree correctly.
- Rename/delete cannot silently discard dirty buffers.
- File paths are handled safely on Windows and macOS.
- Plugin and transitive dependency licenses are recorded in `DEPENDENCIES.md`.

## Phase 2 — Real editor with Monaco

### Deliverables
- Integrate the MIT-licensed Monaco Editor and record version/license/source.
- Replace the textarea for code files while preserving the SinaIDE design around it.
- Multiple document tabs with active-tab state, dirty markers, close behavior, and unsaved-change prompts.
- Syntax highlighting based on file extension/language ID.
- Line numbers, indentation, bracket matching, find, replace, undo/redo, and configurable editor font size.
- Correct keyboard shortcuts, including save, close tab, next/previous tab, and find.
- Keep editor state in a document model rather than scattering it across UI components.
- Add a loading state and a reasonable fallback for unsupported file types.
- Avoid loading very large files into Monaco without a size guard or warning.

### Acceptance
- Opening multiple files and switching tabs preserves edits.
- Save writes the correct active document; dirty markers clear only after a successful write.
- Failed saves preserve the buffer and show an actionable error.
- TypeScript type-check/build passes.
- Editor behavior is tested manually and core document-state logic is unit tested if a test runner is added.

## Phase 3 — Workspace objects, persistence, and command palette

### Deliverables
- Make workspace objects/panels movable and resizable without compromising usability.
- Persist layout and theme as versioned data; provide reset-to-default.
- Restore the last workspace only after validating stored state and migration version.
- Add configurable reduced motion and keyboard-accessible panel controls.
- Build a searchable command palette with real commands, categories, keyboard navigation, and shortcuts.
- Make menus functional, not decorative. Include accessible focus and Escape behavior.
- Do not store project file contents or secrets in layout preferences.

### Acceptance
- Layout and theme survive restart, can be reset, and invalid old preferences safely fall back to defaults.
- Core features remain reachable with keyboard-only navigation.
- No decorative control advertises an action that does not work.

## Phase 4 — Project-wide search

### Deliverables
- Search filenames and file contents within the active project.
- Exclude common generated/vendor folders by default (for example `node_modules`, `target`, `.git`, and build output), with user-adjustable exclusions.
- Support case sensitivity, literal text initially, and regular expressions only with safe error handling.
- Show match previews and line numbers; clicking a result opens the file at the match.
- Add cancellation, progress, result limits, and responsive UI for large repositories.
- Keep indexing/search work off the UI thread; use Rust where it materially helps.
- Do not follow symlinks outside the project by default.
- Handle binary files and large files without blocking the UI.

### Acceptance
- Search is cancellable, reports errors, respects exclusions, and doesn't freeze the editor on a medium-sized project.
- Search results lead to the correct file and line.
- No search runs outside the active project unless explicitly requested.

## Phase 5 — Integrated terminal and process runner

### Deliverables
- Implement a real terminal using a maintained PTY solution suitable for Tauri/Rust and the target platforms; evaluate license and maintenance before selecting one.
- Terminal sessions support shell selection, working directory, environment configuration, resize, close/restart, output streaming, and multiple sessions.
- Add a separate task/process runner for structured build/run/test commands.
- Show exit codes, elapsed time, stdout/stderr, cancellation/termination, and clear process status.
- Keep terminal and task runner as separate concepts: an interactive shell is not the same as a configured task.
- Never execute arbitrary commands on project open or app startup.
- Do not interpolate untrusted input into shell strings. Use argument arrays for task execution where possible.
- Ask before launching potentially destructive or privileged operations; explain the working directory and command.
- Make output readable and copyable; provide clear failure states.

### Acceptance
- A user can open a terminal, run a command, see live output, interrupt it, and close the session.
- Task configurations can run build/test commands and report exit status.
- App shutdown handles child processes and PTY sessions cleanly.
- Permissions are narrow, process creation is not exposed to untrusted web content, and no shell command runs automatically.

## Phase 6 — Git integration

### Deliverables
- Detect whether the active project is a Git repository and show branch/status.
- Use a maintained Rust Git library or safe Git CLI integration after documenting the choice and tradeoffs.
- Show changed, staged, untracked, and conflicted files.
- Provide readable diffs and open changed files in the editor.
- Stage and unstage selected files; commit with message validation.
- Fetch/pull/push/branch switching are later subfeatures and must handle authentication without storing credentials in plain text.
- Never discard changes, reset, clean, or overwrite a branch without explicit confirmation.
- Surface Git errors rather than pretending success.
- Keep Git operations cancellable where practical and avoid blocking the UI.

### Acceptance
- Status agrees with the command-line Git result for a test repository.
- Diff content and file paths are correct.
- Stage/unstage/commit work on selected files and report failures.
- Destructive operations require confirmation and preserve unrelated changes.

## Phase 7 — Language tooling (LSP)

### Deliverables
- Add a Language Server Protocol client only after the process manager is robust.
- Support server installation/configuration and detection without silently downloading executables.
- Start with TypeScript/JavaScript and Rust, then add C/C++ and C# according to actual project demand.
- Support diagnostics, go-to-definition, references, hover, completion, and document synchronization.
- Make server lifecycle, logs, crashes, and restart controls visible.
- Keep editor responsive and isolate each language server process.
- Document each server's license, installation method, version support, and platform constraints.

### Acceptance
- Diagnostics and navigation work for a small sample project in each enabled language.
- Missing or crashed servers produce clear guidance and don't crash SinaIDE.
- No language server is installed or executed without user-visible consent.

## Phase 8 — Debugger foundation

Debugging is an adapter integration project, not a request to write debugger engines from scratch.

### Architecture
- A shared debug-session model and UI.
- Debug Adapter Protocol (DAP) client in Rust or TypeScript, with a clearly documented boundary; choose one owner for protocol/session state to avoid duplicated implementations.
- Launch configurations stored as project-local, reviewable configuration with schema validation.
- Debug session lifecycle: launch, attach where supported, pause, continue, step in/over/out, terminate, disconnect.
- Breakpoints, conditional breakpoints where supported, call stack, threads, scopes, variables, watch expressions, debug console, exception information, and adapter logs.
- Adapter discovery/configuration is explicit; never assume an executable exists.
- Do not execute project launch configurations without user action.

### Adapter priority for SinaIDE's own projects
1. **Rust + C/C++:** evaluate CodeLLDB/LLDB first because SinaIDE itself is Rust-based and Aetherband is moving toward C++/JUCE. Add GDB where it adds real platform value.
2. **C#/.NET:** support JigsawStudio's WPF and .NET engine work through a compatible .NET debug adapter.
3. **JavaScript/TypeScript:** support frontend and Node.js tooling. Browser debugging and Node.js Inspector are different targets and need the appropriate integration.
4. Other languages only when requested by actual project use.

### Important constraints
- DAP is a protocol, not a debugger executable. Each adapter has its own installation, supported targets, configuration, and license.
- Verify platform and runtime compatibility before selecting adapters; don't promise universal support.
- Don't bundle external debugger binaries without checking redistribution terms and packaging requirements.
- Avoid running debugger processes with unnecessary privileges.
- Native crash/memory tools (sanitizers, dump analysis, profilers) are separate integrations and can follow the basic debugger.

### Acceptance
- A sample program can be launched with a configured adapter, stopped at a breakpoint, stepped, and inspected.
- Missing adapters and launch errors are explained clearly.
- Session termination cleans up owned processes.
- Tests cover session state and malformed/failed adapter responses where practical.

## Phase 9 — Diagnostics, profiling, and quality

- Add frontend unit tests and Rust tests; add end-to-end smoke tests for critical user workflows.
- Add CI for formatting, type checking, frontend build, Rust checks, and tests.
- Provide actionable logs and diagnostic export that excludes secrets by default.
- Integrate native profilers/sanitizers and crash dumps as optional tools, starting with C/C++ workflows.
- Add settings for font size, keybindings, themes, motion, terminal defaults, and language-tool locations.
- Add a troubleshooting guide and document platform-specific limitations.

## Suggested implementation order

1. Stabilize and validate the current filesystem branch.
2. Native folder picker and safe file/folder operations.
3. Monaco editor + document/tab model.
4. Persistence, command palette, and workspace layout.
5. Project-wide search.
6. Terminal + process/task runner.
7. Git integration.
8. LSP client.
9. DAP debugger foundation.
10. Diagnostics, profiling, and broader test coverage.

A coding agent may parallelize documentation/research, but should not implement every phase in one unreviewable patch. Land one coherent phase per PR, or split phases into small PRs when risk is high.

## Required deliverables for every phase

- Working code, not mock-only UI.
- Appropriate tests or an explicit explanation of why tests cannot reasonably be automated.
- Updated README and relevant docs.
- Updated `DEPENDENCIES.md` for added dependencies, assets, licenses, and notices.
- A concise summary of files changed, commands run, test results, platform coverage, known limitations, and manual test steps.
- A PR with a meaningful title and acceptance checklist.

## Final quality gate

Before claiming a phase is complete:

- [ ] Frontend build/type-check passes.
- [ ] Rust formatting/checks/tests pass when native code changes.
- [ ] Manual smoke test completed on the target platform, or clearly marked unverified.
- [ ] Errors and cancellation are handled.
- [ ] No mocked functionality is presented as real.
- [ ] No secrets, credentials, or project contents are logged unnecessarily.
- [ ] Dependencies and licenses are recorded.
- [ ] README and this plan reflect the actual implementation state.
