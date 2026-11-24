import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

function relativeLuminanceFromLabApprox(labStr) {
  // Prefer canvas-sampled CSS color via browser; this is only a fallback.
  return null;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// E2E-7 + exploratory probes
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await page.waitForSelector('main h1');

const ui = await page.evaluate(() => {
  function sampleContrast(el) {
    const r = el.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    // Use getComputedStyle colors converted via temporary element + canvas fill from computed
    const cs = getComputedStyle(el);
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    // Convert any CSS color to rgb via browser
    const probe = document.createElement('div');
    probe.style.color = cs.color;
    probe.style.backgroundColor = bodyBg;
    document.body.appendChild(probe);
    const pcs = getComputedStyle(probe);
    // Force serialization by assigning to style and reading via canvas
    const fgCanvas = document.createElement('canvas');
    const bgCanvas = document.createElement('canvas');
    fgCanvas.width = bgCanvas.width = 1;
    fgCanvas.height = bgCanvas.height = 1;
    const fctx = fgCanvas.getContext('2d');
    const bctx = bgCanvas.getContext('2d');
    fctx.fillStyle = '#000';
    fctx.fillStyle = pcs.color;
    fctx.fillRect(0,0,1,1);
    bctx.fillStyle = '#fff';
    bctx.fillStyle = bodyBg;
    bctx.fillRect(0,0,1,1);
    const fg = fctx.getImageData(0,0,1,1).data;
    const bg = bctx.getImageData(0,0,1,1).data;
    probe.remove();
    const lin = (c) => {
      const s = c/255;
      return s <= 0.03928 ? s/12.92 : Math.pow((s+0.055)/1.055, 2.4);
    };
    const L = (rgb) => 0.2126*lin(rgb[0]) + 0.7152*lin(rgb[1]) + 0.0722*lin(rgb[2]);
    const L1 = L(fg), L2 = L(bg);
    const lighter = Math.max(L1,L2), darker = Math.min(L1,L2);
    return {
      ratio: (lighter + 0.05) / (darker + 0.05),
      fg: [fg[0],fg[1],fg[2]],
      bg: [bg[0],bg[1],bg[2]],
      fontSize: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
    };
  }

  const h1 = document.querySelector('main h1');
  const eyebrow = document.querySelectorAll('main p')[0];
  const body = document.querySelectorAll('main p')[1];
  return {
    main: !!document.querySelector('main'),
    h1Largest: (() => {
      const sizes = [...document.querySelectorAll('body *')].map(el => ({tag: el.tagName, size: parseFloat(getComputedStyle(el).fontSize)}));
      sizes.sort((a,b)=>b.size-a.size);
      return sizes[0]?.tag === 'H1';
    })(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    contrast: {
      h1: sampleContrast(h1),
      eyebrow: sampleContrast(eyebrow),
      body: sampleContrast(body),
    },
  };
});

// Exploratory: rapid reloads
const reloadTimes = [];
for (let i = 0; i < 5; i++) {
  const t0 = Date.now();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('main h1');
  reloadTimes.push(Date.now() - t0);
}
const h1AfterReloads = await page.locator('main h1').textContent();

// Exploratory: two tabs
const page2 = await context.newPage();
await page2.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
const cookies = await context.cookies();
const deviceCookies = cookies.filter(c => c.name === 'deviceId');
const tab2H1 = await page2.locator('main h1').textContent();

// Exploratory: back/forward
await page.goto('about:blank');
await page.goBack();
await page.waitForSelector('main h1');
const afterBack = await page.locator('main h1').textContent();
await page.goForward();
// may leave home; go home again
await page.goto('http://127.0.0.1:3000/');
await page.waitForSelector('main h1');

// Exploratory: slow network
await page.route('**/*', async (route) => {
  await new Promise(r => setTimeout(r, 200));
  return route.continue();
});
const slowStart = Date.now();
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('main h1');
const slowMs = Date.now() - slowStart;
await page.unroute('**/*');

const evidence = {
  e2e7: ui,
  exploratory: {
    rapidReloads: { count: 5, timesMs: reloadTimes, h1: h1AfterReloads },
    twoTabs: {
      deviceIdCookieCount: deviceCookies.length,
      sameDeviceId: deviceCookies.length === 1,
      tab2H1,
    },
    backNavigation: { h1: afterBack },
    slowNetwork: { reloadMs: slowMs, h1Visible: true },
  },
};

writeFileSync('.harness/tasks/foundation/evaluation/evidence/e2e7-ui.json', JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
