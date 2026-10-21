# ChatGPT Work Brief — Build SinaIDE into a Real IDE

Use this document as the execution brief when handing SinaIDE to ChatGPT Work.

## Repository

`https://github.com/violetsharp/SinaIDE`

## Product goal

Implement SinaIDE as a real Windows/macOS desktop IDE built with Tauri 2, Rust, React, TypeScript, and Vite. The product should feel like a strange, personal, expressive creative world—not a generic corporate IDE. Preserve the existing visual direction and concepts (File Garden, Workbench, Notebook, Inspector, Console) while making every implemented control genuinely functional.

Read these repository files first:
- `README.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `DEPENDENCIES.md`
- `src/App.tsx`
- `src/styles.css`
- `src-tauri/src/lib.rs`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `package.json`

## Instructions

1. Inspect the current default branch, open PRs, and the current filesystem-workbench branch. Do not assume a previous agent's code has been merged or even builds.
2. Start by validating the existing filesystem implementation. Run the frontend build/type check, Rust checks, and available tests. Launch the Tauri app if the environment permits.
3. If the existing branch/PR is not in the working tree, fetch or check out the appropriate branch. Preserve existing work; do not overwrite it with a clean rewrite.
4. Fix compile/runtime issues before adding new features. Record any tests that cannot be run in your environment.
5. Follow `docs/IMPLEMENTATION_PLAN.md` in order. Prioritize the first unfinished phase. Do not attempt all phases as one enormous change.
6. Implement the next coherent phase end-to-end, including UI, native functionality, errors, permissions, tests, docs, and dependency/license review.
7. Use established components/protocols rather than inventing complex infrastructure. Monaco is planned for the editor; LSP is for language intelligence; DAP is for debugger integration. Do not write language debuggers or language servers from scratch.
8. Keep native filesystem/process operations in Rust/Tauri and expose narrow commands. Review Tauri capabilities and CSP before introducing plugins or process access. Do not grant blanket permissions for convenience.
9. Never execute arbitrary project commands automatically. Show commands and working directories, require user action, and confirm destructive operations.
10. Preserve unsaved edits. Add dirty-buffer tracking and external-change protection wherever file writing is involved.
11. Do not make up test results, do not claim unverified functionality works, and do not merge to `main` unless explicitly instructed.
12. Use a dedicated feature branch and create/update a draft PR with an informative title and a checklist of acceptance criteria.
13. Keep changes reviewable. One coherent phase per PR is preferred. If a phase is too large, split it into smaller independently testable PRs.
14. Update `README.md`, `docs/IMPLEMENTATION_PLAN.md`, and `DEPENDENCIES.md` as appropriate so their status always matches the code.

## Priority order

1. Stabilize current filesystem workflow and tests.
2. Native folder picker; create/rename/delete file and folder operations.
3. Monaco Editor and multi-document/tab model.
4. Persistent workspace, themes, and a real command palette.
5. Project-wide file/content search.
6. Integrated terminal and structured process/task runner.
7. Git status, diff, stage/unstage, commit; later safe remote operations.
8. LSP foundation and initial TypeScript/Rust support.
9. DAP debugger foundation: Rust/C++ first, then C#/.NET and JavaScript/TypeScript.
10. Profiling, sanitizers, crash diagnostics, CI, and quality improvements.

## Current user priority and branch

The current user priority is their own HTML/CSS/PHP/PostgreSQL PAP and general personal development. `feat/personal-ide-workspace` extends the filesystem branch with the 0.2 core toolset and installer work. Read the implementation checkpoint and verification record before assuming all roadmap phases are complete. Preserve the comfy personal studio identity. Do not infer that the PAP is Aetherband or JigsawStudio.

## Project-specific language priorities

- **SinaIDE:** Rust + TypeScript/React.
- **Aetherband:** intended C++/JUCE direction; existing Rust history still matters during transition.
- **JigsawStudio:** C#/.NET, WPF, and custom engine/runtime work.

Therefore, do not spend early effort on PHP, Ruby, Go, or Python debugger adapters unless another project requirement appears. Focus debugger work on Rust/C/C++, C#/.NET, and TypeScript/JavaScript.

## Security and reliability requirements

- Treat workspace/project files as untrusted input.
- Do not follow symlinks outside the project by default during search/indexing.
- Do not use shell-string interpolation for process execution; use argument arrays where possible.
- Do not save credentials in plaintext or log secrets.
- Do not bundle external tool binaries without checking their license and redistribution rules.
- Keep child-process lifetimes controlled; terminate owned processes when sessions close.
- Provide cancellation and clear error messages for long-running operations.
- Avoid blocking the UI thread on indexing, terminal output, Git, language servers, or debugger messages.
- Avoid silently overwriting external file changes or discarding dirty buffers.
- Validate all stored workspace settings before applying them.

## What to report at the end of each run

Provide:
- The phase completed and why it was next.
- A concise summary of actual behavior implemented.
- Changed files and important design choices.
- Exact build/test/check commands run and their results.
- Manual test steps and platform coverage.
- Known bugs, limitations, and work deferred.
- New dependencies, upstream links, versions, licenses, and required notices.
- PR link and whether it is draft/open/merged.

Do not stop after writing a plan or adding a mock UI. Deliver a working, tested implementation of the next phase within the available environment. If access or tooling prevents completion, finish the parts that can be completed, explain the blocker precisely, and leave reproducible instructions.

## Definition of done

A phase is complete only when its acceptance criteria in `docs/IMPLEMENTATION_PLAN.md` are met, the code builds (or any unrun build is explicitly called out), relevant tests pass, errors are handled, and documentation matches reality.
