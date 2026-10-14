'use strict';
/* 奖励小游戏“取反闪电站”：核心逻辑 + 80分解锁 + 服务端重放算分，使用虚构名单与临时数据库。 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const C = require('../public/game/lamp-core.js');
const quiz = require('../quiz.cjs');
const { createService } = require('../server.cjs');

const perfect = (seed, ms = 500) => C.build(seed).map(q => ({ i: q.i, v: q.answer, ms }));

test('核心：同一 seed 题目一致，答案就是 NOT A（或 NOT NOT A = A），难度递增', () => {
  const a = C.build(42), b = C.build(42);
  assert.deepEqual(a, b); assert.equal(a.length, 20);
  for (const q of a) assert.equal(q.answer, q.double ? q.a : 1 - q.a);
  assert.ok(a.slice(0, 14).every(q => !q.double), '前14题只考一次取反');
  assert.equal(C.limitFor(0), 4000); assert.equal(C.limitFor(19), 1600);
  for (let i = 1; i < 20; i++) assert.ok(a[i].limit < a[i - 1].limit);
  assert.ok(C.SCENES.length >= 5 && C.SCENES.every(s => s.icon && s.device));
});

test('核心：重放算分，超时/答错/重复记录与伪造记录', () => {
  const full = C.replay(7, perfect(7, 0));
  assert.equal(full.score, 100); assert.equal(full.stars, 3); assert.equal(full.stats.bestCombo, 20);
  const wrong = C.replay(7, C.build(7).map(q => ({ i: q.i, v: 1 - q.answer, ms: 100 })));
  assert.equal(wrong.score, 0); assert.equal(wrong.stars, 0);
  const late = C.replay(7, C.build(7).map(q => ({ i: q.i, v: q.answer, ms: q.limit + 1 })));
  assert.equal(late.stats.timeout, 20); assert.equal(late.score, 0);
  const dup = perfect(7, 0); dup.unshift({ i: 0, v: 1 - C.build(7)[0].answer, ms: 10 });
  assert.equal(C.replay(7, dup).stats.right, 19, '同一题只认第一次按键');
  assert.equal(C.replay(7, []).stats.timeout, 20);
  assert.throws(() => C.replay(7, [{ i: 99, v: 1, ms: 1 }])); assert.throws(() => C.replay(7, [{ i: 0, v: 2, ms: 1 }]));
  assert.throws(() => C.replay(0, []));
});

test('核心：解锁看最近一次考核 ≥80', () => {
  assert.equal(C.gate([]).unlocked, false);
  assert.equal(C.gate([75]).unlocked, false);
  assert.equal(C.gate([80]).unlocked, true);
  assert.equal(C.gate([95, 60]).unlocked, false); assert.equal(C.gate([95, 60]).best, 95);
});

test('入口：未考/低于80锁定，≥80 解锁，教师测试直达', async () => {
  const { gameEntry, GAME_PASS } = await import('../public/quiz.mjs');
  assert.equal(GAME_PASS, 80);
  assert.match(gameEntry('student', null), /locked/);
  assert.match(gameEntry('student', 75, [{ score: 75 }]), /locked[\s\S]*75 分/);
  assert.match(gameEntry('student', 80, [{ score: 80 }]), /href="\/game"/);
  assert.match(gameEntry('test', null), /href="\/game-test"/);
  assert.equal(gameEntry('demo', 100), '');
});

const roster = [{ id: 'g601-a', classId: '601', name: '虚构甲' }, { id: 'g601-b', classId: '601', name: '虚构乙' }];
function client(base) {
  let cookie = '';
  return async (p, body) => {
    const res = await fetch(base + p, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
  };
}
async function takeExam(c, me, correctCount) {
  const e = (await c('/api/exam/create', { sid: me.student.id, round: me.round })).body;
  const answers = {};
  e.questions.forEach((q, n) => {
    const bank = quiz.questions.find(x => x.id === q.id), right = q.options.indexOf(bank.options[bank.answer]);
    answers[q.id] = n < correctCount ? right : (right + 1) % q.options.length;
  });
  return (await c('/api/exam/submit', { sid: me.student.id, round: me.round, examId: e.id, answers })).body;
}

test('服务：考核80分才解锁，成绩由服务端重放，排行榜与页面路由', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lesson6-game-'));
  const svc = createService({ roster, runtimeDir: dir });
  await new Promise(r => svc.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${svc.server.address().port}`, c = client(base);
  try {
    assert.equal((await c('/api/game/status')).status, 401);
    const me = (await c('/api/login', { classId: '601', id: 'g601-a' })).body;
    const run = (seed, log, sid = me.student.id) => c('/api/game/result', { sid, round: me.round, runId: 'r' + seed, seed, log });
    assert.equal((await c('/api/game/status')).body.unlocked, false);
    assert.equal((await run(5, perfect(5))).status, 403, '未考核不能提交游戏成绩');
    assert.equal((await takeExam(c, me, 15)).score, 75);
    assert.equal((await run(5, perfect(5))).status, 403, '75分仍锁定');
    assert.equal((await takeExam(c, me, 16)).score, 80);
    const st = (await c('/api/game/status')).body; assert.equal(st.unlocked, true); assert.equal(st.latest, 80);
    const r1 = (await run(5, perfect(5))).body;
    assert.equal(r1.result.stars, 3); assert.equal(r1.result.score, C.replay(5, perfect(5)).score);
    assert.equal(r1.status.leaderboard[0].name, '虚构甲');
    assert.equal((await run(5, perfect(5))).body.status.game.plays, 1, '同一 runId 只记一次');
    assert.equal((await c('/api/game/result', { sid: me.student.id, round: me.round, runId: 'bad', seed: 5, log: [{ i: 0, v: 7, ms: 1 }] })).status, 400);
    assert.equal((await run(6, [], 'g601-b')).status, 403, '身份不一致被拒绝');
    assert.equal((await takeExam(c, me, 10)).score, 50);
    assert.equal((await c('/api/game/status')).body.unlocked, false, '最近一次低于80重新锁定');
    const page = await c('/game'); assert.equal(page.status, 200); assert.match(page.body, /取反闪电站/);
    assert.equal((await c('/game/lamp-core.js')).status, 200);
  } finally { await new Promise(r => svc.server.close(() => { svc.close(); r(); })); }
});
