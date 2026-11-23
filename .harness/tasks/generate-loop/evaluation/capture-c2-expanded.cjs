const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:3000');
  await page.getByRole('textbox', { name: /描述你想生成的应用/ }).fill('做一个简洁的待办清单应用');
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  await page.getByTestId('agent-card-engineer').getByText('已完成').waitFor({ timeout: 30000 });
  const planner = page.getByTestId('agent-card-planner');
  await planner.getByRole('button', { name: /展开详情|收起详情/ }).click();
  const payloadVisible = await planner.locator('pre').isVisible();
  const status = await page.getByTestId('agent-timeline').getAttribute('data-run-status');
  await page.screenshot({ path: '.harness/tasks/generate-loop/evidence/c2-20261123-2/workbench-expanded.png', fullPage: true });
  console.log(JSON.stringify({ payloadVisible, status, plannerText: await planner.innerText() }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
