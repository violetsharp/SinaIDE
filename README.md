# SinaIDE ✦

> A strange little creative world for making software.

SinaIDE is a personal desktop IDE built around one central idea: **an IDE does not have to look or behave like every other IDE**. It should feel like a tiny world that belongs to its creator—not a corporate tool wearing a colorful theme.

The project is at an early foundation/prototype stage. The current goal is to build a distinctive desktop shell and a modular architecture that can grow into a genuinely useful development environment.

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

The first prototype uses illustrative sample content so the visual system can be explored before all IDE features are wired up. Mock UI is not to be described as functional filesystem/editor/terminal integration.

## Technology

- **Rust** for native application logic and future filesystem, process, indexing, and language-tool services.
- **Tauri 2** for the desktop shell and a narrow, typed IPC boundary.
- **React + TypeScript + Vite** for the expressive interface.
- **Monaco Editor** is a planned MIT-licensed editor component; it is not yet integrated in the initial shell.

Target platforms: **Windows and macOS**.

## Repository map

```text
src/                       React interface
  App.tsx                  Initial desktop workspace
  main.tsx                 Frontend entry point
  styles.css               Design tokens, objects, and responsive styling
src-tauri/
  Cargo.toml               Rust/Tauri dependencies
  tauri.conf.json          Tauri app configuration
  src/
    lib.rs                 Native commands and application setup
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

## Current status

**Foundation prototype — in progress.**

- [x] Initial product and design direction documented
- [x] Tauri 2 + Rust + React + TypeScript scaffold
- [x] First expressive desktop-shell prototype
- [ ] Real project picker and filesystem-backed File Garden
- [ ] Monaco editor integration and document saving
- [ ] Persistent, draggable/resizable workspace objects
- [ ] Real terminal/process integration
- [ ] Theme switching and persisted preferences
- [ ] LSP, search, and Git integrations

The checked items describe the starter scaffold, not a release-ready IDE.
