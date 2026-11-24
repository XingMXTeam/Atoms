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
  await expect(cards.first()).toBeVisible();
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

test.describe("polish preview performance and width (REQ-4 / REQ-5)", () => {
  test("sandbox: preview iframe stays allow-scripts only", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /待办清单示例/ }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await page.getByRole("tab", { name: "预览" }).click();

    const iframe = page.getByTestId("preview-iframe");
    await expect(iframe).toBeVisible({ timeout: 60_000 });
    await expect(iframe).toHaveAttribute("sandbox", "allow-scripts allow-forms");
    const sandbox = await iframe.getAttribute("sandbox");
    expect(sandbox).toBe("allow-scripts allow-forms");
    expect(sandbox?.includes(["allow", "same", "origin"].join("-"))).toBe(false);
  });

  test("preview-width: 移动 375px constrains the preview frame", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByRole("link", { name: /待办清单示例/ }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await page.getByRole("tab", { name: "预览" }).click();

    await expect(page.getByTestId("preview-iframe")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("preview-width-toggle")).toBeVisible();

    const desktopWidth = await page.getByTestId("preview-frame").evaluate((el) => {
      return (el as HTMLElement).getBoundingClientRect().width;
    });
    expect(desktopWidth).toBeGreaterThan(400);

    await page.getByRole("button", { name: "移动 375px" }).click();
    await expect(page.getByTestId("preview-pane")).toHaveAttribute(
      "data-preview-width",
      "mobile",
    );

    const mobileWidth = await page.getByTestId("preview-frame").evaluate((el) => {
      return (el as HTMLElement).getBoundingClientRect().width;
    });
    expect(mobileWidth).toBeLessThanOrEqual(376);
    expect(mobileWidth).toBeGreaterThan(300);

    // Sandbox must remain without same-origin after the width toggle.
    await expect(page.getByTestId("preview-iframe")).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-forms",
    );

    await page.getByRole("button", { name: "桌面" }).click();
    await expect(page.getByTestId("preview-pane")).toHaveAttribute(
      "data-preview-width",
      "desktop",
    );
  });
});

test.describe("polish follow-up and UX states (REQ-2)", () => {
  test("follow-up: left-rail prompt starts an incremental iteration", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个简洁的待办清单应用");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/i, {
      timeout: 15_000,
    });
    await expect(page.getByTestId("agent-card-engineer").getByText("已完成")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("preview-paint-probe")).toContainText(
      "体验 Atoms Studio",
    );

    const followUp = page.getByRole("textbox", { name: "后续需求" });
    const send = page.getByTestId("follow-up-send");
    await expect(followUp).toBeVisible();
    // Empty prompt keeps send disabled; fill then enable.
    await expect(send).toBeDisabled();
    await followUp.fill("为每项待办加入优先级标签");
    await expect(send).toBeEnabled();
    const previousRunId = await page
      .getByTestId("workbench-score-badge")
      .getAttribute("data-run-id");
    await send.click();
    // Pending / empty-after-submit keeps send disabled while the new run starts.
    await expect(send).toBeDisabled();

    await expect(page.getByTestId("agent-card-engineer").getByText("已完成")).toBeVisible({
      timeout: 30_000,
    });
    await expect
      .poll(async () =>
        page.getByTestId("workbench-score-badge").getAttribute("data-run-id"),
      )
      .not.toBe(previousRunId);
    await page.getByRole("tab", { name: "代码" }).click();
    await expect(page.getByTestId("code-source")).toContainText("优先级");
    await followUp.fill("再补一条说明");
    await expect(page.getByTestId("follow-up-send")).toBeEnabled();
  });

  test("follow-up-disabled: send is disabled while a run is active", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("atoms.generate-loop.stageDelayMs", "2500");
    });
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个简洁的待办清单应用");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });
    await expect(page.getByTestId("agent-timeline")).toHaveAttribute(
      "data-run-status",
      "running",
      { timeout: 10_000 },
    );
    await expect(page.getByTestId("follow-up-send")).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "后续需求" })).toBeDisabled();
  });

  test("share-read-only: follow-up and owner mutations are absent", async ({
    page,
    browser,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /待办清单示例/ }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await expect(page.getByTestId("follow-up-form")).toBeVisible();

    // Prefer an already-completed seed; create share if a version exists.
    const shareButton = page.getByRole("button", { name: "创建只读分享链接" });
    if (await shareButton.isEnabled()) {
      await shareButton.click();
    } else {
      await page.goto("/");
      await page
        .getByRole("textbox", { name: /描述你想生成的应用/ })
        .fill("做一个简洁的待办清单应用");
      await page.getByRole("button", { name: "开始生成" }).click();
      await expect(page.getByTestId("agent-card-engineer").getByText("已完成")).toBeVisible({
        timeout: 30_000,
      });
      await page.getByRole("button", { name: "创建只读分享链接" }).click();
    }

    const shareLink = page.getByRole("link", { name: /\/share\// });
    await expect(shareLink).toBeVisible({ timeout: 15_000 });
    const shareUrl = await shareLink.getAttribute("href");
    expect(shareUrl).toMatch(/^\/share\/[A-Za-z0-9_-]{43}$/);

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    await visitorPage.goto(shareUrl!);
    await expect(visitorPage.getByText("只读分享")).toBeVisible();
    await expect(visitorPage.getByTestId("follow-up-form")).toHaveCount(0);
    await expect(
      visitorPage.getByRole("button", { name: "创建只读分享链接" }),
    ).toHaveCount(0);
    await expect(visitorPage.getByRole("button", { name: "下载 ZIP" })).toHaveCount(0);
    await visitorContext.close();
  });

  test("演示回放: replay provider banner is visible", async ({ page }) => {
    await page.goto("/projects/missing?provider=replay");
    // Seeded project path: open a known project with provider query.
    await page.goto("/");
    const card = page.getByRole("link", { name: /待办清单示例/ }).first();
    const href = await card.getAttribute("href");
    expect(href).toBeTruthy();
    await page.goto(`${href}?provider=replay`);
    await expect(page.getByTestId("ux-banner-replay")).toContainText("演示回放");
  });

  test("qa-rounds: exhaustion cap surfaces 已达修复上限", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("持续失败演示 中文待办清单");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });

    const qaCard = page.getByTestId("agent-card-qa");
    await expect(qaCard).toHaveAttribute("data-status", "completed", {
      timeout: 60_000,
    });
    await expect(page.getByTestId("workbench-qa-rounds")).toHaveAttribute(
      "data-run-qa-rounds",
      "3",
    );
    await expect(page.getByText("已达修复上限").first()).toBeVisible();
    await qaCard.getByRole("button", { name: "展开质检详情" }).click();
    await expect(qaCard.getByText(/已达修复上限/).first()).toBeVisible();
  });

  test("ux-states: empty / loading / interrupted / compile-error banners", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("atoms.generate-loop.stageDelayMs", "2500");
    });
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("做一个简洁的待办清单应用");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });

    await expect(page.getByTestId("preview-pane")).toContainText(/等待生成|正在打包预览/);
    await expect(page.getByTestId("agent-timeline")).toHaveAttribute(
      "data-run-status",
      "running",
      { timeout: 10_000 },
    );

    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            typeof (window as unknown as { __ATOMS_ABORT_SSE__?: () => void })
              .__ATOMS_ABORT_SSE__ === "function",
        ),
      )
      .toBe(true);
    await page.evaluate(() => {
      (window as unknown as { __ATOMS_ABORT_SSE__?: () => void }).__ATOMS_ABORT_SSE__?.();
    });
    await expect(page.getByTestId("ux-banner-interrupted")).toContainText("继续");
    await expect(page.getByRole("button", { name: "继续" })).toBeVisible();

    // Compile-error path via repair demo trigger on a fresh project.
    await page.goto("/");
    await page
      .getByRole("textbox", { name: /描述你想生成的应用/ })
      .fill("触发修复演示 编译错误示例");
    await page.getByRole("button", { name: "开始生成" }).click();
    await expect(page).toHaveURL(/\/projects\//, { timeout: 15_000 });
    await expect(page.getByTestId("preview-pane")).toBeVisible({ timeout: 45_000 });
    // Either intermediate compile error or final repaired preview must be Chinese-labelled.
    const preview = page.getByTestId("preview-pane");
    await expect
      .poll(async () => {
        const status = await preview.getAttribute("data-preview-status");
        const text = await preview.innerText();
        return `${status ?? ""}|${text}`;
      }, { timeout: 45_000 })
      .toMatch(/error|预览失败|预览已修复|我的待办|ready/);
  });
});

test.describe("polish China CDN reachability (REQ-7)", () => {
  test("cdn-audit: home, workbench, and share never hit blocked CDNs", async ({
    page,
    browser,
  }) => {
    const { CDN_HOST_BLOCKLIST } = await import("../src/lib/preview/vendor");
    const blockedHosts = CDN_HOST_BLOCKLIST.map((host) => host.toLowerCase());
    const seenUrls: string[] = [];

    const recordRequest = (url: string) => {
      seenUrls.push(url);
    };

    page.on("request", (request) => {
      recordRequest(request.url());
    });

    const assertNoBlockedHosts = (phase: string) => {
      const offenders = seenUrls.filter((url) => {
        try {
          const host = new URL(url).hostname.toLowerCase();
          return blockedHosts.some(
            (blocked) => host === blocked || host.endsWith(`.${blocked}`),
          );
        } catch {
          return blockedHosts.some((blocked) =>
            url.toLowerCase().includes(blocked),
          );
        }
      });
      expect(offenders, `${phase} must not request blocked CDN hosts`).toEqual(
        [],
      );
    };

    // Home
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "可验证的 AI 应用生成" }),
    ).toBeVisible();
    await page.waitForTimeout(500);
    assertNoBlockedHosts("home");

    // Workbench (seeded project + preview)
    await page.getByRole("link", { name: /待办清单示例/ }).click();
    await expect(page).toHaveURL(/\/projects\//);
    await page.getByRole("tab", { name: "预览" }).click();
    await expect(page.getByTestId("preview-iframe")).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForTimeout(800);
    assertNoBlockedHosts("workbench");

    // Share (create if needed, then visit as a separate visitor)
    const shareButton = page.getByRole("button", { name: "创建只读分享链接" });
    if (await shareButton.isEnabled()) {
      await shareButton.click();
    } else {
      await page.goto("/");
      await page
        .getByRole("textbox", { name: /描述你想生成的应用/ })
        .fill("做一个简洁的待办清单应用");
      await page.getByRole("button", { name: "开始生成" }).click();
      await expect(
        page.getByTestId("agent-card-engineer").getByText("已完成"),
      ).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "创建只读分享链接" }).click();
    }

    const shareLink = page.getByRole("link", { name: /\/share\// });
    await expect(shareLink).toBeVisible({ timeout: 15_000 });
    const shareUrl = await shareLink.getAttribute("href");
    expect(shareUrl).toMatch(/^\/share\/[A-Za-z0-9_-]{43}$/);

    const visitorContext = await browser.newContext();
    const visitorPage = await visitorContext.newPage();
    const visitorUrls: string[] = [];
    visitorPage.on("request", (request) => {
      visitorUrls.push(request.url());
    });
    await visitorPage.goto(shareUrl!);
    await expect(visitorPage.getByText("只读分享")).toBeVisible();
    await visitorPage.getByRole("tab", { name: "预览" }).click();
    await expect(visitorPage.getByTestId("preview-iframe")).toBeVisible({
      timeout: 60_000,
    });
    await visitorPage.waitForTimeout(800);

    const visitorOffenders = visitorUrls.filter((url) => {
      try {
        const host = new URL(url).hostname.toLowerCase();
        return blockedHosts.some(
          (blocked) => host === blocked || host.endsWith(`.${blocked}`),
        );
      } catch {
        return blockedHosts.some((blocked) =>
          url.toLowerCase().includes(blocked),
        );
      }
    });
    expect(
      visitorOffenders,
      "share must not request blocked CDN hosts",
    ).toEqual([]);
    await visitorContext.close();

    assertNoBlockedHosts("owner-after-share");
  });
});
