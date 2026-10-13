import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error("Browser page error:", error));
  page.on("console", (message) => { if (message.type() === "error") console.error("Browser console error:", message.text()); });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText("No saved scenarios in this browser yet.")).toBeVisible();
});

test("calculates, saves, compares, reloads, and reopens scenarios through the local API", async ({ page }) => {
  await page.getByLabel("Scenario name").fill("Baseline");
  await page.getByRole("button", { name: "Calculate production plan" }).click();
  await expect(page.locator("#results-heading")).toHaveText("Recommended production");
  await page.getByRole("button", { name: "Save current scenario" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Baseline” was saved" })).toBeVisible();

  await page.getByLabel(/Orange juice/).fill("30");
  await page.getByLabel("Scenario name").fill("Reduced orange");
  await page.getByRole("button", { name: "Calculate production plan" }).click();
  await expect(page.locator("#results-heading")).toHaveText("Recommended production");
  await page.getByRole("button", { name: "Save current scenario" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reduced orange” was saved" })).toBeVisible();

  await page.getByLabel(/Orange juice/).fill("32");
  await page.getByLabel("Scenario name").fill("Adjusted orange");
  await page.getByRole("button", { name: "Calculate production plan" }).click();
  await expect(page.locator("#results-heading")).toHaveText("Recommended production");
  await page.getByRole("button", { name: "Save current scenario" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Adjusted orange” was saved" })).toBeVisible();

  const comparisonInputs = page.getByRole("table", { name: "Saved planner inputs" });
  await expect(comparisonInputs).toBeVisible();
  const comparisonASelect = page.getByLabel("Scenario A", { exact: true });
  const comparisonBSelect = page.getByLabel("Scenario B", { exact: true });
  await comparisonASelect.selectOption({ label: "Adjusted orange: Ready to compare" });
  await comparisonBSelect.selectOption({ label: "Baseline: Ready to compare" });
  await expect(comparisonInputs.getByRole("row", { name: /Orange available/ })).toContainText("40.000 L");
  await expect(comparisonInputs.getByRole("row", { name: /Orange available/ })).toContainText("32.000 L");
  await expect(comparisonInputs.getByRole("row", { name: /Orange available/ })).toContainText("8.000 L");
  await expect(page.getByRole("img", { name: /Recommended production/ })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Baseline", { exact: true })).toBeVisible();
  await expect(page.getByText("Reduced orange", { exact: true })).toBeVisible();
  await expect(page.getByText("Adjusted orange", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Open" }).first().click();
  await page.getByRole("button", { name: "Open and replace" }).click();
  await expect(page.getByLabel(/Orange juice/)).toHaveValue("40");
  await expect(page.locator("#results-heading")).toHaveText("Recommended production");

  const baseline = page.locator(".saved-scenario-list li").filter({ hasText: "Baseline" });
  await baseline.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("New name for Baseline").fill("Renamed baseline");
  await page.getByRole("button", { name: "Cancel" }).click();
  await baseline.getByRole("button", { name: "Rename" }).click();
  await page.getByLabel("New name for Baseline").fill("Renamed baseline");
  await page.getByRole("button", { name: "Review rename" }).click();
  await page.getByRole("group", { name: "Confirm rename for Baseline" }).getByRole("button", { name: "Confirm rename" }).click();
  const renamedListItem = page.locator(".saved-scenario-list li").filter({ hasText: "Renamed baseline" });
  await expect(renamedListItem).toBeVisible();

  await page.getByLabel(/Orange juice/).fill("35");
  await renamedListItem.getByRole("button", { name: "Update Renamed baseline from current inputs" }).click();
  await page.getByRole("group", { name: "Confirm update for Renamed baseline" }).getByRole("button", { name: "Confirm update" }).click();

  const reducedOrange = page.locator(".saved-scenario-list li").filter({ hasText: "Reduced orange" });
  await reducedOrange.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("group", { name: "Confirm delete for Reduced orange" }).getByRole("button", { name: "Cancel" }).click();
  await reducedOrange.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("group", { name: "Confirm delete for Reduced orange" }).getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Reduced orange", { exact: true })).toHaveCount(0);

  await page.evaluate(() => localStorage.setItem("production-planner:scenarios:v1", JSON.stringify({ schema_version: 1, revision: 4, scenarios: [{}] })));
  await page.reload();
  await expect(page.getByRole("button", { name: "Reset saved collection" })).toBeVisible();
  await page.getByRole("button", { name: "Reset saved collection" }).click();
  await page.getByRole("group", { name: "Confirm saved collection reset" }).getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Reset saved collection" }).click();
  await page.getByRole("group", { name: "Confirm saved collection reset" }).getByRole("button", { name: "Confirm reset" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved collection reset." })).toBeVisible();
});

test("keeps inputs and offers retry after an API failure", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/v1/optimize", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ request_id: "6d8b4960-9d6a-4e4d-94d8-69dc01f0fb8e", error: { code: "CALCULATION_TIMEOUT", message: "Calculation timed out. Please retry." } }),
      });
    } else {
      await route.continue();
    }
  });

  await page.getByLabel(/Orange juice/).fill("32");
  await page.getByRole("button", { name: "Calculate production plan" }).click();
  await expect(page.locator(".form-notice[role='alert']")).toContainText("Calculation timed out");
  await expect(page.getByRole("heading", { name: "Recommended production" })).toHaveCount(0);
  await expect(page.getByLabel(/Orange juice/)).toHaveValue("32");

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.locator("#results-heading")).toHaveText("Recommended production");
  await expect(page.getByLabel(/Orange juice/)).toHaveValue("32");
});

test("offers a storage retry when browser storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "production-planner:scenarios:v1") throw new Error("Storage unavailable");
      return originalGetItem.call(this, key);
    };
  });
  await page.goto("/");
  await expect(page.getByText("Browser storage is unavailable. Your current work is still usable in this tab.")).toBeVisible();
  await page.getByRole("button", { name: "Retry storage" }).click();
  await expect(page.getByText("Browser storage is unavailable. Your current work is still usable in this tab.")).toBeVisible();
});
