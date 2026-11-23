const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:3000');
  await page.evaluate(() => localStorage.setItem('atoms.generate-loop.stageDelayMs', '1200'));
  await page.getByRole('textbox', { name: /描述你想生成的应用/ }).fill('做一个会中断的演示应用');
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  await page.getByTestId('agent-timeline').getByText('规划师').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => typeof window.__ATOMS_ABORT_SSE__ === 'function', { timeout: 15000 });
  await page.evaluate(() => window.__ATOMS_ABORT_SSE__());
  await page.getByRole('button', { name: '继续' }).waitFor({ timeout: 10000 });
  const status = await page.getByTestId('agent-timeline').getAttribute('data-run-status');
  const message = await page.getByTestId('agent-timeline').innerText();
  await page.screenshot({ path: '.harness/tasks/generate-loop/evidence/c2-20261123-2/workbench-interrupted.png', fullPage: true });
  console.log(JSON.stringify({ status, continueVisible: await page.getByRole('button', { name: '继续' }).isVisible(), message }));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
