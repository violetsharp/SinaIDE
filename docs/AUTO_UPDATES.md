# Signed updates and publishing

The installed app checks `https://github.com/loveyydoll/SinaIDE-releases/releases/latest/download/latest.json`. This public repository contains distribution files only; private source and project files are never copied there. Tauri’s official updater verifies each downloaded installer using the public key pinned in `tauri.conf.json`, including the signed version (`requireSignedVersion`). It refuses an invalid signature and will not accept a manifest claiming a different signed version.

Automatic checks/downloads are enabled by default, eight seconds after startup and every four hours. World provides opt-out, retry, download progress and install controls. Unsaved documents or saves in progress block installation. Existing tools close on restart. Updates never run a project command. If an update cannot be fetched, editing stays available.

## Current release procedure

Future publishing is **gated**, at the owner's request. The signing key remains local outside the source checkout; it has not been uploaded to Actions. Never commit or attach this private key. Back it up securely: losing it prevents future updates to existing installations. Its public counterpart is safe to commit.

1. Run desktop checks for the final commit on both platforms. Build the Windows NSIS installer and universal Mac DMG/app archive using the existing desktop workflow.
2. Download the artifacts and verify their GitHub artifact digests. Sign the Windows setup EXE and Mac `.app.tar.gz` locally with the retained key:
   `npm run tauri signer sign -- --private-key-path <private-key-file> --app-version 0.5.0 <artifact>`
3. Gather one EXE, one DMG, one Mac archive and the two `.sig` sidecars in an input folder. Run `node scripts/collect-release.mjs <input> <output> 0.5.0`. This refuses incomplete/ambiguous sets and writes the manifest and SHA-256 sums.
4. Upload all output files to a draft release in the **downloads repository**. Publish only after both platform builds and tests succeed. Do not attach source archives from the private repo. The downloads repo's automatically generated source archives contain only its public readme.
5. Verify the public feed and downloads, and check for updates from an installed build. A complete upgrade test must use an older updater-enabled version; 0.2 cannot update itself.

## Enabling later automation

The `Signed app updates` workflow listens to main pushes, version tags and manual dispatch. With no secrets it reports the gate and skips publishing. It never uses fork/PR secrets. Once configured, both platforms run tests and build before one publishing job creates and then publishes the release. For ordinary main pushes it uses the committed package version. Every completed change set must bump that version, including documentation-only changes (see AGENTS.md and CHANGELOG.md). Stable `vX.Y.Z` tags use that exact version; choose versions newer than all previously published builds. Never overwrite a published version. Concurrency is serialized.

Required Actions secrets in the private source repo:

- `TAURI_SIGNING_PRIVATE_KEY`: the **same** retained key corresponding to the committed public key. Upload only with the owner's explicit authorization. Optional password in `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- `DOWNLOADS_TOKEN`: a fine-grained GitHub token with Contents read/write access **only** to `loveyydoll/SinaIDE-releases`. Do not copy a broad personal credential into this secret. Rotate/revoke it in GitHub when necessary.

## Publisher signing hooks

Update signing is independent from Windows Authenticode and Apple Developer ID/notarization. Until certificates exist, keep release notes explicit about that distinction.

The release build accepts `WINDOWS_SIGN_COMMAND` as an Actions variable using Tauri's custom sign-command convention (`%1` for the file). Configure the chosen provider's credentials and timestamping separately. Do not store passwords inside that variable.

For Apple builds, provide `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, the `APPLE_SIGNING_IDENTITY` variable, and notarization secrets `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. The workflow passes them only to the native build. Verify the resulting signature/notarization with Apple tooling before claiming publisher-verified distribution. No Apple or Windows credentials have been configured for 0.5.

Official references: [Tauri updater](https://v2.tauri.app/plugin/updater/), [Windows signing](https://v2.tauri.app/distribute/sign/windows/), [macOS signing](https://v2.tauri.app/distribute/sign/macos/).

Unsigned development prereleases are published separately in the source repository by the desktop workflow after both platform jobs succeed. They contain manual-install downloads and never write the signed updater feed. See [INSTALL_WITHOUT_BUILDING.md](INSTALL_WITHOUT_BUILDING.md).
