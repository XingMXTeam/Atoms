const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:3000');
  await page.getByRole('textbox', { name: /描述你想生成的应用/ }).fill('做一个简洁的待办清单应用');
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  await page.getByTestId('agent-card-engineer').getByText('已完成').waitFor({ timeout: 30000 });
  await page.getByTestId('workbench-tab-code').click();
  const metrics = await page.evaluate(() => [...document.querySelectorAll('[data-testid="code-pane"] *')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => ({ tag: e.tagName, className: String(e.className).slice(0, 100), text: (e.innerText || '').slice(0, 80), clientWidth: e.clientWidth, scrollWidth: e.scrollWidth, overflowX: getComputedStyle(e).overflowX })));
  console.log(JSON.stringify(metrics, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
