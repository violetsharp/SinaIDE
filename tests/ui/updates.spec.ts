import { test, expect } from "@playwright/test";
test("update installation protects unsaved work and recovers from failed downloads/install", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { mockIPC, mockWindows } =
      await import("/node_modules/@tauri-apps/api/mocks.js");
    window.testCalls = [];
    window.testFailure = "";
    mockWindows("main");
    mockIPC(
      (command, payload) => {
        window.testCalls.push(command);
        if (command === "plugin:updater|check")
          return {
            rid: 17,
            currentVersion: "0.5.0",
            version: "0.5.1",
            rawJson: {},
          };
        if (command === "plugin:updater|download") {
          if (window.testFailure) throw Error(window.testFailure);
          payload.onEvent.onmessage({
            event: "Started",
            data: { contentLength: 100 },
          });
          payload.onEvent.onmessage({
            event: "Progress",
            data: { chunkLength: 100 },
          });
          payload.onEvent.onmessage({ event: "Finished" });
          return 18;
        }
        if (command === "plugin:updater|install")
          throw Error("simulated install failure");
        if (command === "open_workspace")
          return {
            root: "C:/test-update",
            uri: "file:///C:/test-update",
            entries: [
              {
                name: "hello.php",
                path: "hello.php",
                kind: "file",
                hidden: false,
                symlink: false,
              },
            ],
          };
        if (command === "read_text_file")
          return {
            path: "hello.php",
            uri: "file:///C:/test-update/hello.php",
            revision: "original",
            contents: "<?php echo 1; ?>",
          };
        if (command === "write_text_file") return "saved";
      },
      { shouldMockEvents: true },
    );
  });
  await page.getByRole("button", { name: "World ✧", exact: true }).click();
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Install & restart", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.testCalls.includes("plugin:updater|install"),
    ),
  ).toBe(false);
  await page
    .getByRole("button", { name: "Install & restart", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    await page.evaluate(() =>
      window.testCalls.includes("plugin:updater|install"),
    ),
  ).toBe(false);
  await page.locator("#project-path").fill("C:/test-update");
  await page.getByRole("button", { name: "Open path", exact: true }).click();
  await page.locator(".file-row").filter({ hasText: "hello.php" }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible({
    timeout: 30000,
  });
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await page.keyboard.insertText("<?php echo 2; ?>");
  await page.getByRole("button", { name: "World ✧", exact: true }).click();
  await page
    .getByRole("button", { name: "Install & restart", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Install update", exact: true })
    .click();
  await expect(page.locator(".global-message")).toContainText(
    "Save or close your unsaved documents",
  );
  expect(
    await page.evaluate(() =>
      window.testCalls.includes("plugin:updater|install"),
    ),
  ).toBe(false);
  await page.keyboard.press("Control+s");
  await expect(page.locator(".unsaved-dot")).not.toHaveClass(/dirty/);
  await page
    .getByRole("button", { name: "Install & restart", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Install update", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "SinaIDE updates" }),
  ).toContainText("simulated install failure");
  await page.locator(".monaco-editor .view-lines").first().click();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+a" : "Control+a",
  );
  await page.keyboard.insertText("<?php echo 3; ?>");
  await expect(page.locator(".unsaved-dot")).toHaveClass(/dirty/);
  expect(
    await page.evaluate(
      () =>
        window.testCalls.indexOf("prepare_update") <
        window.testCalls.indexOf("plugin:updater|install"),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.testFailure = "signature verification failed";
  });
  await page
    .getByRole("button", { name: "Check for updates", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "SinaIDE updates" }),
  ).toContainText("signature verification failed");
  await expect(
    page.getByRole("button", { name: "Install & restart", exact: true }),
  ).toHaveCount(0);
  console.log(
    "PASS update UI guards: explicit confirmation, dirty documents, install failure recovery, invalid-signature state",
  );
});
