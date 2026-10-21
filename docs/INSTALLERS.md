# Installing SinaIDE on Windows and macOS

For 0.5, use the [public downloads](https://github.com/loveyydoll/SinaIDE-releases/releases) and read [signed updates and release setup](AUTO_UPDATES.md). Updater signatures verify update authenticity; they do not remove operating-system warnings from the current builds, which lack Windows publisher certificates and Apple notarization.

SinaIDE uses one Rust/Tauri + React/TypeScript codebase and builds a native installer for each operating system. A Windows installer cannot install the macOS app, and the macOS DMG cannot install the Windows app.

| Platform | Artifact | Installation | Build host |
|---|---|---|---|
| Windows x64 | NSIS `-setup.exe` | Install for the current user; no machine-wide installation requested | Windows with MSVC build tools |
| macOS Intel + Apple Silicon | Universal `.dmg` containing `SinaIDE.app` | Open the DMG and drag SinaIDE to Applications | macOS with Xcode command-line tools and both Rust targets |

The platform overrides are `src-tauri/tauri.windows.conf.json` and `src-tauri/tauri.macos.conf.json`. Tauri merges the appropriate override with `tauri.conf.json`. The macOS minimum in the current configuration is 12.0. Actual macOS compatibility and installer behavior must be tested on a Mac before claiming support is verified.

## Build locally

Install Node.js, a compatible stable Rust toolchain, and the [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/). From the repository root:

```sh
npm ci
npm test
npm run build
npm run check:native
```

Build the Windows installer **on Windows**:

```sh
npm run tauri build -- --target x86_64-pc-windows-msvc --bundles nsis
```

Output is normally under `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`. The `currentUser` NSIS setting installs to the user's application area. WebView2 is a Tauri runtime prerequisite; the installer handles it according to Tauri's configured/default WebView2 installation mode. MSI could be added later, but it is not the current installer target. See [Tauri's Windows installer guide](https://v2.tauri.app/distribute/windows-installer/).

Build a universal macOS installer **on macOS**:

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri build -- --target universal-apple-darwin --bundles dmg
```

Output is normally under `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`; the app bundle is under the corresponding `bundle/macos/` directory. Universal builds contain both CPU architectures. See [Tauri's DMG guide](https://v2.tauri.app/distribute/dmg/).

## CI artifacts and release status

`.github/workflows/desktop.yml` runs frontend checks, Rust formatting/lint/tests, browser UI tests, and native installer builds on Windows and macOS runners. It can also be started with **Run workflow**. Its uploaded artifacts are labeled **unsigned** development builds. The workflow uploads artifacts for review; it does not publish a public release or merge changes.

Source configuration, a successful local build, a green remote workflow, and an installed application smoke test are different evidence. Inspect the run for the exact commit before saying installers are available. A macOS job passing compilation does not establish that a downloaded DMG launches correctly on both kinds of Mac.

## Signing before ordinary distribution

The current development workflow does not configure signing credentials.

- **Windows:** configure a trusted Authenticode certificate/signing provider through Tauri. Keep private keys and credentials in protected CI secrets or the signing service. Signing identifies the publisher; it does not promise that SmartScreen will never warn. See [Tauri Windows code signing](https://v2.tauri.app/distribute/sign/windows/).
- **macOS:** use a Developer ID Application certificate and Apple's notarization service for normal distribution outside the App Store. Import the certificate into a temporary CI keychain, supply Tauri's signing/notarization environment variables using protected secrets, build, and verify the notarized artifact. Do not commit certificates, passwords or API private keys. See [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/) and the [official signed universal-build example](https://github.com/tauri-apps/tauri-action/blob/dev/examples/publish-to-auto-release-universal-macos-app-with-signing-certificate.yml).

Unsigned local builds are useful for development, but downloaded unsigned artifacts may be blocked or show operating-system warnings. Signing and notarization are separate from any future updater signature. Automatic updating is not implemented.

## What the installer includes

SinaIDE bundles its editor, terminal renderer, UI assets, local fonts and `THIRD_PARTY_NOTICES/` as an application resource. PHP, PostgreSQL, Git, language servers, debug adapters, and other project tools remain external installations. Installing SinaIDE does not create a database or deploy a PAP website. The app can discover common tool paths, and the Basement accepts full executable paths. See [PHP/PostgreSQL setup](PHP_POSTGRES.md).

Before release, include the notices listed in [DEPENDENCIES.md](../DEPENDENCIES.md), verify the installer upgrades without losing settings, test open/save and process shutdown after installation, and record actual Windows and macOS results. No macOS launch verification is claimed by this document.
