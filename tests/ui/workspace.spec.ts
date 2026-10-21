import { test, expect } from "@playwright/test";
test("update preferences persist and browser preview cannot install updates", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "World ✧", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check for updates", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Check & download updates automatically").uncheck();
  await page.reload();
  await page.getByRole("button", { name: "World ✧", exact: true }).click();
  await expect(
    page.getByLabel("Check & download updates automatically"),
  ).not.toBeChecked();
  await expect(
    page.getByRole("heading", { name: "Make a little something." }),
  ).toBeVisible();
});
test("personal atmosphere, notebook and layout persist across reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Make a little something." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "World ✧", exact: true }).click();
  await page.getByLabel("Your name or a little nickname").fill("moon");
  await page.getByLabel("Atmosphere").selectOption("garden");
  await page.getByLabel("Swap Garden and Observatory").check();
  await page.getByRole("button", { name: "notes", exact: true }).last().click();
  await page.getByLabel("Personal scratch note").fill("a thought to keep");
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("sinaide.world.v1") ?? "{}").note,
      ),
    )
    .toBe("a thought to keep");
  await page.reload();
  await expect(page.locator("main")).toHaveClass(/theme-garden/);
  await expect(page.locator(".eyebrow").first()).toContainText("MOON");
  await page.getByRole("button", { name: "notes", exact: true }).last().click();
  await expect(page.getByLabel("Personal scratch note")).toHaveValue(
    "a thought to keep",
  );
  expect(errors).toEqual([]);
});
test("command palette filters and runs real commands with keyboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search commands").fill("notebook");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Personal scratch note")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Search commands")).toHaveCount(0);
});
test("blocked storage and browser-native errors preserve a usable workspace", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("Blocked");
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".global-message")).toContainText(
    "Preferences could not be saved",
  );
  await page.getByRole("button", { name: "Dismiss", exact: true }).count();
  await page.locator("#project-path").fill("/a/project");
  await page.getByRole("button", { name: "Open path", exact: true }).click();
  await expect(page.locator(".global-message")).toContainText("desktop app");
  await expect(
    page.getByRole("heading", { name: "Make a little something." }),
  ).toBeVisible();
});
test("malformed preferences reset safely and panels fit the viewport", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "sinaide.world.v1",
      '{"version":1,"theme":"oops","gardenWidth":99999,"fontSize":null}',
    ),
  );
  await page.goto("/");
  await expect(page.locator("main")).toHaveClass(/theme-midnight/);
  const box = await page.locator(".editor-window").boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(280);
  await page.getByRole("button", { name: "Toggle quiet workspace" }).click();
  await expect(page.locator(".garden-window")).toBeHidden();
  await page.getByRole("button", { name: "Toggle quiet workspace" }).click();
  await expect(page.locator(".garden-window")).toBeVisible();
});
