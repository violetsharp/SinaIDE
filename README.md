# SinalIDE

A strange little room for making software. A personal desktop IDE with a cozy, experimental workspace, designed in Paint and built with Rust, React, TypeScript and Tauri.

SinalIDE is an early, AI-assisted project. Expect rough edges: the features below describe what exists today, and the verification records distinguish tested workflows from unfinished work. Installer and application names currently remain **SinaIDE**.

## Install without building

Download the prebuilt **[0.5.1 development release](https://github.com/violetsharp/SinaIDE/releases/tag/v0.5.1)**:

- **Windows x64:** download `SinaIDE_0.5.1_x64-setup.exe` and run it.
- **macOS:** download `SinaIDE_0.5.1_universal.dmg`, open it and drag the app into Applications. The universal build targets Apple Silicon and Intel, with macOS 12 or later.

You do not need Rust or Node to install. These development installers have no Windows publisher certificate or Apple Developer ID notarization, so operating-system warnings may appear. Hosted packaging checks do not establish physical Mac launch or installed-upgrade coverage.

Find future versions on the [releases page](https://github.com/violetsharp/SinaIDE/releases). Choose an installer asset rather than the source-code ZIP. See [installation guidance](docs/INSTALL_WITHOUT_BUILDING.md) for details.

## Inside the workspace

- **File Garden:** open a local project, browse and manage files, search, and work with Git.
- **Workbench:** edit with Monaco, save with external-revision checks, and protect unsaved documents during close and update actions.
- **Basement:** interactive terminals, process output, custom tasks and locally saved task recipes.
- **Web tools:** PHP discovery, syntax checks, a local development server and preview; PostgreSQL client discovery and an interactive `psql` workflow.
- **Observatory:** configurable external language servers and debug adapters, with breakpoints, stepping, watches and console evaluation. Adapter capabilities determine which breakpoint options are available.
- **Personal space:** notebook, appearance preferences and the existing studio-style navigation.

PHP, PostgreSQL, Git, language servers, debuggers and language runtimes are separate installations. SinalIDE does not bundle a full development toolchain. Start with the [PHP/PostgreSQL guide](docs/PHP_POSTGRES.md).

## Language support

| Level | Languages and formats |
|---|---|
| Built-in Monaco language services | HTML, CSS, JavaScript/JSX, TypeScript/TSX and JSON |
| Syntax highlighting | PHP, PostgreSQL SQL, Rust, C, C++, C#, Python, shell, Markdown, XML and YAML |
| Basic fallback | TOML currently uses INI highlighting; unknown extensions open as plain text |

Recognizing a file does not provide its compiler, runtime or complete IDE integration. PHP has dedicated lint/server presets; SQL work uses an external PostgreSQL client. Richer language features require compatible external servers. Real Python debugging has been exercised with debugpy; PHP/Xdebug remains unverified. Full LSP navigation/editing and broader debugger compatibility are still future work.

## Updates and verification

Every completed change set gets a version bump and a dated [changelog entry](CHANGELOG.md), including small fixes and documentation changes. Main-branch development installers publish after both Windows and macOS desktop jobs pass.

The application also contains signed-updater foundations with version/signature verification and unsaved-document guards. The separate signed distribution channel remains gated; downloading a development installer does not establish working in-app updates. See [update/signing procedures](docs/AUTO_UPDATES.md).

Crash recovery, automatic file watching, an actual installed-version upgrade, physical Mac launches and PHP/Xdebug verification remain outstanding. See the [verification record](docs/VERIFICATION.md) and [release-gate audit](docs/RELEASE_GATE_AUDIT.md) for evidence and limitations.

## Build and contribute

For source development, install Node.js 22, Rust and the platform prerequisites for [Tauri v2](https://v2.tauri.app/start/prerequisites/), then run:

```sh
npm ci
npm run tauri dev
```

Useful checks:

```sh
npm test
npm run test:release
npm run build
npm run check:native
npx playwright install chromium
npm run test:ui
```

The build generates dependency notices and requires Cargo. Native workflow tests need a dedicated disposable project and running development window; read the verification guide before running them. Follow [AGENTS.md](AGENTS.md) for documentation, versioning and release requirements.
