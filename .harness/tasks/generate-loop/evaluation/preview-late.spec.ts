import { test, expect } from '@playwright/test';
import fs from 'fs';
test('late preview paint', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /示例：/ }).first().click();
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.waitForURL(/\/projects\//);
  const timeline = page.getByTestId('agent-timeline');
  await expect(timeline).toHaveAttribute('data-run-status', 'completed', { timeout: 60000 });
  await page.getByTestId('workbench-tab-preview').click();
  const iframe = page.getByTestId('preview-iframe');
  await expect(iframe).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => ((await iframe.getAttribute('srcdoc')) || '').length).toBeGreaterThan(1000);
  // wait longer for wasm paint
  await page.waitForTimeout(8000);
  const out = '.harness/tasks/generate-loop/evidence/c1-2-browser/workbench-preview-late.png';
  await page.screenshot({ path: out, fullPage: false });
  const box = await iframe.boundingBox();
  if (box) {
    await page.screenshot({
      path: '.harness/tasks/generate-loop/evidence/c1-2-browser/preview-iframe-clip-late.png',
      clip: { x: box.x, y: box.y, width: Math.min(box.width, 900), height: Math.min(box.height, 640) },
    });
  }
  // try frame locator text if same-origin (likely not)
  let frameText = '';
  try { frameText = await iframe.contentFrame()?.locator('body').innerText() || ''; } catch {}
  fs.writeFileSync('.harness/tasks/generate-loop/evidence/c1-2-browser/preview-late.json', JSON.stringify({
    srcdocLen: ((await iframe.getAttribute('srcdoc'))||'').length,
    sandbox: await iframe.getAttribute('sandbox'),
    frameText: (frameText||'').slice(0,200),
    header: await page.locator('header, main').first().innerText().then(t=>t.split('\n').slice(0,6)),
    running: await page.getByText('运行中').count(),
    packaging: await page.getByText('正在打包预览').count(),
  }, null, 2));
});
