import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
if (process.platform !== "win32")
  throw Error("This optional test uses a Windows PostgreSQL installation.");
const artifactDir = path.resolve(
  process.env.SINAIDE_ARTIFACT_DIR || "test-results/native",
);
await fs.mkdir(artifactDir, { recursive: true });
import { execFileSync } from "node:child_process";
const browser = await chromium.connectOverCDP(
  process.env.SINAIDE_CDP_URL || "http://127.0.0.1:9235",
);
const page = browser.contexts()[0].pages()[0];
const invoke = (command, args = {}) =>
  page.evaluate(
    ({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args),
    { command, args },
  );
const root = await fs.mkdtemp(path.join(os.tmpdir(), "sinaide-pg-"));
const data = path.join(root, "database"),
  log = path.join(root, "postgres.log");
const tools = await invoke("check_web_tools");
console.log({
  php: tools.php,
  psql: tools.psql,
  pdoAlreadyEnabled: tools.phpPostgres,
  hasExtensionDirectory: !!tools.phpExtensionDir,
});
expect(tools.php).toBeTruthy();
expect(tools.psql).toBeTruthy();
const bin = path.dirname(tools.psql);
let server = false;
try {
  execFileSync(
    path.join(bin, "initdb.exe"),
    [
      "-D",
      data,
      "-U",
      "sinaide_test",
      "-A",
      "trust",
      "--encoding=UTF8",
      "--no-locale",
    ],
    { windowsHide: true, stdio: "ignore", timeout: 30000 },
  );
  execFileSync(
    path.join(bin, "pg_ctl.exe"),
    ["-D", data, "-l", log, "-o", "-h 127.0.0.1 -p 18932", "-w", "start"],
    { windowsHide: true, stdio: "ignore", timeout: 30000 },
  );
  server = true;
  await fs.writeFile(
    path.join(root, "index.php"),
    '<?php $db = new PDO("pgsql:host=127.0.0.1;port=18932;dbname=postgres", "sinaide_test"); echo $db->query("SELECT 42 AS answer")->fetchColumn();',
  );
  await invoke("open_workspace", { path: root });
  const flags = tools.phpPostgres
    ? []
    : [
        "-d",
        `extension_dir=${tools.phpExtensionDir}`,
        "-d",
        "extension=pdo_pgsql",
      ];
  let id = await invoke("start_process", {
    executable: tools.php,
    args: [...flags, "index.php"],
    cwd: "",
    mode: "task",
  });
  let output = "",
    result;
  await expect
    .poll(
      async () => {
        result = await invoke("poll_process", { id });
        output += result.chunks.join("") + result.errors.join("");
        return result.finished;
      },
      { timeout: 10000 },
    )
    .toBe(true);
  console.log("PDO query output", output);
  expect(result.exitCode).toBe(0);
  expect(output.trim()).toBe("42");
  await invoke("stop_process", { id });
  id = await invoke("start_process", {
    executable: "psql",
    args: [
      "-X",
      "-P",
      "pager=off",
      "-h",
      "127.0.0.1",
      "-p",
      "18932",
      "-U",
      "sinaide_test",
      "-d",
      "postgres",
      "-c",
      "SELECT 7 AS lucky;",
    ],
    cwd: "",
    mode: "terminal",
  });
  output = "";
  await expect
    .poll(
      async () => {
        result = await invoke("poll_process", { id });
        output += result.chunks.join("");
        if (result.chunks.join("").includes("\u001b[6n"))
          await invoke("send_process", { id, data: "\u001b[1;1R" });
        return output;
      },
      { timeout: 15000 },
    )
    .toContain("lucky");
  expect(output).toContain("7");
  await invoke("stop_process", { id });
  console.log("PASS PHP PDO → real temporary PostgreSQL → query result");
  console.log("PASS native psql discovery and PTY query");
  await fs.writeFile(
    path.join(artifactDir, "postgres-smoke-results.json"),
    JSON.stringify(
      {
        phpPdoQuery: true,
        psqlPtyQuery: true,
        defaultPdoEnabled: tools.phpPostgres,
        systemConfigurationChanged: false,
      },
      null,
      2,
    ),
  );
} finally {
  if (server)
    execFileSync(
      path.join(bin, "pg_ctl.exe"),
      ["-D", data, "-m", "fast", "-w", "stop"],
      { windowsHide: true, stdio: "ignore", timeout: 30000 },
    );
  await browser.close();
}
