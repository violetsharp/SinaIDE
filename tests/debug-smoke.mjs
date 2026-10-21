// Only run against a dedicated test window with no personal documents. Requires external debugpy.
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import net from "node:net";
const adapter = process.env.SINAIDE_DEBUGPY_ADAPTER;
const python = process.env.SINAIDE_PYTHON;
if (!adapter || !python)
  throw Error(
    "Set SINAIDE_PYTHON and SINAIDE_DEBUGPY_ADAPTER for a disposable test.",
  );
const artifactDir = path.resolve(
  process.env.SINAIDE_ARTIFACT_DIR || "test-results/debug",
);
await fs.mkdir(artifactDir, { recursive: true });
const root = await fs.mkdtemp(
  path.join((await import("node:os")).tmpdir(), "sinaide-debug-"),
);
const program = path.join(root, "garden.py");
await fs.writeFile(
  program,
  "value = 0\nfor i in range(5):\n    value = i * 2\n    print(value)\n",
);
const browser = await chromium.connectOverCDP(
  process.env.SINAIDE_CDP_URL || "http://127.0.0.1:9235",
);
const page = browser
  .contexts()[0]
  .pages()
  .find((p) => p.url().includes("1420"));
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.reload();
await page.locator("#project-path").fill(root);
await page.getByRole("button", { name: "Open path", exact: true }).click();
await page.locator(".file-row").filter({ hasText: "garden.py" }).click();
await expect(page.locator(".monaco-editor").first()).toBeVisible({
  timeout: 30000,
});
const offset = await page.evaluate(async () => {
  const { monaco } = await import("/src/Editor.tsx");
  const e = monaco.editor.getEditors()[0];
  const p = e.getScrolledVisiblePosition({ lineNumber: 4, column: 1 });
  const l = e.getLayoutInfo();
  const b = e.getDomNode().getBoundingClientRect();
  return {
    x: b.x + l.glyphMarginLeft + l.glyphMarginWidth / 2,
    y: b.y + p.top + p.height / 2,
  };
});
await page.mouse.click(offset.x, offset.y);
await page.getByRole("button", { name: "debug", exact: true }).last().click();
const debug = page
  .locator(".project-tools .tool-panel")
  .filter({ has: page.getByLabel("Adapter executable") });
await debug.getByText("Breakpoints & conditions", { exact: true }).click();
await expect(debug.locator(".debug-breakpoint")).toHaveCount(1);
await debug.getByLabel("Condition", { exact: true }).fill("i == 2");
await debug.getByLabel("Adapter executable").fill(python);
await debug
  .getByLabel("Adapter arguments (JSON)")
  .fill(JSON.stringify([adapter]));
await debug
  .getByLabel("Debug configuration")
  .fill(
    JSON.stringify({
      program,
      console: "internalConsole",
      justMyCode: true,
      stopOnEntry: false,
    }),
  );
await debug.getByLabel("Watch expression").fill("value");
await debug.getByRole("button", { name: "Add watch", exact: true }).click();
await debug
  .getByRole("button", { name: "Start debugging", exact: true })
  .click();
await expect(debug.getByRole("status")).toHaveText("Paused", {
  timeout: 30000,
});
await expect(
  debug
    .locator(".variable")
    .filter({
      has: page.getByRole("button", {
        name: "Remove watch value",
        exact: true,
      }),
    }),
).toContainText("4", { timeout: 20000 });
await expect(debug.locator(".debug-breakpoint")).toContainText("verified");
await debug.getByLabel("Debug console", { exact: true }).fill("value + 1");
await debug.getByRole("button", { name: "Evaluate", exact: true }).click();
await expect(debug.locator(".tool-log")).toContainText("\n5", {
  timeout: 10000,
});
console.log(
  "PASS real debugpy launch, conditional breakpoint, variables, watch and console",
);
await debug.getByRole("button", { name: "next", exact: true }).click();
await expect(debug.getByRole("status")).toHaveText("Paused", {
  timeout: 20000,
});
console.log("PASS real step-over");
await debug.getByRole("button", { name: "Stop", exact: true }).click();
await expect(debug.getByRole("status")).toHaveText("Disconnected", {
  timeout: 20000,
});
const server = net.createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await new Promise((r) => server.close(r));
let target;
try {
  await debug.getByLabel("Debug connection").selectOption("attach");
  await debug
    .getByLabel("Debug configuration")
    .fill(
      JSON.stringify({ listen: { host: "127.0.0.1", port }, justMyCode: true }),
    );
  await debug
    .getByRole("button", { name: "Start debugging", exact: true })
    .click();
  await new Promise((r) => setTimeout(r, 1000));
  target = spawn(
    python,
    [
      path.dirname(adapter),
      "--connect",
      `127.0.0.1:${port}`,
      "--wait-for-client",
      program,
    ],
    { cwd: root, stdio: "ignore", windowsHide: true },
  );
  await expect(debug.getByRole("status")).toHaveText("Paused", {
    timeout: 30000,
  });
  await expect(
    debug
      .locator(".variable")
      .filter({
        has: page.getByRole("button", {
          name: "Remove watch value",
          exact: true,
        }),
      }),
  ).toContainText("4", { timeout: 15000 });
  await debug.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(debug.getByRole("status")).toHaveText("Disconnected", {
    timeout: 20000,
  });
  console.log("PASS real debugpy attach, watch and disconnect");
} finally {
  target?.kill();
}
await page.locator(".object-rail button").last().click();
await page.getByLabel("Executable", { exact: true }).fill("php");
await page
  .getByLabel("Arguments (JSON array)", { exact: true })
  .fill('["-l","garden.py"]');
await page.getByLabel("Task name", { exact: true }).fill("a saved recipe");
await page.getByRole("button", { name: "Keep this task", exact: true }).click();
await page.getByLabel("Executable", { exact: true }).fill("different");
await page
  .getByRole("button", { name: "Load a saved recipe", exact: true })
  .click();
await expect(page.getByLabel("Executable", { exact: true })).toHaveValue("php");
expect(errors).toEqual([]);
await fs.writeFile(
  path.join(artifactDir, "debug-verification.json"),
  JSON.stringify(
    {
      adapter: "debugpy 1.8.22",
      launch: true,
      attach: true,
      conditionalBreakpoint: true,
      watch: true,
      console: true,
      stepOver: true,
      taskRecipe: true,
      pageErrors: errors,
    },
    null,
    2,
  ),
);
await page.screenshot({ path: path.join(artifactDir, "debug.png") });
await browser.close();
