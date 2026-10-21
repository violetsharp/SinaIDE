# SinaIDE ✦

> A strange little creative world for making software.

SinaIDE is a personal desktop IDE built around one central idea: **an IDE does not have to look or behave like every other IDE**. It should feel like a tiny world that belongs to its creator—not a corporate tool wearing a colorful theme.

SinaIDE 0.2 is a working desktop development workspace for personal projects, with an initial focus on HTML, CSS, PHP and PostgreSQL. The editor, filesystem, search, terminal, task runner and Git operations are real. It is still an early application: advanced language tooling and debugging need configured external tools, and macOS installation must be validated separately.

## Design manifesto

- **Whimsy is structural.** The personality belongs in the workspace model, navigation, typography, objects, motion, and interactions—not just in accent colors.
- **Experimental, not unusable.** Panels and tools can feel like objects in a personal desktop world while core coding tasks remain legible, accessible, and efficient.
- **Dark and vivid.** Start with dark surfaces, electric accents, and a flexible theme system. Other palettes should be possible without rewriting components.
- **Maximal personality, user-controlled.** Decorative motion and playful details should be configurable, including reduced-motion support.
- **No default IDE template.** Do not silently normalize the interface into a conventional sidebar/editor/bottom-panel layout. Familiar patterns are allowed when useful, not mandatory.
- **Personal by design.** Optimize for a coherent, expressive daily tool rather than generic enterprise software.

## Initial visual concept

The first shell is a little desktop studio with movable objects:

- **File Garden** — project files and navigation
- **Workbench** — the main editing surface
- **Notebook** — space for personal notes and scratch work
- **Inspector** — contextual information
- **Console** — build output and, later, a real integrated terminal
- **World menu** — workspace and appearance controls

The File Garden opens a real folder. The Workbench uses Monaco with separate document buffers, undo/redo and syntax support. The pocket notebook, atmosphere and panel sizes stay on this computer. The Basement starts only the tools you choose. The original studio palette, playful objects, serif headings and local fonts are retained; quiet mode provides more room for code.

## Technology

- **Rust** for native application logic and future filesystem, process, indexing, and language-tool services.
- **Tauri 2** for the desktop shell and a narrow, typed IPC boundary.
- **React + TypeScript + Vite** for the expressive interface.
- **Monaco Editor** provides the code editor, find/replace, undo/redo, syntax and built-in web language tooling.
- **xterm.js + portable-pty** provide real interactive terminal sessions.

Target platforms: **Windows and macOS**. Keep Rust for native work and TypeScript for the UI; no stack migration is needed to improve this workflow.

For the PAP stack, start with [PHP + PostgreSQL setup](docs/PHP_POSTGRES.md). See [Windows and macOS installers](docs/INSTALLERS.md) for setup EXE and universal DMG builds.

## Implementation roadmap and ChatGPT Work

The detailed, phased implementation contract is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). It covers the native folder picker and safe file operations, Monaco, persistent workspace, project search, terminal/process runner, Git, LSP, DAP debugging, diagnostics, testing, security, and acceptance criteria.

When using ChatGPT Work to implement features, start with [docs/CHATGPT_WORK_BRIEF.md](docs/CHATGPT_WORK_BRIEF.md). It tells the agent what to inspect, the project-specific priorities (SinaIDE, Aetherband, and JigsawStudio), how to work incrementally, what not to fake, and what evidence to report. Work one phase at a time and keep changes on a feature branch until reviewed.

## Repository map

```text
src/                       React interface
  App.tsx                  Studio shell and protected document workflow
  main.tsx                 Frontend entry point
  styles.css               Design tokens, objects, and responsive styling
src-tauri/
  Cargo.toml               Rust/Tauri dependencies
  tauri.conf.json          Tauri app configuration
  src/
    lib.rs                 Application setup and command registration
    workspace.rs           Scoped files, revision checks and search
    processes.rs           PTYs, tasks, stdio protocols and Git
    tools.rs               PHP/PostgreSQL tool discovery
    main.rs                Desktop entry point
```

## Run locally

Install a current stable Rust toolchain, Node.js LTS, and the platform prerequisites from the [Tauri 2 prerequisites guide](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
npm run tauri dev
```

Frontend-only preview:

```bash
npm run dev
```

Build a desktop bundle:

```bash
npm run tauri build
```

## Development principles

1. Keep native capabilities in Rust and expose small, explicit commands through Tauri.
2. Keep UI components independent of Tauri so the visual shell can run in a browser during development.
3. Persist workspace layout and theme as versioned data; do not bake positions into individual components.
4. Treat paths and filesystem operations carefully. Add capability permissions deliberately rather than granting broad access by default.
5. Before adopting a dependency, verify its actual upstream license and record the version, source, usage, and obligations.
6. Keep the code editor readable and preserve keyboard workflows even when the surrounding UI is experimental.
7. Add automated checks as the native and frontend layers become functional.

## License and third-party code

SinaIDE's own license has not yet been selected. Do not assume the repository or every dependency is MIT-licensed just because we intend to reuse MIT-licensed components.

Planned candidates must be checked individually before integration. Monaco Editor is MIT-licensed; any bundled assets, fonts, icons, plugins, and transitive dependencies still need their own review. Preserve required copyright and license notices.

See [DEPENDENCIES.md](DEPENDENCIES.md) for the initial reuse policy.

## Current status — 0.2 development build

Implemented:

- Native folder picker, project-relative file tree, refresh and hidden-file control.
- Create files/folders, rename closed documents and put items into a recoverable `.sinaide/` folder. No recursive permanent deletion.
- Rename/removal of symbolic links is refused so these actions cannot accidentally mutate their targets.
- Monaco tabs with independent buffers, view state, syntax, find/replace, undo/redo, save, save all and save a copy.
- Dirty prompts before document close, project switch and native app close. Failed saves preserve edits.
- Atomic file replacement with content-revision checks for external edits. Files must be UTF-8, non-binary and at most 2 MiB. External editors are not locked: a very small final check/replace race remains.
- Search for filenames or literal content with ignore rules, exclusions, cancellation and result/size limits. No external symlink traversal.
- Personal name, notebook, three atmospheres, panel dimensions/side swapping, reduced motion and quiet workspace; versioned preferences with blocked-storage fallback.
- Searchable keyboard command palette. Save, save all, close/next/previous tab and project search shortcuts.
- Multiple real PTY terminals and structured task sessions with output, exit status, timing and stop controls. Argument arrays and a validated working folder; nothing executes on project open.
- PHP server/lint presets, local website preview, PHP/PDO PostgreSQL checks and explicit per-process Windows extension flags; PostgreSQL through `psql` without storing passwords.
- Git status, branch, working/staged diffs, stage/unstage and commit. Hooks are disabled. No destructive Git controls.
- Configurable stdio LSP foundation: diagnostics, hover, plain-text completion and definition navigation. Configurable DAP foundation: launch, breakpoints, stepping, call stack and variables. These require user-installed compatible servers/adapters and are not a promise of verified PHP/Xdebug or universal debugger support.
- Windows NSIS installer and native Windows/macOS CI installer builds. Unsigned development artifacts; no automatic public release or updater.

Not implemented or not fully verified:

- Freely floating/draggable objects (panel size and side arrangement controls are implemented), workspace file watching, crash recovery of unsaved buffers and automatic project reopening.
- Built-in database GUI, PHP/PostgreSQL installation, deployment, Git remote/auth UI, full LSP code actions/references/rename, attach debugging, watch expressions, profiler/sanitizer UI and custom keybinding editor.
- A signed/notarized release, installer upgrade testing and physical macOS smoke tests.

## Validation and development

```sh
npm ci
npm test
npm run build
npm run check:native
npm run test:ui
npm run tauri dev
```

`npm run build` also collects lockfile dependency licenses into `THIRD_PARTY_NOTICES/` for bundling. Browser regression tests cover both normal and compact desktop sizes, persisted preferences, keyboard palette use and blocked storage. Native unit tests cover path boundaries, binary/large files, external-change conflicts, atomic saves and protocol framing. The Windows desktop smoke suite uses a disposable project and installed tools; it does not use your PAP files.

For the optional native smoke suite, launch a **dedicated test window** with WebView2 remote debugging on loopback (development only), then run `npm run test:desktop`. `SINAIDE_CDP_URL` defaults to `http://127.0.0.1:9235`; `SINAIDE_ARTIFACT_DIR` defaults to `test-results/native`. Do not point the test at a window containing personal unsaved work. The optional `node tests/postgres-smoke.mjs` test creates and shuts down its own local PostgreSQL cluster and requires the Windows PostgreSQL tools.

See [verification record](docs/VERIFICATION.md) for exact results and platform boundaries. A sample project's successful test is not validation of an unseen PAP application's configuration.
