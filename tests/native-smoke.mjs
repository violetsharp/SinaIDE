// Run against a dedicated `tauri dev` test window, never a window containing your own unsaved work.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
const artifactDir = path.resolve(
  process.env.SINAIDE_ARTIFACT_DIR || "test-results/native",
);
await fs.mkdir(artifactDir, { recursive: true });
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "sinaide-smoke-"));
await fs.writeFile(
  path.join(fixture, "index.php"),
  '<?php echo "a little world"; ?>\n<h1>Home</h1>\n',
);
await fs.writeFile(path.join(fixture, "style.css"), "body { color: pink; }\n");
await fs.writeFile(path.join(fixture, "binary.bin"), Buffer.from([0, 1, 2]));
for (const args of [
  ["init"],
  ["config", "user.email", "sinaide-test@example.invalid"],
  ["config", "user.name", "SinaIDE Test"],
])
  execFileSync("git", args, { cwd: fixture, windowsHide: true });
const browser = await chromium.connectOverCDP(
  process.env.SINAIDE_CDP_URL || "http://127.0.0.1:9235",
);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
if (!page) throw Error("Start a dedicated SinaIDE development window first.");
if (await page.locator(".document-tab").count()) {
  const previous = await page.locator(".project-chip small").innerText();
  if (!/sinaide-(smoke|pg)-/.test(previous))
    throw Error("Use a fresh test window without personal documents.");
}
page.on("dialog", (d) => d.accept());
await page.reload();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const owned = new Set();
const invoke = async (command, args = {}) => {
  const result = await page.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
  if (command === "start_process") owned.add(result);
  if (command === "stop_process") owned.delete(args.id);
  return result;
};
const checks = [];
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS", name);
}
const edit = (text) =>
  page.evaluate(async (text) => {
    const { monaco } = await import("/src/Editor.tsx");
    const model = monaco.editor
      .getModels()
      .find((m) => m.uri.path.endsWith("/index.php"));
    if (!model) throw Error("No index.php model");
    model.setValue(text);
  }, text);
try {
  await check("real workspace and Monaco open", async () => {
    await page.locator("#project-path").fill(fixture);
    await page.getByRole("button", { name: "Open path", exact: true }).click();
    await page.locator(".file-row").filter({ hasText: "index.php" }).click();
    await expect(page.locator(".monaco-editor").first()).toBeVisible({
      timeout: 30000,
    });
  });
  await check("editing and atomic save", async () => {
    await edit('<?php echo "saved ✦"; ?>\n');
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() => fs.readFile(path.join(fixture, "index.php"), "utf8"))
      .toBe('<?php echo "saved ✦"; ?>\n');
  });
  await check("external changes preserve disk and unsaved edits", async () => {
    await edit('<?php echo "unsaved"; ?>\n');
    await fs.writeFile(
      path.join(fixture, "index.php"),
      '<?php echo "external"; ?>\n',
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator(".global-message")).toContainText(
      "changed on disk",
    );
    expect(
      await fs.readFile(path.join(fixture, "index.php"), "utf8"),
    ).toContain("external");
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  });
  await check("multiple buffers and close cancellation", async () => {
    await page.locator(".file-row").filter({ hasText: "style.css" }).click();
    await page.getByRole("tab", { name: /index.php/ }).click();
    await page
      .getByRole("button", { name: "Close index.php", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText("unsaved");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("tab", { name: /index.php/ })).toBeVisible();
    await page
      .getByRole("button", { name: "Close index.php", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Discard edits", exact: true })
      .click();
    await expect(page.getByRole("tab", { name: /index.php/ })).toHaveCount(0);
  });
  await check(
    "path boundaries, binary guard, Unicode create rename recovery",
    async () => {
      for (const file of ["../outside", "binary.bin"]) {
        let failed = false;
        try {
          await invoke("read_text_file", { path: file });
        } catch {
          failed = true;
        }
        expect(failed).toBe(true);
      }
      await invoke("create_entry", { path: "新しい", directory: true });
      await invoke("create_entry", { path: "新しい/a.php", directory: false });
      await invoke("rename_entry", {
        path: "新しい/a.php",
        destination: "新しい/b.php",
      });
      const recovery = await invoke("trash_entry", { path: "新しい/b.php" });
      expect(recovery).toContain(".sinaide/");
      expect(await fs.readFile(path.join(fixture, recovery), "utf8")).toBe("");
    },
  );
  await check("native project search", async () => {
    const result = await invoke("search_project", {
      query: "pink",
      caseSensitive: false,
      filenames: false,
      excludes: [],
    });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].path).toBe("style.css");
  });
  await check("Git stage diff commit status", async () => {
    expect(
      (await invoke("git_action", { action: "stage", path: "index.php" })).code,
    ).toBe(0);
    expect(
      (await invoke("git_action", { action: "staged_diff", path: "index.php" }))
        .stdout,
    ).toContain("external");
    expect(
      (
        await invoke("git_action", {
          action: "commit",
          message: "Fixture initial file",
        })
      ).code,
    ).toBe(0);
    expect((await invoke("git_action", { action: "status" })).stdout).toContain(
      "style.css",
    );
  });
  await check("PHP syntax check exit status", async () => {
    const id = await invoke("start_process", {
      executable: "php",
      args: ["-l", "index.php"],
      cwd: "",
      mode: "task",
    });
    let result,
      text = "";
    await expect
      .poll(
        async () => {
          result = await invoke("poll_process", { id });
          text += result.chunks.join("") + result.errors.join("");
          return result.finished;
        },
        { timeout: 10000 },
      )
      .toBe(true);
    expect(result.exitCode).toBe(0);
    expect(text).toContain("No syntax errors");
    await invoke("stop_process", { id });
  });
  await check("real PHP HTTP server and stop", async () => {
    const id = await invoke("start_process", {
      executable: "php",
      args: ["-S", "127.0.0.1:18083", "-t", "."],
      cwd: "",
      mode: "task",
    });
    await expect
      .poll(
        async () => {
          try {
            return (await fetch("http://127.0.0.1:18083")).status;
          } catch {
            return 0;
          }
        },
        { timeout: 10000 },
      )
      .toBe(200);
    expect(await (await fetch("http://127.0.0.1:18083")).text()).toContain(
      "external",
    );
    await invoke("stop_process", { id });
  });
  await check("real PTY input output resize", async () => {
    const id = await invoke("start_process", {
      executable: process.platform === "win32" ? "powershell.exe" : "/bin/zsh",
      args: process.platform === "win32" ? ["-NoLogo", "-NoProfile"] : [],
      cwd: "",
      mode: "terminal",
    });
    await invoke("send_process", {
      id,
      data:
        process.platform === "win32"
          ? 'Write-Output "terminal-working"\r'
          : "echo terminal-working\n",
    });
    let text = "";
    await expect
      .poll(
        async () => {
          const r = await invoke("poll_process", { id });
          text += r.chunks.join("");
          if (r.chunks.join("").includes("\u001b[6n"))
            await invoke("send_process", { id, data: "\u001b[1;1R" });
          return text;
        },
        { timeout: 10000 },
      )
      .toContain("terminal-working");
    await invoke("resize_terminal", { id, cols: 100, rows: 30 });
    await invoke("stop_process", { id });
  });
  await check("personal theme note and keyboard palette", async () => {
    await page.getByRole("button", { name: "World ✧", exact: true }).click();
    await page.getByLabel("Your name or a little nickname").fill("my studio");
    await page.getByLabel("Atmosphere").selectOption("berry");
    await page
      .getByRole("button", { name: "notes", exact: true })
      .last()
      .click();
    await page
      .getByLabel("Personal scratch note")
      .fill("remember the little things");
    await page.keyboard.press("Control+k");
    await page.getByLabel("Search commands").fill("Find in project");
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Find in your project")).toBeVisible();
  });
  await check("update preparation stops owned tools", async () => {
    const server = await import("node:net");
    const reserve = server.createServer();
    await new Promise((resolve) => reserve.listen(0, "127.0.0.1", resolve));
    const port = reserve.address().port;
    await new Promise((resolve) => reserve.close(resolve));
    await invoke("start_process", {
      executable: "php",
      args: ["-S", `127.0.0.1:${port}`, "-t", "."],
      cwd: "",
      mode: "task",
    });
    const reachable = async () => {
      try {
        await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(1500),
        });
        return true;
      } catch {
        return false;
      }
    };
    await expect.poll(reachable, { timeout: 10000 }).toBe(true);
    await invoke("prepare_update");
    await expect.poll(reachable, { timeout: 10000 }).toBe(false);
  });
  expect(errors).toEqual([]);
  await page.screenshot({
    path: path.join(artifactDir, "sinaide-workspace.png"),
  });
} finally {
  for (const id of owned) await invoke("stop_process", { id }).catch(() => {});
  await fs.writeFile(
    path.join(artifactDir, "native-smoke-results.json"),
    JSON.stringify({ fixture, checks, errors }, null, 2),
  );
  await browser.close();
}
