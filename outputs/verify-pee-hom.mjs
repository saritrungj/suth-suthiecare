import {
  chromium,
  expect,
} from "../app/node_modules/@playwright/test/index.mjs";
import { mockPublicApi } from "../app/e2e/helpers/api-mocks.js";
import AxeBuilder from "../app/node_modules/@axe-core/playwright/dist/index.mjs";
const browser = await chromium.launch();
for (const [name, viewport, isMobile] of [
  ["desktop", { width: 1366, height: 900 }, false],
  ["mobile", { width: 393, height: 852 }, true],
  ["small-mobile", { width: 320, height: 740 }, true],
]) {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch: isMobile,
  });
  const page = await context.newPage();
  await mockPublicApi(page);
  await page.addInitScript(() => localStorage.setItem("i18nextLng", "th"));
  await page.goto("http://127.0.0.1:4173/");
  const link = page.getByTestId("ai-chat-button");
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link.locator("img")).toHaveJSProperty("naturalWidth", 256);
  await expect(link).toContainText("คุยกับพี่หอม");
  await expect(link).toContainText("วันนี้เป็นไงบ้าง?");
  const box = await link.boundingBox();
  if (box.x < 0 || box.x + box.width > viewport.width)
    throw new Error("Launcher overflows " + name);
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "ศูนย์ช่วยเหลือ", exact: true }),
  ).toBeFocused();
  await page.mouse.click(2, viewport.height / 2);
  await page.screenshot({ path: `outputs/pee-hom-${name}.png` });
  const a11y = await new AxeBuilder({ page })
    .include(".sut-fab-stack")
    .analyze();
  if (a11y.violations.length) throw new Error(JSON.stringify(a11y.violations));
  await page.waitForTimeout(5100);
  const running = await link.evaluate(
    (el) =>
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === "running").length,
  );
  if (running) throw new Error("Welcome animation did not settle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const motion = await link
    .locator(".sut-fab-mascot__portrait")
    .evaluate((el) => getComputedStyle(el).animationName);
  if (motion !== "none") throw new Error("Reduced motion not respected");
  await page.evaluate(() => window.scrollTo(0, 650));
  const top = page.getByRole("button", { name: "กลับขึ้นด้านบน", exact: true });
  await expect(top).toBeVisible();
  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  if (isMobile)
    await page.getByRole("button", { name: "เปิดเมนู", exact: true }).click();
  await page
    .getByRole("button", { name: "เปลี่ยนภาษาเป็นภาษาอังกฤษ", exact: true })
    .click();
  await expect(link).toContainText("Chat with Pee Hom");
  await expect(link).toHaveAttribute("aria-label", /opens in a new tab/);
  const destination = await link.getAttribute("href");
  await context.route(destination, (route) =>
    route.fulfill({ body: "Synthetic chat destination" }),
  );
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  if (popup.url() !== destination) throw new Error("Chat destination mismatch");
  await popup.close();
  await page.getByRole("button", { name: "Help center", exact: true }).click();
  await expect(page).toHaveURL(/\/help-center$/);
  console.log(
    name +
      ": image, layout, keyboard, accessibility, motion, language and navigation passed",
  );
  await context.close();
}
await browser.close();
