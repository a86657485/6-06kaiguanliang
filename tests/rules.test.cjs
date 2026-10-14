'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/rules.js');

test('六站对齐教参目标与重难点', () => {
  assert.deepEqual(R.stageIds, ['cmd', 'panel', 'vote', 'truth', 'not', 'counter']);
  assert.deepEqual(R.stages.map(s => s.goal), [1, 1, 2, 2, 3, 1]);
  assert.equal(R.stages.find(s => s.id === 'not').focus, 'hard');
});

test('第1站：音量超过55 dB生成“发提示”，只有两种指令', () => {
  assert.equal(R.commandFor(55), 'none'); assert.equal(R.commandFor(55.1), 'alarm');
  const cmds = new Set(); for (const s of Object.keys(R.sounds)) for (let seed = 1; seed < 30; seed++) cmds.add(R.commandFor(R.measure(s, seed)));
  assert.deepEqual([...cmds].sort(), ['alarm', 'none']);
  const forged = R.experimentChecks('cmd', { trials: ['quiet', 'chat', 'dance', 'moto'].map(s => ({ scene: s, db: R.sounds[s].base, cmd: 'alarm' })) });
  assert.equal(forged.find(c => c.id === 'both').complete, false, '与比较规则不一致的指令不计入');
});

test('第2站：同一张指令单只算一次，读数必须与设备状态一致', () => {
  const c = R.codeFor('decode', 1);
  const one = R.experimentChecks('panel', { trials: [{ kind: 'decode', seed: 1, code: c, states: c }, { kind: 'decode', seed: 1, code: c, states: c }] });
  assert.equal(one.find(x => x.id === 'decode').complete, false);
  const enc = R.codeFor('encode', 3);
  const flip = enc.replace(/./g, d => d === '1' ? '0' : '1');
  assert.equal(R.experimentChecks('panel', { trials: [{ kind: 'encode', seed: 3, shown: enc, typed: flip }] }).find(x => x.id === 'encode').complete, false, '1、0写反不算');
  assert.equal(R.validCode('10x1'), false);
  for (const k of ['power', 'valve', 'lamp']) assert.equal(R.switchCards[k].kind, 's');
  for (const k of ['temp', 'noise', 'level']) assert.equal(R.switchCards[k].kind, 'c');
});

test('第3站：举牌人数有多种，结果只有两种；平票不去；伪造人数不计入', () => {
  assert.equal(R.decide(8, 7), 'go'); assert.equal(R.decide(7, 8), 'nogo'); assert.equal(R.decide(7, 7), 'nogo');
  const b = R.crowd('picnic', 1), ones = b.filter(Boolean).length;
  assert.equal(b.length, 15);
  assert.equal(R.countOk({ kind: 'count', case: 'picnic', seed: 1, ones, zeros: 15 - ones, decision: R.decide(ones, 15 - ones) }), true);
  assert.equal(R.countOk({ kind: 'count', case: 'picnic', seed: 1, ones: ones + 1, zeros: 14 - ones, decision: R.decide(ones + 1, 14 - ones) }), false);
});

test('第4站：真假看实际状态，两个场景答案不同', () => {
  const s1 = R.truthScenes.s1.facts, s2 = R.truthScenes.s2.facts;
  assert.notDeepEqual(s1, s2, '同一句话在不同场景真假不同');
  assert.equal(R.sceneOk('s1', s1), true); assert.equal(R.sceneOk('s1', s2), false);
  const allT = Object.fromEntries(R.statements.map(([k]) => [k, 'T']));
  assert.equal(R.sceneOk('s1', allT) && R.sceneOk('s2', allT), false, '全选“真”不能两场都过');
});

test('第5站（难点）：非运算取反；案例表全对才算；路灯接“非”天黑才亮', () => {
  assert.equal(R.NOT(1), 0); assert.equal(R.NOT(0), 1); assert.equal(R.NOT(R.NOT(1)), 1);
  const right = Object.fromEntries(Object.entries(R.notCases).map(([k, c]) => [k, c.answer]));
  assert.deepEqual(R.tableWrong(right), []);
  assert.deepEqual(R.tableWrong({ ...right, rope: '优秀' }), ['rope']);
  const same = Object.fromEntries(Object.entries(R.notCases).map(([k, c]) => [k, c.state]));
  assert.equal(R.tableWrong(same).length, 5, '照抄原状态全错');
  assert.equal(R.lampOn('not', true), false); assert.equal(R.lampOn('not', false), true); assert.equal(R.lampOn('direct', true), true);
  const noGuess = R.experimentChecks('not', { trials: [{ kind: 'machine', input: 1, guess: 1, out: 0 }, { kind: 'machine', input: 0, guess: 0, out: 1 }] });
  assert.equal(noGuess.find(c => c.id === 'machine').complete, false, '猜错的运行不计入');
});

test('第6站：统计器三组票数，C组20:20平票输出“不去”；三组都先判断对才算', () => {
  assert.equal(R.counterOut('A'), 'go'); assert.equal(R.counterOut('B'), 'nogo'); assert.equal(R.counterOut('C'), 'nogo');
  assert.equal(R.counterOk(R.counterAnswer), true);
  const two = R.experimentChecks('counter', { trials: ['A', 'B'].map(set => ({ kind: 'run', set, guess: R.counterOut(set), out: R.counterOut(set) })).concat([{ kind: 'run', set: 'C', guess: 'go', out: 'nogo' }]) });
  assert.equal(two.find(c => c.id === 'sets').complete, false);
});

test('每站达标示例通过；缺预测、缺实验、未提交都不能通过；错解释给修订信息', () => {
  for (const s of R.stageIds) {
    const a = R.assess(s, R.examples[s]); assert.equal(a.pass, true, s); assert.deepEqual(a.errors, [], s);
    assert.equal(R.assess(s, { ...R.examples[s], submitted: false }).pass, false, s);
    assert.equal(R.assess(s, { ...R.examples[s], prediction: '' }).pass, false, s);
    assert.equal(R.assess(s, { ...R.examples[s], trials: [] }).pass, false, s);
  }
  const wrongNot = { ...R.examples.not, explain: { ...R.examples.not.explain, rule: 'same' } };
  assert.equal(R.assess('not', wrongNot).pass, false);
  assert.ok(R.assess('not', wrongNot).errors.length > 0);
  assert.equal(R.assess('nope', {}).pass, false);
});

test('再试提示只给方向，不直接给答案', () => {
  for (const s of R.stageIds) {
    const bad = { ...R.examples[s], explain: Object.fromEntries(Object.keys(R.examples[s].explain).map(k => [k, 'x'])), transfer: 'x' };
    const g = R.retryGuidance(s, bad, { attempts: 1 });
    const text = JSON.stringify(g);
    assert.ok(text.includes('再试一次的小提示'), s);
  }
});

test('乱点的学生：几乎拿不到满三星，绝大多数需要多次检验并留下误解标签', () => {
  const { simulate } = require('../tools/guess-sim.cjs');
  let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const s of R.stageIds) {
    const N = 3000, runs = Array.from({ length: N }, () => simulate(s, rnd));
    const three = runs.filter(m => m.stars === 3).length / N, avg = runs.reduce((n, m) => n + m.stars, 0) / N;
    assert.ok(three < 0.03, `${s} 满星比例 ${three}`);
    assert.ok(avg < 2.2, `${s} 平均星 ${avg}`);
    assert.ok(runs.every(m => m.passed && m.stars >= 1));
    assert.ok(runs.filter(m => m.attempts > 1).length / N > 0.9, `${s} 多次检验`);
    assert.ok(runs.filter(m => m.tagsFirst.length).length / N > 0.85, `${s} 误解标签`);
  }
});
