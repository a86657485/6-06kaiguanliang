/* 截图走查：登录→地图→六站（预测→做一做）→教师大屏。用法：BASE=http://127.0.0.1:8798 node tools/shots.mjs */
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT || '/workspace/tools/pw/node_modules/playwright/index.mjs');
const BASE = process.env.BASE || 'http://127.0.0.1:8798', OUT = 'docs/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(), page = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const shot = n => page.screenshot({ path: `${OUT}/${n}.png` });
await page.goto(BASE + '/'); await page.waitForSelector('#class-tiles .tile'); await shot('01-登录');
await page.locator('[data-class="601"]').first().click(); await page.waitForSelector('.name-chip'); await page.locator('.name-chip').first().click();
await page.waitForTimeout(800); const ok = page.locator('#login-confirm, .cta').first(); if (await ok.count()) await ok.click().catch(() => {});
await page.waitForTimeout(1500); await shot('02-校园地图');
const ids = ['cmd', 'panel', 'vote', 'truth', 'not', 'counter'];
await page.goto(BASE + '/test'); await page.waitForTimeout(1500);
for (const [i, id] of ids.entries()) {
  await page.evaluate(id => window.__enterPlace(id), id); await page.waitForTimeout(1200);
  await shot(`${String(i + 3).padStart(2, '0')}-第${i + 1}站-${id}-预测`);
  const opt = page.locator('[data-predict]').first();
  if (await opt.count()) { await opt.click().catch(() => {}); await page.waitForTimeout(400); const go = page.locator('.cta').first(); if (await go.count()) await go.click().catch(() => {}); await page.waitForTimeout(1200); }
  await shot(`${String(i + 3).padStart(2, '0')}-第${i + 1}站-${id}-做一做`);
}
await page.evaluate(() => window.__enterPlace('not')); await page.waitForTimeout(1000);
await page.getByText('载入本站达标示例').click().catch(() => {}); await page.waitForTimeout(1500); await shot('09-第5站-达标示例-说清楚');
await page.goto(BASE + '/teacher?demo=1'); await page.waitForTimeout(2500); await page.screenshot({ path: `${OUT}/20-教师大屏.png`, fullPage: true });
console.log(JSON.stringify(errs)); await b.close();
