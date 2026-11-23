import { expect, test, type Page } from "@playwright/test";

async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      body: body.scrollWidth - body.clientWidth,
    };
  });
  expect(overflow.doc, "documentElement horizontal overflow").toBeLessThanOrEqual(1);
  expect(overflow.body, "body horizontal overflow").toBeLessThanOrEqual(1);
}

async function assertCardsNotClipped(page: Page) {
  const cards = page.locator('[data-testid="project-card"]');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    await expect(card).toBeVisible();
    const metrics = await card.evaluate((el) => {
      const title = el.querySelector('[data-testid="project-card-title"]');
      if (!(title instanceof HTMLElement)) {
        return { hasTitle: false, clipped: true, overflowX: 0 };
      }
      const titleClipped =
        title.scrollWidth > title.clientWidth + 1 &&
        getComputedStyle(title).textOverflow !== "ellipsis" &&
        getComputedStyle(title).overflow === "visible";
      return {
        hasTitle: true,
        clipped: titleClipped,
        overflowX: el.scrollWidth - el.clientWidth,
        titleText: title.textContent?.trim() ?? "",
      };
    });
    expect(metrics.hasTitle).toBe(true);
    expect((metrics.titleText ?? "").length).toBeGreaterThan(0);
    expect(metrics.clipped, "title must truncate/wrap, not clip").toBe(false);
    expect(metrics.overflowX, "card itself must not scroll horizontally").toBeLessThanOrEqual(
      1,
    );
  }
}

test.describe("polish visual system (REQ-1 / REQ-3)", () => {
  test("visual-system: Chinese shell tokens and calm card surfaces", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "可验证的 AI 应用生成" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "我的项目" })).toBeVisible();

    const tokenCheck = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const body = getComputedStyle(document.body);
      return {
        background: root.getPropertyValue("--background").trim(),
        foreground: root.getPropertyValue("--foreground").trim(),
        focusRing:
          root.getPropertyValue("--focus-ring").trim() ||
          body.getPropertyValue("--atoms-focus-ring").trim() ||
          body.getPropertyValue("--focus-ring").trim(),
        radius:
          root.getPropertyValue("--radius-card").trim() ||
          body.getPropertyValue("--atoms-radius-card").trim() ||
          body.getPropertyValue("--radius-card").trim(),
      };
    });
    expect(tokenCheck.background.length).toBeGreaterThan(0);
    expect(tokenCheck.foreground.length).toBeGreaterThan(0);
    expect(tokenCheck.focusRing.length).toBeGreaterThan(0);
    expect(tokenCheck.radius.length).toBeGreaterThan(0);

    await expect(page.getByTestId("project-card").first()).toBeVisible();
    await expect(page.locator(".atoms-running-pulse")).toHaveCount(0);
  });

  test("reduced-motion: decorative tab/timeline/pulse animations stop", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("link", { name: /待办清单示例|专注计时器示例/ }).first().click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i);

    await page.getByRole("tab", { name: "代码" }).click();
    await page.getByRole("tab", { name: "预览" }).click();

    const motion = await page.evaluate(() => {
      const samples = [
        ...document.querySelectorAll(
          ".atoms-running-pulse, .atoms-tab-btn, .atoms-expand-panel, [data-motion]",
        ),
      ] as HTMLElement[];
      return samples.map((el) => {
        const style = getComputedStyle(el);
        return {
          animation: style.animationName,
          animationDuration: style.animationDuration,
          transitionDuration: style.transitionDuration,
        };
      });
    });

    for (const item of motion) {
      const durations = `${item.animationDuration} ${item.transitionDuration}`;
      expect(durations.includes("0s") || item.animation === "none").toBe(true);
    }

    // Inject a running-pulse marker to assert the reduced-motion kill switch.
    const pulseDuration = await page.evaluate(() => {
      const el = document.createElement("span");
      el.className = "atoms-running-pulse";
      document.body.appendChild(el);
      const duration = getComputedStyle(el).animationDuration;
      el.remove();
      return duration;
    });
    expect(pulseDuration === "0s" || pulseDuration === "0s, 0s").toBeTruthy();
  });

  test("card-clip: 我的项目 cards stay readable at 1280 and 375", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await assertCardsNotClipped(page);
    await assertNoPageOverflow(page);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await assertCardsNotClipped(page);
    await assertNoPageOverflow(page);
  });

  test("no-page-overflow: home and workbench at 1280 and 375", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await assertNoPageOverflow(page);

      await page.getByRole("link", { name: /待办清单示例/ }).click();
      await expect(page).toHaveURL(/\/projects\//);
      await assertNoPageOverflow(page);

      await page.getByRole("tab", { name: "代码" }).click();
      await expect(page.getByTestId("code-pane")).toBeVisible();
      await assertNoPageOverflow(page);

      // Long lines remain reachable inside the code pane (scroll or wrap).
      const codeReachable = await page.getByTestId("code-source").evaluate((el) => {
        const style = getComputedStyle(el);
        const canScroll = el.scrollWidth > el.clientWidth;
        const wraps =
          style.whiteSpace.includes("pre-wrap") ||
          style.overflowWrap === "anywhere" ||
          style.overflowWrap === "break-word";
        return canScroll || wraps || el.textContent?.length === 0;
      });
      expect(codeReachable).toBe(true);
    }
  });

  test("a11y: focus-visible rings and keyboard reach primary controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    const prompt = page.getByRole("textbox", { name: /描述你想生成的应用/ });
    await prompt.fill("做一个简洁的待办清单应用");
    const submit = page.getByRole("button", { name: "开始生成" });
    await prompt.focus();
    await page.keyboard.press("Tab");
    await expect(submit).toBeFocused();
    const submitRing = await submit.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
      };
    });
    const hasRing =
      (submitRing.outlineStyle !== "none" && submitRing.outlineWidth !== "0px") ||
      submitRing.boxShadow !== "none";
    expect(hasRing).toBe(true);

    await page.getByRole("link", { name: /待办清单示例/ }).click();
    await expect(page).toHaveURL(/\/projects\//);

    // Keyboard Tab (not element.focus) so :focus-visible rings apply.
    await page.locator("body").focus();
    let reachedCodeTab = false;
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      const focusedName = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute("role") === "tab" ? el.textContent?.trim() ?? "" : "";
      });
      if (focusedName === "代码") {
        reachedCodeTab = true;
        break;
      }
    }
    expect(reachedCodeTab).toBe(true);
    const tabRing = await page.getByRole("tab", { name: "代码" }).evaluate((el) => {
      const style = getComputedStyle(el);
      return (
        (style.outlineStyle !== "none" && style.outlineWidth !== "0px") ||
        style.boxShadow !== "none"
      );
    });
    expect(tabRing).toBe(true);
    expect(
      await page.getByRole("tab", { name: "代码" }).evaluate((el) =>
        el.classList.contains("atoms-focus-ring"),
      ),
    ).toBe(true);

    await page.getByRole("tab", { name: "预览" }).click();
    await expect(page.getByTestId("preview-iframe")).toHaveAttribute(
      "title",
      "应用预览",
    );
    await expect(page.getByRole("tablist", { name: "预览与代码" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
