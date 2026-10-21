# Third-party dependency and license register

SinaIDE's own license remains undecided. This register does not license the project or assign the same license to every dependency. Versions below were read from `package-lock.json`, `src-tauri/Cargo.lock`, and installed package manifests on 2026-10-21. The lockfiles are authoritative after any dependency update.

## Shipped frontend dependencies and fonts

| Component | Resolved version | Upstream / license | Use and notices |
|---|---|---|---|
| React, React DOM | 19.3.1 each | [React](https://github.com/facebook/react), MIT | UI rendering; retain MIT notices |
| `@tauri-apps/api` | 2.12.4 | [Tauri](https://github.com/tauri-apps/tauri), Apache-2.0 OR MIT | Typed native IPC and window lifecycle |
| `@tauri-apps/plugin-dialog` | 2.8.3 | [Tauri plugins](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog), MIT OR Apache-2.0 | Native folder picker; only explicit dialog permissions |
| `monaco-editor` | 0.57.0 | [Monaco](https://github.com/microsoft/monaco-editor), MIT | Workbench models, editing, syntax and language workers; retain `LICENSE` **and** `ThirdPartyNotices.txt` |
| `dompurify` (Monaco transitive dependency) | **3.4.17** | [DOMPurify](https://github.com/cure53/DOMPurify), MPL-2.0 OR Apache-2.0 | Explicit npm override replaces Monaco's requested 3.4.15; retain upstream license texts. This is a version override, not a local source modification |
| `@xterm/xterm` | 6.0.0 | [xterm.js](https://github.com/xtermjs/xterm.js), MIT | Basement terminal rendering; retain MIT notices |
| `@xterm/addon-fit` | 0.11.0 | [xterm fit addon](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-fit), MIT | Fits the terminal to its panel |
| `@fontsource/dm-sans` | 5.3.0 | [DM Sans](https://github.com/googlefonts/dm-fonts), SIL OFL-1.1 | Local Latin 400/600 font files; retain package `LICENSE` and copyright text |
| `@fontsource/dm-mono` | 5.3.0 | [DM Mono](https://github.com/googlefonts/dm-mono), SIL OFL-1.1 | Local Latin 400 editor/UI font; retain package `LICENSE` and copyright text |
| `@fontsource/fraunces` | 5.3.0 | [Fraunces](https://github.com/undercasetype/Fraunces), SIL OFL-1.1 | Local Latin 500 headings/notebook font; retain package `LICENSE` and copyright text |

Fonts are served from the application bundle rather than Google Fonts. Font files have not been modified. Keep their OFL notices with the distributed app; changing or subsetting fonts later requires reviewing the corresponding OFL terms, including any reserved font names.

## Native dependencies

| Component | Resolved version | Upstream / license | Use |
|---|---|---|---|
| `tauri` | 2.12.4 | [Tauri](https://github.com/tauri-apps/tauri), Apache-2.0 OR MIT | Desktop shell, custom commands, app lifecycle |
| `tauri-build` | 2.7.3 | [Tauri](https://github.com/tauri-apps/tauri), Apache-2.0 OR MIT | Build-time application configuration |
| `tauri-plugin-dialog` | 2.8.3 | [Dialog plugin](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/dialog), Apache-2.0 OR MIT | Native folder picker |
| `rfd` (dialog transitive dependency) | 0.16.0 | [rfd](https://github.com/PolyMeilex/rfd), MIT | Platform file dialogs |
| `serde` | 1.0.229 | [Serde](https://github.com/serde-rs/serde), MIT OR Apache-2.0 | Command serialization |
| `serde_json` | 1.0.154 | [serde_json](https://github.com/serde-rs/json), MIT OR Apache-2.0 | JSON protocol messages |
| `sha2` | 0.10.9 | [RustCrypto](https://github.com/RustCrypto/hashes), MIT OR Apache-2.0 | Saved-content revision hashes |
| `tempfile` | 3.27.0 | [tempfile](https://github.com/Stebalien/tempfile), MIT OR Apache-2.0 | Temporary files for safe writes and tests |
| `ignore` | 0.4.33 | [ripgrep ignore crate](https://github.com/BurntSushi/ripgrep/tree/master/crates/ignore), Unlicense OR MIT | Project search with ignore rules |
| `portable-pty` | 0.9.0 | [WezTerm portable-pty](https://github.com/wezterm/wezterm/tree/main/pty), MIT | Interactive PTY sessions |
| `url` | 2.5.8 | [rust-url](https://github.com/servo/rust-url), MIT OR Apache-2.0 | File URIs |
| `libc` (Unix target) | 0.2.191 | [libc](https://github.com/rust-lang/libc), MIT OR Apache-2.0 | Unix child-process lifecycle |

No upstream source modifications are maintained for these packages. `notify` is not currently a dependency; tree refresh is explicit, and saves check the on-disk revision.

## Development-only direct dependencies

| Component | Resolved version | License |
|---|---|---|
| `@tauri-apps/cli` | 2.12.3 | Apache-2.0 OR MIT |
| TypeScript | 5.7.3 | Apache-2.0 |
| Vite | 6.4.4 | MIT |
| `@vitejs/plugin-react` | 4.7.0 | MIT |
| Prettier | 3.9.10 | MIT |
| Vitest | 5.0.5 | MIT |
| `@playwright/test` | 1.64.1 | Apache-2.0 |
| `@types/node` | 22.20.5 | MIT |
| `@types/react`, `@types/react-dom` | 19.3.0 each | MIT |

## External tools

PHP, PostgreSQL/psql, Git, shells, Composer, Node.js, compilers, language servers, debug adapters and Xdebug are separate installations. SinaIDE invokes tools selected by the user; the installer does not silently install or bundle them. Their licenses and redistribution obligations must be checked separately before any future bundling. See [PHP/PostgreSQL workflow](docs/PHP_POSTGRES.md) and [installer guide](docs/INSTALLERS.md).

## Redistribution checklist

`THIRD_PARTY_NOTICES/` contains the collected npm and Cargo notices plus dependency metadata. Tauri includes that directory as a bundle resource, and CI preserves it alongside installer artifacts. Keep it synchronized with both lockfiles when dependencies change.

- Preserve every required copyright, license, and NOTICE file, including transitive Rust and npm dependencies. This direct dependency register is not a complete software bill of materials.
- Include Monaco's complete `ThirdPartyNotices.txt`, DOMPurify's license texts, xterm's license, and the three font licenses with distributed artifacts.
- Recheck `npm ls dompurify` and the lockfile after Monaco or npm updates so the explicit 3.4.17 override remains effective.
- Review npm audit output and a complete Cargo dependency/license report for each release and target. Passing a vulnerability check is not a license audit.
- Keep required notices available to installer users; retaining notices only in a developer's `node_modules` is insufficient.
- Do not infer licenses for icons, fonts or tools from a parent repository's license.
