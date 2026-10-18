# Third-party dependency and license register

This file tracks direct dependencies and planned reuse. Verify the current upstream license and bundled assets before release or redistribution. Transitive dependencies should be reviewed using package-manager license reports.

| Component | Role | License | Status / notes |
|---|---|---|---|
| Tauri 2 | Desktop shell and IPC | MIT or Apache-2.0 (project dual license) | Core foundation |
| React | UI rendering | MIT | Core foundation |
| TypeScript | Type checking | Apache-2.0 | Core foundation |
| Vite | Frontend development/build | MIT | Core foundation |
| Monaco Editor | Code editor | MIT | Planned; not yet integrated |
| Rust crates | Native capabilities | Varies by crate | Review each crate before adoption |

## Reuse rules

- Prefer components with a clear, OSI-approved upstream license; MIT is preferred where it fits.
- Preserve copyright and license notices required by each license.
- Do not copy source files, icons, fonts, or assets based only on the parent project's license.
- Record upstream URL, exact version, license, local modifications, and where a component is used.
- Run a dependency/license audit before packaging a distributable build.
- SinaIDE's own project license is still undecided; this register does not assign one.
