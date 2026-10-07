import { createRequire } from 'node:module';
import { mkdir, copyFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 970 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/practice');
  await page.getByRole('button', { name: '开始跟读', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'qa/landing-practice-preview.png' });
  await mkdir('public/assets', { recursive: true });
  await copyFile('qa/landing-practice-preview.png', 'public/assets/practice-preview.png');
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('heading', { name: '让英语，真正说出口。' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  await page.screenshot({ path: 'qa/landing-desktop.png', fullPage: true });
  await page.getByRole('link', { name: '练习方式', exact: true }).first().click();
  assert.equal(new URL(page.url()).hash, '#how-it-works');
  await page.getByRole('button', { name: '查看更多问题' }).click();
  await page.getByText('录音会自动上传吗？', { exact: true }).click();
  await page.getByText('默认保存在当前浏览器。只有主动发起发音评测', { exact: false }).waitFor();
  await page.getByRole('button', { name: '收起更多问题' }).click();
  await page.getByLabel('播放语速', { exact: true }).selectOption('0.8');
  await page.getByRole('switch', { name: '循环播放' }).click();
  assert.equal(await page.getByRole('switch').getAttribute('aria-checked'), 'true');
  await page.getByRole('link', { name: '开始练习', exact: true }).first().click();
  await page.getByRole('button', { name: '开始跟读', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/practice');
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('echo-settings')));
  assert.equal(settings.speed, 0.8); assert.equal(settings.repeat, true);
  assert.equal(new URL(page.url()).search, '');
  await page.getByRole('link', { name: '返回 Shadowing 首页' }).click();
  await page.getByRole('heading', { name: '让英语，真正说出口。' }).waitFor();
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `qa/landing-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: '进入练习', exact: true }).click();
    await page.getByRole('button', { name: '开始跟读', exact: true }).waitFor();
    await page.getByRole('link', { name: '返回 Shadowing 首页' }).click();
  }
  assert.deepEqual(errors, []);
  console.log('Landing QA passed: desktop/mobile/tablet, navigation, FAQ, settings carry-over, practice and return.');
} finally { await browser.close(); }
