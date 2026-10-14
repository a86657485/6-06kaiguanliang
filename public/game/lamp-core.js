/* 奖励小游戏“取反闪电站”核心逻辑（浏览器与服务端共用）：同一 seed 生成同一组题，服务端按操作记录重放算分。 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.LampCore = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PASS = 80, ROUNDS = 20, MAX_LOG = 200;
  /* 真实场景：传感器给出开关量 A，设备要执行 NOT A。 */
  const SCENES = [
    { id: 'lamp', icon: '💡', name: '智能路灯', input: '光线传感器：天亮了吗？', device: '路灯', on: '亮灯', off: '灭灯' },
    { id: 'fan', icon: '🌀', name: '教室风扇', input: '窗户开着吗？', device: '排风扇', on: '开扇', off: '关扇' },
    { id: 'pump', icon: '🚿', name: '花园水泵', input: '土壤湿润吗？', device: '水泵', on: '浇水', off: '停水' },
    { id: 'heater', icon: '♨️', name: '鱼缸加热棒', input: '水温够了吗？', device: '加热棒', on: '加热', off: '停止' },
    { id: 'buzzer', icon: '🔔', name: '冰箱提醒器', input: '冰箱门关好了吗？', device: '蜂鸣器', on: '响铃', off: '安静' },
    { id: 'gate', icon: '🚧', name: '停车场道闸', input: '车位满了吗？', device: '“有空位”灯', on: '亮灯', off: '灭灯' }
  ];
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  /* 难度递增：限时从 4 秒缩到 1.6 秒；后段出现“双重取反” NOT NOT A。 */
  function limitFor(i) { return Math.round(4000 - (2400 * i) / (ROUNDS - 1)); }
  function build(seed) {
    const R = rng(seed), list = [];
    for (let i = 0; i < ROUNDS; i++) {
      const scene = SCENES[Math.floor(R() * SCENES.length)], a = R() < 0.5 ? 1 : 0, double = i >= 14 && R() < 0.4;
      list.push({ i, scene: scene.id, a, double, answer: double ? a : 1 - a, limit: limitFor(i) });
    }
    return list;
  }
  /* log: [{ i, v(0/1), ms }]；超时或缺失算错。分数：每题 4 分 + 速度奖励最多 1 分，满分 100。 */
  function replay(seed, log) {
    if (!Number.isInteger(seed) || seed < 1) throw new Error('数据编号不正确');
    if (!Array.isArray(log) || log.length > MAX_LOG) throw new Error('操作记录格式不正确');
    const qs = build(seed), seen = new Set(); let right = 0, score = 0, combo = 0, bestCombo = 0, timeout = 0;
    const byI = {};
    for (const e of log) {
      if (!e || !Number.isInteger(e.i) || e.i < 0 || e.i >= ROUNDS || ![0, 1].includes(e.v) || !Number.isFinite(e.ms) || e.ms < 0) throw new Error('操作记录格式不正确');
      if (seen.has(e.i)) continue; seen.add(e.i); byI[e.i] = e;
    }
    for (const q of qs) {
      const e = byI[q.i];
      if (!e || e.ms > q.limit) { timeout++; combo = 0; continue; }
      if (e.v === q.answer) { right++; combo++; bestCombo = Math.max(bestCombo, combo); score += 4 + Math.round((1 - e.ms / q.limit) * 10) / 10; }
      else combo = 0;
    }
    score = Math.round(score * 10) / 10;
    const acc = right / ROUNDS, stars = acc >= 0.95 ? 3 : acc >= 0.8 ? 2 : acc >= 0.5 ? 1 : 0;
    return { score, stars, stats: { right, total: ROUNDS, timeout, bestCombo } };
  }
  function gate(scores = []) {
    const list = scores.filter(v => Number.isFinite(v));
    const latest = list.length ? list[list.length - 1] : null, best = list.length ? Math.max(...list) : null;
    return { unlocked: latest !== null && latest >= PASS, latest, best, pass: PASS };
  }
  const byScene = Object.fromEntries(SCENES.map(s => [s.id, s]));
  return { PASS, ROUNDS, MAX_LOG, SCENES, byScene, build, replay, gate, limitFor };
});
