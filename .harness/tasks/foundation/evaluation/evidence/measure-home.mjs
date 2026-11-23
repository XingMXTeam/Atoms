import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fg, bg) {
  const L1 = luminance(fg);
  const L2 = luminance(bg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await page.waitForSelector('main h1');

const metrics = await page.evaluate(() => {
  const h1 = document.querySelector('main h1');
  const paragraphs = [...document.querySelectorAll('main p')];
  const eyebrow = paragraphs[0];
  const body = paragraphs[1];
  const main = document.querySelector('main');
  const html = document.documentElement;

  const clipped = [...document.querySelectorAll('body *')].filter(
    (e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible',
  ).length;

  const overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;

  function box(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      text: (el.textContent || '').trim().slice(0, 160),
      fontSize: parseFloat(cs.fontSize),
      fontWeight: cs.fontWeight,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      centerX: r.left + r.width / 2,
    };
  }

  const texts = [...document.querySelectorAll('body *')].map((el) => ({
    tag: el.tagName,
    size: parseFloat(getComputedStyle(el).fontSize),
  }));
  texts.sort((a, b) => b.size - a.size);

  return {
    lang: html.lang,
    title: document.title,
    clippedCount: clipped,
    horizontalOverflow: overflowX,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    bodyBg: getComputedStyle(document.body).backgroundColor,
    main: box(main),
    eyebrow: box(eyebrow),
    h1: box(h1),
    body: box(body),
    landmarkMain: !!main,
    largestTextIsH1: texts[0]?.tag === 'H1',
    featureGridCount: document.querySelectorAll('[class*="grid"]').length,
    gradientMeshLike: getComputedStyle(document.body).backgroundImage !== 'none',
  };
});

const bodyBg = parseRgb(metrics.bodyBg) || [255, 255, 255];
const h1Color = parseRgb(metrics.h1?.color || '') || [0, 0, 0];
const eyebrowColor = parseRgb(metrics.eyebrow?.color || '') || [0, 0, 0];
const bodyColor = parseRgb(metrics.body?.color || '') || [0, 0, 0];

metrics.contrast = {
  h1: contrast(h1Color, bodyBg),
  eyebrow: contrast(eyebrowColor, bodyBg),
  body: contrast(bodyColor, bodyBg),
};

const vw = metrics.viewport.w;
metrics.centering = {
  h1OffsetFromCenter: Math.abs((metrics.h1?.centerX || 0) - vw / 2),
  eyebrowOffsetFromCenter: Math.abs((metrics.eyebrow?.centerX || 0) - vw / 2),
};

await page.screenshot({ path: '.harness/tasks/foundation/evaluation/evidence/home.png', fullPage: false });

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
await mobile.waitForSelector('main h1');
const mobileMetrics = await mobile.evaluate(() => ({
  clippedCount: [...document.querySelectorAll('body *')].filter(
    (e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible',
  ).length,
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  h1: document.querySelector('main h1')?.textContent?.trim(),
}));
await mobile.screenshot({ path: '.harness/tasks/foundation/evaluation/evidence/home-mobile-375.png', fullPage: false });
metrics.mobile375 = mobileMetrics;

writeFileSync('.harness/tasks/foundation/evaluation/evidence/home-metrics.json', JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
await browser.close();
