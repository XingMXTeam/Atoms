const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const base = 'http://127.0.0.1:3000';
  const out = path.resolve('.harness/tasks/generate-loop/evidence/c2-20261123-2');
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const createRequests = [];
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/projects')) createRequests.push(request.postData());
  });
  const results = { viewport: { width: 1280, height: 800 }, probes: [], screenshots: {}, runtimeRequests: [] };
  page.on('request', request => {
    const url = request.url();
    if (/esm\.sh|unpkg\.com|jsdelivr\.net|cdn\.tailwindcss\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(url)) results.runtimeRequests.push(url);
  });

  await page.goto(base);
  await page.screenshot({ path: path.join(out, 'home.png') });
  const homeMeasurements = await page.evaluate(() => {
    const selector = [...document.querySelectorAll('body *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').length;
    const prompt = document.querySelector('#home-prompt')?.getBoundingClientRect();
    const main = document.querySelector('main')?.getBoundingClientRect();
    return { clippedElements: selector, prompt: prompt && { x: prompt.x, y: prompt.y, width: prompt.width, height: prompt.height }, main: main && { x: main.x, y: main.y, width: main.width, height: main.height }, exampleCards: document.querySelectorAll('button[aria-label^="示例："]').length };
  });
  results.homeMeasurements = homeMeasurements;

  await page.getByRole('textbox', { name: /描述你想生成的应用/ }).fill('做一个简洁的待办清单应用');
  await page.getByRole('button', { name: '开始生成' }).dblclick({ delay: 20 });
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  await page.getByTestId('agent-card-engineer').getByText('已完成').waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(out, 'workbench-timeline.png'), fullPage: true });
  results.screenshots.timelinePath = '.harness/tasks/generate-loop/evidence/c2-20261123-2/workbench-timeline.png';
  const completedStatus = await page.getByTestId('agent-timeline').getAttribute('data-run-status');
  const cardLabels = await page.getByTestId('agent-timeline').locator('[data-testid^="agent-card-"]').allTextContents();
  const clippedTimeline = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible').length);
  await page.getByTestId('workbench-tab-preview').click();
  await page.getByTestId('preview-paint-probe').waitFor({ timeout: 30000 });
  await page.screenshot({ path: path.join(out, 'workbench-preview.png'), fullPage: true });
  results.screenshots.previewPath = '.harness/tasks/generate-loop/evidence/c2-20261123-2/workbench-preview.png';
  const iframeBox = await page.getByTestId('preview-iframe').boundingBox();
  if (iframeBox) await page.screenshot({ path: path.join(out, 'preview-clip.png'), clip: { x: iframeBox.x, y: iframeBox.y, width: Math.min(iframeBox.width, 640), height: Math.min(iframeBox.height, 440) } });
  const previewProbe = await page.getByTestId('preview-paint-probe').innerText();
  const sandbox = await page.getByTestId('preview-iframe').getAttribute('sandbox');
  await page.getByTestId('workbench-tab-code').click();
  await page.screenshot({ path: path.join(out, 'workbench-code.png'), fullPage: true });
  results.screenshots.codePath = '.harness/tasks/generate-loop/evidence/c2-20261123-2/workbench-code.png';
  const codeTree = await page.getByTestId('code-file-tree').innerText();
  const source = await page.getByTestId('code-source').innerText();
  results.probes.push({ id: 'explore-rapid-double-click', result: createRequests.length === 1 ? 'PASS' : 'FAIL', apiCreateRequests: createRequests.length, route: page.url() });
  results.journey = { completedStatus, cardLabels, clippedTimeline, previewProbe, sandbox, codeTree, sourceContainsMock: source.includes('我的待办'), previewClip: results.screenshots.previewPath.replace('workbench-preview.png', 'preview-clip.png') };

  await page.goto(base);
  const longInput = ('应用设计🙂 RTL اختبار אבג ').repeat(45);
  await page.getByRole('textbox', { name: /描述你想生成的应用/ }).fill(longInput);
  const inputLength = await page.getByRole('textbox', { name: /描述你想生成的应用/ }).inputValue();
  await page.getByRole('button', { name: '开始生成' }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}/i, { timeout: 15000 });
  await page.getByTestId('agent-card-engineer').getByText('已完成').waitFor({ timeout: 30000 });
  results.probes.push({ id: 'explore-long-emoji-rtl-input', result: inputLength.length >= 1000 ? 'PASS' : 'FAIL', utf16Length: inputLength.length, routeOpened: page.url() });

  const beforeBack = page.url();
  await page.goBack();
  await page.waitForURL(base + '/', { timeout: 15000 });
  await page.goForward();
  await page.waitForURL(beforeBack, { timeout: 15000 });
  await page.getByTestId('agent-timeline').waitFor({ timeout: 15000 });
  results.probes.push({ id: 'explore-back-forward-after-generation', result: 'PASS', restoredRoute: page.url(), timelineVisible: await page.getByTestId('agent-timeline').isVisible() });

  results.runtimeRequests = [...new Set(results.runtimeRequests)];
  results.apiCreateRequests = createRequests.length;
  results.homeMeasurements.clippedWorkbenchElements = clippedTimeline;
  await fs.writeFile(path.join(out, 'journey-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exitCode = 1; });
