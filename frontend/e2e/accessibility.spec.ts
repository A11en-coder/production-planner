import { expect, test } from "@playwright/test";
import axe from "axe-core";

const viewports = [
  { name: "mobile", width: 360 },
  { name: "tablet", width: 768 },
  { name: "desktop", width: 1280 },
] as const;

type AxeResult = {
  violations: Array<{
    id: string;
    impact: string | null;
    help: string;
    nodes: Array<{ target: string[]; failureSummary?: string }>;
  }>;
};

async function expectNoA11yViolations(page: import("@playwright/test").Page) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async (): Promise<AxeResult> => {
    const axeWindow = window as typeof window & {
      axe: { run: (context: Document, options: { runOnly: string[] }) => Promise<AxeResult> };
    };
    return axeWindow.axe.run(document, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    });
  });

  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

for (const viewport of viewports) {
  test(`accessible planner workflow at ${viewport.width}px (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: 1000 });
    await page.goto("/");
    await expect(page.getByText("No saved scenarios in this browser yet.")).toBeVisible();
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByText("No saved scenarios in this browser yet.")).toBeVisible();

    await expect(page.getByRole("heading", { level: 1, name: "Make every litre count." })).toBeVisible();
    await expect(page.getByLabel(/Orange juice/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Optimize scenario" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Tab from the start of the page until a numeric field receives keyboard focus.
    let reachedField = false;
    for (let index = 0; index < 40; index += 1) {
      await page.keyboard.press("Tab");
      reachedField = await page.getByLabel(/Orange juice/).first().evaluate((input) => input === document.activeElement);
      if (reachedField) break;
    }
    expect(reachedField, "keyboard navigation should reach the first orange availability field").toBe(true);
    const focusStyle = await page.getByLabel(/Orange juice/).first().evaluate((input) => {
      const style = getComputedStyle(input);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    expect(focusStyle.outlineStyle).not.toBe("none");
    expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0);

    const orangeAvailability = page.getByLabel(/Orange juice/).first();
    await orangeAvailability.fill("12.1234");
    await expect(orangeAvailability).toHaveValue("12.1234");
    await page.getByRole("button", { name: "Optimize scenario" }).click();
    await expect(orangeAvailability).toHaveAttribute("aria-invalid", "true");
    const errorIds = (await orangeAvailability.getAttribute("aria-describedby"))?.split(" ") ?? [];
    expect(errorIds.length).toBeGreaterThan(0);
    await expect(page.locator(`#${errorIds.at(-1)}`)).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Optimize scenario" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Calculation complete." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recommended production" })).toBeVisible();
    await expect(page.getByRole("table", { name: /Recommended production and demand-limit status/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /Contribution is input rate/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /Resource use, remaining capacity, and constraint status/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Production by blend/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Contribution by blend/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /Resource utilization/ })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByLabel(/Scenario name/).fill("Baseline");
    await page.getByRole("button", { name: "Save current scenario" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Baseline” was saved" })).toBeVisible();
    await orangeAvailability.fill("30");
    await page.getByLabel(/Scenario name/).fill("Reduced orange");
    await page.getByRole("button", { name: "Optimize scenario" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Calculation complete." })).toBeVisible();
    await page.getByRole("button", { name: "Save current scenario" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Reduced orange” was saved" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Saved planner inputs" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Optimal production and resource use" })).toBeVisible();
    await expect(page.getByRole("img", { name: /^Recommended production\..*scenario A/i })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expectNoA11yViolations(page);
  });
}

test("reflows at a 200%-zoom-equivalent 640px CSS viewport", async ({ page }) => {
  // A 640 CSS-pixel viewport is the layout width produced by 200% zoom on a 1280px display.
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/");
  await expect(page.getByText("No saved scenarios in this browser yet.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.innerWidth === 640)).toBe(true);
  await expect(page.getByLabel(/Orange juice/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Optimize scenario/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
