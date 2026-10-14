'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const quiz = require('../quiz.cjs');

test('题库对齐三条学习目标：每目标10题，标注两项重点与一项难点', () => {
  assert.deepEqual(quiz.groups, ['能找出控制系统中的开关量', '了解开关量的表现形式及应用', '了解非运算的规则']);
  assert.deepEqual(quiz.groups.map(g => quiz.questions.filter(q => q.goal === g).length), [10, 10, 10]);
  assert.deepEqual(quiz.FOCUS, ['重点：开关量的生成', '重点：开关量的表现形式', '难点：开关量的非运算规则']);
  for (const q of quiz.questions) { assert.ok(q.answer >= 0 && q.answer < q.options.length, q.id); assert.equal(new Set(q.options).size, q.options.length, q.id); assert.ok(q.explanation, q.id); }
  // 教参：真值只简单提及，不考“真值是什么”的定义
  assert.equal(quiz.questions.filter(q => /真值是什么|什么是真值/.test(q.prompt)).length, 0);
  // 教材案例都进入题库：噪声监测器指令、举牌野炊、非运算“开/关”“亮/不亮”
  for (const k of ['55 dB', '野炊', '门是开的', '个子高']) assert.ok(quiz.questions.some(q => q.prompt.includes(k)), k);
});

test('每次抽20题，按 7+6+7 覆盖三目标，公开题目不含答案', () => {
  for (let i = 0; i < 20; i++) {
    const p = quiz.pickQuestions();
    assert.equal(p.length, 20); assert.equal(new Set(p.map(q => q.id)).size, 20);
    assert.deepEqual(quiz.groups.map(g => p.filter(q => q.goal === g).length), [7, 6, 7]);
  }
  const pub = quiz.publicQuestion(quiz.questions[0]);
  assert.equal(pub.answer, undefined); assert.equal(pub.explanation, undefined);
});
