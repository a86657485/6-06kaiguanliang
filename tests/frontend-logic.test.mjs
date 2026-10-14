import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../public/rules.js');
globalThis.LessonRules = R;
const { learningProgress, cardKeys } = await import('../public/journey.mjs');
const { summarizeClass } = await import('../public/teacher-stats.mjs');
const { renderClassCharts } = await import('../public/teacher-charts.mjs');
const quiz = require('../quiz.cjs');
const fs = require('node:fs');

test('学习三步：先预测，再实验，最后说清楚', () => {
  assert.equal(learningProgress('cmd', {}, R).initialStep, 'predict');
  assert.equal(learningProgress('cmd', R.examples.cmd, R).readyToSubmit, true);
  assert.deepEqual(cardKeys('not', R), ['compare', 'evidence', 'rule', 'lamp', 'transfer']);
});

test('演示班级数据可生成大屏全部图表（含第5站非运算表、第6站统计器）', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../public/demo-class.json', import.meta.url)));
  const st = summarizeClass(d, R.stages, quiz.groups, R, Date.parse(d.at));
  const html = renderClassCharts(st, { R });
  assert.match(html.notTable, /非运算/); assert.match(html.counter, /平票/);
  assert.match(html.target, /非运算规则/);
  const empty = renderClassCharts(summarizeClass({ classId: '603', round: 'r1', students: [] }, R.stages, quiz.groups, R), { R });
  assert.ok(empty.notTable.includes('尚无证据'));
});

test('RPG 地点顺序与六站一致，末尾是考核', async () => {
  const rpg = await import('../public/rpg.mjs');
  assert.deepEqual(Object.keys(rpg.places), [...R.stageIds, 'quiz']);
});

test('学生页不引用外网、不含麦克风', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.ok(!/https?:\/\//.test(html)); assert.ok(!/microphone/.test(html));
});

test('二刷引导：每生每关只自动弹一次、可关闭（✕/Esc）、💡提示按需打开、停靠角落不挡操作', () => {
  const mem = new Map(); const store = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)) };
  const k1 = R.hintSeenKey('lesson', 'stu1', R.stageIds[0]), k2 = R.hintSeenKey('lesson', 'stu2', R.stageIds[0]), k3 = R.hintSeenKey('lesson', 'stu1', R.stageIds[1]);
  assert.notEqual(k1, k2); assert.notEqual(k1, k3);
  assert.equal(R.shouldAutoShowHint(store, k1), true);
  R.markHintShown(store, k1);
  assert.equal(R.shouldAutoShowHint(store, k1), false, '同一学生同一关不再自动弹出');
  assert.equal(R.shouldAutoShowHint(store, k2), true); assert.equal(R.shouldAutoShowHint(store, k3), true);
  assert.equal(R.shouldAutoShowHint({ getItem() { throw new Error('x'); } }, k1), true);
  const app = fs.readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /retry-guide-close[^]*✕/); assert.match(app, /Escape/); assert.match(app, /💡提示/);
  assert.match(app, /shouldAutoShowHint\(st, key\)/);
  const css = fs.readFileSync(new URL('../public/game.css', import.meta.url), 'utf8');
  const rule = css.match(/\.retry-guide\{[^}]*\}/)[0];
  assert.match(rule, /position:fixed/); assert.match(rule, /right:12px/); assert.doesNotMatch(rule, /left:/);
});
