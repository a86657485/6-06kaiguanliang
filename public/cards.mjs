/*
 * “说清楚”卡片（纯函数，界面与测试共用）：
 *   compare  对照：我的预测 vs 我的实验结果（正确答案取决于学生自己的预测）
 *   evidence 证据：题干与选项用学生自己的实验数据生成
 *   概念卡   干扰项按常见误解设计
 *   transfer 新情境：答错后换成等价的另一个新情境（A↔B），首答单独记录
 * 选项按学生打乱顺序；答错的选项会被划掉并给出针对这个误解的反馈。
 */
import { activities } from './activities.mjs';
import { flowSvg } from './experiments.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
const f1 = v => Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : '?';

export function cardKeys(stage, R) {
  const k = ['compare', 'evidence'];
  if (stage === 'cmd') k.push('where', 'diff');
  if (stage === 'panel') k.push(...Object.keys(R.switchCards).map(c => 'sort:' + c));
  if (stage === 'vote') k.push('compute', 'kinds');
  if (stage === 'truth') k.push('digit', 'off');
  if (stage === 'not') k.push('rule', 'lamp');
  if (stage === 'counter') k.push('instr', 'neg');
  return [...k, 'transfer'];
}
export const explainKeys = (stage, R) => cardKeys(stage, R).filter(k => k !== 'transfer');

const TF = v => v === 'T' ? '真' : v === 'F' ? '假' : '?';
/** 从学生自己的实验记录里取出证据卡要用的数（题干里的 {token}）。 */
export function cardData(stage, record, R) {
  const ts = (Array.isArray(record?.trials) ? record.trials : []).filter(t => t && typeof t === 'object');
  const d = {};
  if (stage === 'cmd') {
    const ok = ts.filter(t => R.sounds[t.scene] && Number.isFinite(t.db));
    const under = ok.filter(t => t.cmd === 'none').at(-1), over = ok.filter(t => t.cmd === 'alarm').at(-1), vals = ok.map(t => t.db);
    Object.assign(d, { n: new Set(ok.map(t => t.scene)).size, min: vals.length ? f1(Math.min(...vals)) : '?', max: vals.length ? f1(Math.max(...vals)) : '?', quietDb: f1(under?.db), overDb: f1(over?.db), kinds: new Set(ok.map(t => t.cmd)).size });
  } else if (stage === 'panel') {
    const dec = ts.filter(t => t.kind === 'decode' && t.states === t.code && R.validCode(t.code)).at(-1);
    const on = dec ? R.devices.filter((_, i) => dec.code[i] === '1').map(x => x[1]) : [];
    Object.assign(d, { code: dec?.code ?? '?', onList: on.length ? '（' + on.join('、') + '）' : '' });
  } else if (stage === 'vote') {
    const c = ts.filter(t => t.kind === 'count' && R.countOk(t)).at(-1);
    Object.assign(d, { a: c?.ones ?? '?', b: c?.zeros ?? '?', res: c ? (c.decision === 'go' ? R.voteCases[c.case].yes : R.voteCases[c.case].no) : '?' });
  } else if (stage === 'truth') {
    const s1 = ts.filter(t => t.kind === 'scene' && t.scene === 's1').at(-1), s2 = ts.filter(t => t.kind === 'scene' && t.scene === 's2').at(-1);
    Object.assign(d, { a: TF(s1?.answers?.gate), b: TF(s2?.answers?.gate) });
  } else if (stage === 'not') {
    const m = i => ts.filter(t => t.kind === 'machine' && t.input === i && t.out === R.NOT(i)).at(-1);
    Object.assign(d, { o1: m(1) ? String(m(1).out) : '?', o0: m(0) ? String(m(0).out) : '?' });
  } else if (stage === 'counter') {
    const c = ts.filter(t => t.kind === 'run' && t.set === 'C' && t.out === R.counterOut('C')).at(-1);
    Object.assign(d, { tie: c ? (c.out === 'go' ? '去' : '不去') : '?' });
  }
  return d;
}
export const fill = (text, d) => String(text).replace(/\{(\w+)\}/g, (_, k) => d[k] ?? '?');

/** “我的数据”：对照卡与修订时给学生回看的几行实验结果。 */
export function dataLines(stage, record, R) {
  const ts = (Array.isArray(record?.trials) ? record.trials : []).filter(t => t && typeof t === 'object');
  if (stage === 'cmd') return ts.filter(t => R.sounds[t.scene]).slice(-6).map(t => `${R.sounds[t.scene].label}：音量 ${f1(t.db)} dB → 指令「${t.cmd === 'alarm' ? '发提示' : '不发提示'}」`);
  if (stage === 'panel') return [...ts.filter(t => t.kind === 'decode').slice(-3).map(t => `指令单 ${t.code} → 设备设成 ${t.states} ${t.states === t.code ? '✓' : '✗'}`), ...ts.filter(t => t.kind === 'encode').slice(-1).map(t => `设备状态读成 ${t.typed} ${t.typed === t.shown ? '✓' : '✗'}`)];
  if (stage === 'vote') return ts.filter(t => t.kind === 'count').slice(-4).map(t => { const c = R.voteCases[t.case]; return `${c?.title}：我数到 1有${t.ones}人、0有${t.zeros}人，判断「${t.decision === 'go' ? c?.yes : c?.no}」 ${R.countOk(t) ? '✓' : '✗'}`; });
  if (stage === 'truth') return ts.filter(t => t.kind === 'scene').slice(-2).map(t => `${R.truthScenes[t.scene]?.label}：${R.statements.map(([k, l]) => l + '=' + TF(t.answers?.[k])).join('，')} ${R.sceneOk(t.scene, t.answers) ? '✓' : '✗'}`);
  if (stage === 'not') return [...[1, 0].map(i => { const t = ts.filter(x => x.kind === 'machine' && x.input === i).at(-1); return t ? `取反机：输入${i} → 输出${t.out}（我猜${t.guess}）` : `取反机：还没试输入${i}`; }), ...ts.filter(t => t.kind === 'lamp').slice(-3).map(t => `路灯${t.wire === 'not' ? '接“非”' : '直接连'}：${t.day ? '白天' : '夜里'} → 灯${t.lampOn ? '亮' : '灭'}`)];
  if (stage === 'counter') return ts.filter(t => t.kind === 'run').slice(-4).map(t => `第${t.set}组 ${R.dataSets[t.set].ones}:${R.dataSets[t.set].zeros} → 统计器输出「${t.out === 'go' ? '去' : '不去'}」（我判断「${t.guess === 'go' ? '去' : '不去'}」）`);
  return [];
}

/** 确定的伪随机打乱：同一学生、同一张卡每次顺序一样，不同学生顺序不同。 */
export function shuffleFor(items, seed) {
  let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
export const ruledKey = (key, record) => key === 'transfer' ? 'transfer:' + (record.transferItem || 'A') : key;

/**
 * 一张卡的内容：kicker、题目、可视区域（HTML）、选项（已按学生打乱，答错过的标 ruledOut）、某个选项的针对性反馈。
 */
export function cardSpec(stage, key, record, R, seed = '') {
  const a = activities[stage], d = cardData(stage, record, R), keys = cardKeys(stage, R), n = keys.indexOf(key) + 1;
  const predLabel = a.predict.find(p => p[0] === record.prediction)?.[1] || '（还没有预测）';
  let kicker = `说清楚 ${n}/${keys.length}`, question = '', visual = '', options = [], feedback = () => '';
  const fb = a.feedback || {};
  if (key === 'compare') {
    kicker += ' · 对照预测';
    question = '实验结果和你的预测一致吗？';
    visual = `<div class="compare-box"><p><b>我的预测</b><span>${esc(a.question)}<br>→ ${esc(predLabel)}</span></p><p><b>我的实验结果</b><span>${dataLines(stage, record, R).map(esc).join('<br>')}</span></p></div>`;
    options = [['match', '一致：结果和我预测的一样'], ['differ', '不一致：结果和我预测的不一样']];
    feedback = v => v === 'differ' ? `再对照一次：你预测「${predLabel}」，实验结果也是这样吗？` : `你预测「${predLabel}」。看看你的实验结果，真的一样吗？`;
  } else if (key === 'evidence') {
    kicker += ' · 用我的数据';
    const c = a.cards.evidence; question = fill(c.q, d);
    options = c.options.map(([v, l]) => [v, fill(l, d)]);
    feedback = v => fill(fb.evidence?.[v] || R.messages[stage].evidence, d);
  } else if (key === 'transfer') {
    const item = record.transferItem === 'B' ? 'B' : 'A', t = a.transfer[item];
    kicker += item === 'B' ? ' · 换一个新情境' : ' · 新情境';
    question = t.q; options = t.options;
    feedback = v => fill(fb.transfer?.[v] || R.messages[stage].transfer, d);
  } else if (key.startsWith('sort:')) {
    const card = R.switchCards[key.slice(5)];
    kicker = `说清楚 ${n}/${keys.length} · 找开关量`;
    visual = `<p class="data-card">${esc(card.label)}</p>`;
    question = a.cards.sort.q; options = a.cards.sort.options;
    feedback = () => card.kind === 'c' ? fb.sortC : fb.sortS;
  } else {
    const c = a.cards[key];
    if (stage === 'cmd' && key === 'where') visual = `<div class="mini-flow">${flowSvg(true)}</div>`;
    question = fill(c.q, d); options = c.options.map(([v, l]) => [v, fill(l, d)]);
    feedback = v => fill(fb[key]?.[v] || R.messages[stage][key], d);
  }
  const ruled = record.ruledOut?.[ruledKey(key, record)] || [];
  const shown = key === 'compare' ? options : shuffleFor(options, seed + '|' + stage + '|' + ruledKey(key, record));
  return { key, kicker, question, visual, options: shown.map(([value, label]) => ({ value, label, ruledOut: ruled.includes(value) })), feedback };
}

/** 想法提示（说清楚环节）：观察 → 思路 → 具体帮助，第3级记为“有帮助完成”。 */
export function conceptHint(stage, level, record, R) {
  return fill(activities[stage].conceptHints[Math.max(1, Math.min(3, level)) - 1], cardData(stage, record, R));
}
