/* 六个校园地点的实验：画面在场景里，控件只有当前需要的几个；记录格式与 rules.js 的判定一致。原理写在规则里，靠操作结果自己发现。 */
import { escape } from './sync.mjs';

const R = () => globalThis.LessonRules;
const reduced = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);

class Base {
  constructor(ctx) { this.ctx = ctx; this.timers = new Set(); }
  every(fn, ms) { const id = setInterval(fn, ms); this.timers.add(id); return id; }
  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); return id; }
  stopTimer(id) { clearInterval(id); clearTimeout(id); this.timers.delete(id); }
  destroy() { for (const id of this.timers) { clearInterval(id); clearTimeout(id); } this.timers.clear(); }
  options() { return {}; }
  trials() { return (this.ctx.record().trials || []).filter(t => t && typeof t === 'object'); }
}

/* ---------- 1 监测站门口：音量很多种，指令只有两种（蓝栏B1：观察流程图，说出在哪一步生成指令） ---------- */
export class CmdExperiment extends Base {
  mount(scene, controls) {
    this.scene = scene; this.controls = controls; this.busy = false; this.seed = this.trials().length + 1;
    scene.innerHTML = `<div class="l6-split">
      <div class="screen-frame"><div class="screen-top"><b>噪声监测器 · 算法流程图</b><span class="console-note">仿真音量 · 不用麦克风</span></div>
        <div class="flow-wrap">${flowSvg()}</div></div>
      <div class="screen-frame log-frame"><div class="screen-top"><b>指令记录表</b><span class="console-note">每测一次自动记一行</span></div>
        <table class="l6-table" id="cmd-log"><thead><tr><th>声音</th><th>音量（输入）</th><th>指令（输出）</th></tr></thead><tbody></tbody></table></div></div>`;
    controls.innerHTML = `<div id="sound-cards" class="sound-cards wrap" role="group" aria-label="输入一种声音">${Object.entries(R().sounds).map(([k, s]) => `<button type="button" class="sound-card" data-scene="${k}">${escape(s.label)}</button>`).join('')}</div>`;
    controls.querySelectorAll('[data-scene]').forEach(b => b.onclick = () => this.measure(b.dataset.scene));
    this.log(); const last = this.trials().filter(t => R().sounds[t.scene]).at(-1); if (last) this.light(last.db, last.cmd);
  }
  options() { const ts = this.trials().filter(t => R().sounds[t.scene]); return { busy: this.busy, hasAlarm: ts.some(t => t.cmd === 'alarm'), hasNone: ts.some(t => t.cmd === 'none') }; }
  measure(key) {
    if (this.busy) return;
    const db = R().measure(key, this.seed++), cmd = R().commandFor(db);
    this.busy = true; this.ctx.refresh(); this.ctx.pose('interact');
    const svg = this.scene.querySelector('.flow-svg'); svg.classList.remove('yes', 'no'); svg.querySelector('#f-in-val').textContent = '…';
    const finish = () => { this.busy = false; this.light(db, cmd); this.ctx.addTrial({ scene: key, db, cmd, at: Date.now() }); this.log();
      this.ctx.say(`${R().sounds[key].label}：${f1(db)} dB ${cmd === 'alarm' ? '> 55，走“是”这条路 → 发提示' : '≤ 55，走“否”这条路 → 不发提示'}。`, 'good'); };
    if (reduced()) { finish(); return; }
    let k = 0; const tick = this.every(() => { k++; svg.querySelector('#f-in-val').textContent = f1(db + Math.sin(k) * 3) + ' dB'; if (k > 8) { this.stopTimer(tick); finish(); } }, 80);
  }
  light(db, cmd) {
    const svg = this.scene.querySelector('.flow-svg');
    svg.querySelector('#f-in-val').textContent = f1(db) + ' dB';
    svg.classList.toggle('yes', cmd === 'alarm'); svg.classList.toggle('no', cmd === 'none');
  }
  log() {
    const rows = this.trials().filter(t => R().sounds[t.scene]).slice(-8);
    this.scene.querySelector('#cmd-log tbody').innerHTML = rows.map(t => `<tr class="${t.cmd}"><td>${escape(R().sounds[t.scene].label)}</td><td>${f1(t.db)} dB</td><td><b>${t.cmd === 'alarm' ? '发提示' : '不发提示'}</b></td></tr>`).join('') || '<tr><td colspan="3" class="console-note">点下面的声音卡，开始记录</td></tr>';
  }
}
export function flowSvg(mini = false) {
  return `<svg viewBox="0 0 520 300" class="flow-svg${mini ? ' mini' : ''}" role="img" aria-label="算法流程图：输入音量数据，判断数据超标，是则发提示，否则不发提示">
    <defs><marker id="arr${mini ? 'm' : ''}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="#9fd8ff"/></marker></defs>
    <rect x="160" y="10" width="200" height="56" rx="12" class="f-box f-in"/><text x="260" y="34" text-anchor="middle" class="f-t">输入音量数据</text><text id="f-in-val" x="260" y="56" text-anchor="middle" class="f-v">${mini ? '' : '— dB'}</text>
    <line x1="260" y1="66" x2="260" y2="98" class="f-line" marker-end="url(#arr${mini ? 'm' : ''})"/>
    <polygon points="260,100 360,150 260,200 160,150" class="f-box f-judge"/><text x="260" y="146" text-anchor="middle" class="f-t">数据超标？</text><text x="260" y="168" text-anchor="middle" class="f-v small">（＞55 dB）</text>
    <path d="M160 150 H80 V230" class="f-line f-yes" marker-end="url(#arr${mini ? 'm' : ''})"/><text x="112" y="140" class="f-lab">是</text>
    <path d="M360 150 H440 V230" class="f-line f-no" marker-end="url(#arr${mini ? 'm' : ''})"/><text x="398" y="140" class="f-lab">否</text>
    <rect x="20" y="232" width="120" height="50" rx="12" class="f-box f-out-yes"/><text x="80" y="263" text-anchor="middle" class="f-t">发提示</text>
    <rect x="380" y="232" width="120" height="50" rx="12" class="f-box f-out-no"/><text x="440" y="263" text-anchor="middle" class="f-t">不发提示</text>
    <g class="f-bell"><circle cx="80" cy="222" r="0"/></g></svg>`;
}

/* ---------- 2 校园控制室：按指令单（1/0）开关设备，再把设备状态读成1和0（蓝栏B2：控制指令—设备状态—数字形式） ---------- */
const DEV_ICON = {
  light: on => `<svg viewBox="0 0 80 80"><path d="M40 10a20 20 0 0 0-12 36v8h24v-8a20 20 0 0 0-12-36z" fill="${on ? '#ffd968' : '#4a5a6a'}"/>${on ? '<g stroke="#ffd968" stroke-width="4"><line x1="40" y1="0" x2="40" y2="6"/><line x1="10" y1="28" x2="4" y2="28"/><line x1="70" y1="28" x2="76" y2="28"/></g>' : ''}<rect x="30" y="56" width="20" height="10" rx="3" fill="#9fb3bd"/></svg>`,
  valve: on => `<svg viewBox="0 0 80 80"><rect x="20" y="8" width="40" height="40" rx="8" fill="#cfe8f5"/><rect x="34" y="48" width="12" height="10" fill="#9fb3bd"/>${on ? '<path d="M40 60 q-6 8 0 16 q6 -8 0 -16z" fill="#4ab3f0"/><path d="M40 58 v6" stroke="#4ab3f0" stroke-width="4"/>' : ''}<circle cx="40" cy="28" r="9" fill="${on ? '#3fc1b5' : '#e9603b'}"/></svg>`,
  fan: on => `<svg viewBox="0 0 80 80"><g class="${on ? 'spin' : ''}" style="transform-origin:40px 36px"><ellipse cx="40" cy="18" rx="7" ry="16" fill="#9fd8ff"/><ellipse cx="40" cy="54" rx="7" ry="16" fill="#9fd8ff"/><ellipse cx="22" cy="36" rx="16" ry="7" fill="#9fd8ff"/><ellipse cx="58" cy="36" rx="16" ry="7" fill="#9fd8ff"/></g><circle cx="40" cy="36" r="6" fill="${on ? '#3fc1b5' : '#4a5a6a'}"/></svg>`,
  gate: on => `<svg viewBox="0 0 80 80"><rect x="6" y="14" width="8" height="58" fill="#9fb3bd"/><rect x="66" y="14" width="8" height="58" fill="#9fb3bd"/>${on ? '<g fill="#c9a36b"><rect x="14" y="22" width="8" height="48"/><rect x="58" y="22" width="8" height="48"/></g>' : '<g fill="#c9a36b"><rect x="14" y="22" width="52" height="48"/></g><g stroke="#8a6b4f" stroke-width="3"><line x1="27" y1="22" x2="27" y2="70"/><line x1="40" y1="22" x2="40" y2="70"/><line x1="53" y1="22" x2="53" y2="70"/></g>'}</svg>`
};
export class PanelExperiment extends Base {
  mount(scene, controls) {
    this.scene = scene; this.controls = controls; this.states = '0000'; this.touched = false; this.needNext = false;
    const dec = this.trials().filter(t => t.kind === 'decode');
    this.seed = Math.max(0, ...this.trials().map(t => Number(t.seed) || 0)) + 1;
    this.code = this.freshCode();
    this.encSeed = this.seed + 50;
    scene.innerHTML = `<div class="screen-frame panel-room"><div class="screen-top"><b>校园控制室 · 控制电脑</b><span class="console-note" id="panel-phase"></span></div>
      <div class="sheet" id="sheet"></div><div class="devices" id="devices" role="group" aria-label="四台设备"></div><p class="console-note center" id="panel-msg" role="status"></p></div>`;
    this.render(); void dec;
  }
  freshCode() {
    const done = new Set(this.trials().filter(t => t.kind === 'decode' && t.states === t.code).map(t => t.code));
    let c = R().codeFor('decode', this.seed), n = 0;
    while (done.has(c) && n++ < 20) { this.seed++; c = R().codeFor('decode', this.seed); }
    return c;
  }
  phase() { const ch = R().experimentChecks('panel', this.ctx.record()); return !ch[0].complete ? 'decode' : !ch[1].complete ? 'encode' : 'done'; }
  options() { return { phase: this.phase(), touched: this.touched, needNext: this.needNext, typed: (this.controls.querySelector('#enc-input')?.value || '').length }; }
  render() {
    const ph = this.phase(), devs = R().devices;
    this.scene.querySelector('#panel-phase').textContent = ph === 'decode' ? '第1—2步：按指令单开/关设备' : ph === 'encode' ? '第3步：把设备状态读成1和0' : '三步都完成了';
    if (ph === 'encode' || (ph === 'done' && this.showEnc)) {
      const shown = R().codeFor('encode', this.encSeed);
      this.scene.querySelector('#sheet').innerHTML = `<p class="sheet-title">设备现在的状态 → 指令是什么？</p><p class="sheet-code">? ? ? ?</p>`;
      this.scene.querySelector('#devices').innerHTML = devs.map(([k, l], i) => this.devHtml(k, l, shown[i] === '1', true)).join('');
      this.controls.innerHTML = `<div class="console-row"><label class="type-box">指令（4位1和0）<input id="enc-input" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="例如 1001" aria-label="输入4位指令"></label><button id="enc-check" class="big-btn" type="button">读出指令</button></div>`;
      const inp = this.controls.querySelector('#enc-input');
      inp.oninput = () => { inp.value = inp.value.replace(/[^01]/g, '').slice(0, 4); this.ctx.refresh(); };
      inp.onkeydown = e => { if (e.key === 'Enter') this.encode(); };
      this.controls.querySelector('#enc-check').onclick = () => this.encode();
      return;
    }
    this.scene.querySelector('#sheet').innerHTML = `<p class="sheet-title">指令单（第1位→第4位）</p><p class="sheet-code">${this.code.split('').map((c, i) => `<span title="${devs[i][1]}">${c}</span>`).join('')}</p><p class="sheet-legend">${devs.map(d => d[1]).join(' · ')}</p>`;
    this.scene.querySelector('#devices').innerHTML = devs.map(([k, l], i) => this.devHtml(k, l, this.states[i] === '1', false)).join('');
    this.scene.querySelectorAll('[data-dev]').forEach(b => b.onclick = () => { const i = Number(b.dataset.dev); this.states = this.states.slice(0, i) + (this.states[i] === '1' ? '0' : '1') + this.states.slice(i + 1); this.touched = true; this.ctx.sfx?.('tap'); this.render(); this.ctx.refresh(); });
    this.controls.innerHTML = this.needNext ? `<div class="console-row"><button id="panel-next" class="big-btn" type="button">换一张指令单 →</button></div>` : `<div class="console-row"><button id="panel-check" class="big-btn" type="button">按指令单检查</button></div>`;
    const c = this.controls.querySelector('#panel-check'); if (c) c.onclick = () => this.check();
    const n = this.controls.querySelector('#panel-next'); if (n) n.onclick = () => { this.seed++; this.code = this.freshCode(); this.states = '0000'; this.touched = false; this.needNext = false; this.scene.querySelector('#panel-msg').textContent = ''; this.render(); this.ctx.refresh(); };
  }
  devHtml(k, label, on, locked) { const i = R().devices.findIndex(d => d[0] === k); return `<div class="device ${on ? 'on' : ''}"><div class="dev-art">${DEV_ICON[k](on)}</div><b>${label}</b>${locked ? `<span class="dev-state">${on ? '开着' : '关着'}</span>` : `<button type="button" class="dev-switch" data-dev="${i}" aria-pressed="${on}" aria-label="${label}开关">${on ? '开' : '关'}</button>`}</div>`; }
  check() {
    const ok = this.states === this.code, wrong = [...this.code].map((c, i) => c !== this.states[i] ? R().devices[i][1] : null).filter(Boolean);
    this.ctx.addTrial({ kind: 'decode', seed: this.seed, code: this.code, states: this.states, at: Date.now() });
    if (ok) { this.needNext = R().experimentChecks('panel', this.ctx.record())[0].complete ? false : true; this.ctx.say(`设备和指令单「${this.code}」一致！`, 'good'); this.scene.querySelector('#panel-msg').textContent = '✓ 控制电脑：执行成功'; }
    else { this.ctx.say(`有 ${wrong.length} 台设备和指令单不一致：${wrong.join('、')}。再对照指令单的那一位想一想。`, 'bad'); this.scene.querySelector('#panel-msg').textContent = '✗ ' + wrong.join('、') + ' 与指令单不一致'; }
    this.render(); this.ctx.refresh();
  }
  encode() {
    const inp = this.controls.querySelector('#enc-input'), typed = inp.value, shown = R().codeFor('encode', this.encSeed);
    if (!/^[01]{4}$/.test(typed)) { this.scene.querySelector('#panel-msg').textContent = '请输入4位，只用1和0。'; return; }
    this.ctx.addTrial({ kind: 'encode', seed: this.encSeed, shown, typed, at: Date.now() });
    if (typed === shown) { this.ctx.say(`读对了：${shown}。`, 'good'); this.scene.querySelector('#panel-msg').textContent = '✓ 指令读对了'; this.showEnc = true; }
    else { const n = [...shown].filter((c, i) => c !== typed[i]).length; this.encSeed++; this.ctx.say(`有 ${n} 位读错了。设备换了一组状态，再读一次。`, 'bad'); this.scene.querySelector('#panel-msg').textContent = '✗ 有' + n + '位不对，已换一组状态'; }
    this.render(); this.ctx.refresh();
  }
}

/* ---------- 3 礼堂举牌台：数清0和1，判断结果（蓝栏B3：选择只有两种，结果只有两种；可换其他案例） ---------- */
const SHIRTS = ['#e2725b', '#4aa3c7', '#3fa57c', '#f0b429', '#8e6cc1', '#e9a03b', '#6fbf73'];
function kidSvg(board, i, counted) {
  const c = SHIRTS[i % SHIRTS.length], hair = i % 3 ? '#2b2b2b' : '#5a3a22';
  return `<svg viewBox="0 0 60 92" aria-hidden="true"><rect x="16" y="54" width="28" height="34" rx="10" fill="${c}"/><circle cx="30" cy="44" r="12" fill="#f1c9a5"/><path d="M18 42 q12 -18 24 0 q-2 -12 -12 -12 q-10 0 -12 12z" fill="${hair}"/>
    <line x1="${board ? 44 : 16}" y1="58" x2="${board ? 48 : 12}" y2="24" stroke="${c}" stroke-width="6" stroke-linecap="round"/>
    <rect x="${board ? 30 : 0}" y="2" width="30" height="26" rx="4" fill="#fff" stroke="#c9d8de"/><text x="${board ? 45 : 15}" y="23" text-anchor="middle" font-size="22" font-weight="800" fill="${board ? '#1f7a4d' : '#b23b2e'}">${board}</text>
    ${counted ? '<circle cx="30" cy="80" r="9" fill="#ffb020"/><text x="30" y="85" text-anchor="middle" font-size="12" font-weight="800" fill="#173d50">✓</text>' : ''}</svg>`;
}
export class VoteExperiment extends Base {
  mount(scene, controls) {
    this.scene = scene; this.controls = controls;
    this.caseId = R().experimentChecks('vote', this.ctx.record())[0].complete ? 'monitor' : 'picnic';
    this.seed = Math.max(0, ...this.trials().map(t => Number(t.seed) || 0)) + 1; this.reset();
  }
  reset() { this.boards = R().crowd(this.caseId, this.seed); this.counted = new Set(); this.ones = 0; this.zeros = 0; this.decision = null; this.result = null; this.render(); }
  options() { const ch = R().experimentChecks('vote', this.ctx.record()); return { caseId: this.caseId, counted: this.counted.size, all: this.counted.size === this.boards.length || (this.ones + this.zeros) === this.boards.length, decision: this.decision, needNext: ch[0].complete && !ch[1].complete && this.caseId === 'picnic' }; }
  render() {
    const c = R().voteCases[this.caseId];
    this.scene.innerHTML = `<div class="screen-frame vote-hall"><div class="screen-top"><b>举牌：${escape(c.title)}？</b><span class="console-note">同意举1，不同意举0 · 人物为虚构</span></div>
      <div class="crowd" id="crowd">${this.boards.map((b, i) => `<button type="button" class="kid ${this.counted.has(i) ? 'counted' : ''}" data-kid="${i}" aria-label="第${i + 1}位同学，举${b}" ${this.counted.has(i) ? 'disabled' : ''}>${kidSvg(b, i, this.counted.has(i))}</button>`).join('')}</div>
      <div class="tally"><div class="tally-box one"><small>举 1 的人数</small><input id="t-ones" inputmode="numeric" value="${this.ones}" aria-label="举1的人数"></div><div class="tally-box zero"><small>举 0 的人数</small><input id="t-zeros" inputmode="numeric" value="${this.zeros}" aria-label="举0的人数"></div>
      <div class="counter-screen ${this.result ? (this.result === 'go' ? 'go' : 'nogo') : ''}" id="vote-screen"><small>统计器显示</small><b>${this.result ? (this.result === 'go' ? c.yes : c.no) : '—'}</b></div></div></div>`;
    this.scene.querySelectorAll('[data-kid]').forEach(b => b.onclick = () => { const i = Number(b.dataset.kid); if (this.counted.has(i)) return; this.counted.add(i); if (this.boards[i]) this.ones++; else this.zeros++; this.ctx.sfx?.('tap'); this.render(); this.ctx.refresh(); });
    const num = (id, f) => { const el = this.scene.querySelector(id); el.oninput = () => { el.value = el.value.replace(/\D/g, '').slice(0, 2); this[f] = Number(el.value) || 0; this.ctx.refresh(); }; };
    num('#t-ones', 'ones'); num('#t-zeros', 'zeros');
    const o = this.options();
    this.controls.innerHTML = o.needNext ? `<div class="console-row"><button id="vote-next" type="button" class="big-btn">下一个案例：是否同意小林当班长 →</button></div>`
      : `<div class="console-row"><div id="vote-decide" class="pick-group" role="group" aria-label="我判断的结果"><span class="pick-title">我判断</span><button type="button" class="pick" data-dec="go" aria-pressed="${this.decision === 'go'}">${c.yes}</button><button type="button" class="pick" data-dec="nogo" aria-pressed="${this.decision === 'nogo'}">${c.no}</button></div><button id="vote-submit" type="button" class="big-btn">交给统计器</button></div>`;
    this.controls.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { this.decision = b.dataset.dec; this.render(); this.ctx.refresh(); });
    const s = this.controls.querySelector('#vote-submit'); if (s) s.onclick = () => this.submit();
    const n = this.controls.querySelector('#vote-next'); if (n) n.onclick = () => { this.caseId = 'monitor'; this.seed++; this.reset(); this.ctx.refresh(); };
  }
  submit() {
    const c = R().voteCases[this.caseId];
    if (!this.decision) { this.ctx.say('先在“我判断”里选一个结果。', 'bad'); return; }
    const t = { kind: 'count', case: this.caseId, seed: this.seed, ones: this.ones, zeros: this.zeros, decision: this.decision, at: Date.now() };
    const real = this.boards.filter(Boolean).length, realZ = this.boards.length - real, out = R().decide(real, realZ);
    this.ctx.addTrial(t);
    if (R().countOk(t)) { this.result = out; this.ctx.say(`统计器：举1有${real}人，举0有${realZ}人 → 显示「${out === 'go' ? c.yes : c.no}」。和你的判断一样！`, 'good'); this.ctx.sfx?.('good'); this.render(); this.ctx.refresh(); return; }
    const countWrong = this.ones !== real || this.zeros !== realZ;
    this.ctx.say(countWrong ? `人数和统计器数的不一样（共${this.boards.length}人，你记了${this.ones + this.zeros}人）。同学们重新举了一次牌，再数一遍。` : `统计器的结果和你的判断不一样。同学们重新举了一次牌：比一比两栏人数再判断。`, 'bad');
    this.seed++; this.reset(); this.ctx.refresh();
  }
}

/* ---------- 4 真假问答亭：同一句话，场景变了真值也变（蓝栏B4：举1为真、举0为假；再问2—3个案例） ---------- */
function campusSvg(f) {
  const rain = f.rain === 'T', light = f.light === 'T', gate = f.gate === 'T', fan = f.fan === 'T', dusk = rain;
  const drops = rain ? Array.from({ length: 40 }, (_, i) => `<line x1="${(i * 37) % 600}" y1="${(i * 53) % 200}" x2="${(i * 37) % 600 - 6}" y2="${(i * 53) % 200 + 16}" stroke="#9fd8ff" stroke-width="2" opacity=".7"/>`).join('') : '';
  return `<svg viewBox="0 0 600 260" class="campus-svg" role="img" aria-label="校园场景">
    <rect width="600" height="260" fill="${dusk ? '#2b3b52' : '#bfe3f5'}"/>${dusk ? '' : '<circle cx="530" cy="50" r="30" fill="#ffd968"/>'}${rain ? '<g fill="#6b7d90"><ellipse cx="140" cy="40" rx="80" ry="26"/><ellipse cx="380" cy="34" rx="100" ry="28"/></g>' : ''}
    <rect x="40" y="70" width="240" height="140" fill="${dusk ? '#4f5f74' : '#e8d9c4'}"/><rect x="30" y="58" width="260" height="16" fill="#8a4f2f"/>
    <rect x="70" y="100" width="70" height="60" fill="${light ? '#ffe9a0' : '#1b2a3a'}" stroke="#fff" stroke-width="4"/><rect x="170" y="100" width="70" height="60" fill="${light ? '#ffe9a0' : '#1b2a3a'}" stroke="#fff" stroke-width="4"/><text x="160" y="196" text-anchor="middle" font-size="16" fill="#173d50" font-weight="700">教室</text>
    <g transform="translate(320 110)"><rect width="110" height="100" fill="${dusk ? '#4f5f74' : '#dfe9ee'}"/><text x="55" y="92" text-anchor="middle" font-size="14" fill="#173d50" font-weight="700">走廊风扇</text>
      <g class="${fan ? 'spin' : ''}" style="transform-origin:55px 42px"><ellipse cx="55" cy="22" rx="6" ry="18" fill="#4aa3c7"/><ellipse cx="55" cy="62" rx="6" ry="18" fill="#4aa3c7"/><ellipse cx="35" cy="42" rx="18" ry="6" fill="#4aa3c7"/><ellipse cx="75" cy="42" rx="18" ry="6" fill="#4aa3c7"/></g><circle cx="55" cy="42" r="6" fill="#173d50"/></g>
    <rect y="210" width="600" height="50" fill="${dusk ? '#33424f' : '#9fd18b'}"/>
    <g transform="translate(460 130)"><rect x="0" y="0" width="10" height="90" fill="#9fb3bd"/><rect x="110" y="0" width="10" height="90" fill="#9fb3bd"/>${gate ? '<rect x="10" y="20" width="12" height="70" fill="#c9a36b"/><rect x="98" y="20" width="12" height="70" fill="#c9a36b"/>' : '<rect x="10" y="20" width="100" height="70" fill="#c9a36b"/><g stroke="#8a6b4f" stroke-width="3"><line x1="35" y1="20" x2="35" y2="90"/><line x1="60" y1="20" x2="60" y2="90"/><line x1="85" y1="20" x2="85" y2="90"/></g>'}<text x="60" y="-6" text-anchor="middle" font-size="14" fill="${dusk ? '#fff' : '#173d50'}" font-weight="700">校门</text></g>
    ${drops}</svg>`;
}
export class TruthExperiment extends Base {
  mount(scene, controls) { this.scene = scene; this.controls = controls; this.answers = {}; this.render(); }
  current() { const ch = R().experimentChecks('truth', this.ctx.record()); return !ch[0].complete ? 's1' : !ch[1].complete ? 's2' : 'self'; }
  options() { const cur = this.current(); return { cur, filled: Object.keys(this.answers).length, total: R().statements.length }; }
  render() {
    const cur = this.current();
    if (cur === 'self' || this.selfShown) {
      const self = this.trials().filter(t => t.kind === 'self').at(-1);
      this.scene.innerHTML = `<div class="screen-frame truth-booth"><div class="screen-top"><b>问答亭：用真值回答</b><span class="console-note">没有对错，按你自己的情况选</span></div>
        <div class="self-q"><p class="big-q">你喜欢吃苹果吗？</p><p class="console-note">喜欢，就回答“真”；不喜欢，就回答“假”。</p>${self ? `<p class="self-a">你的回答：<b>${self.answer === 'T' ? '真（1）' : '假（0）'}</b></p>` : ''}</div></div>`;
      this.controls.innerHTML = `<div id="self-pick" class="console-row" role="group" aria-label="用真或假回答"><button type="button" class="big-btn tf-t" data-self="T">真（1）</button><button type="button" class="big-btn tf-f" data-self="F">假（0）</button></div>`;
      this.controls.querySelectorAll('[data-self]').forEach(b => b.onclick = () => { this.selfShown = true; this.ctx.addTrial({ kind: 'self', q: 'apple', answer: b.dataset.self, at: Date.now() }); this.ctx.say(`你的回答是「${b.dataset.self === 'T' ? '真' : '假'}」，数字形式是 ${b.dataset.self === 'T' ? 1 : 0}。`, 'good'); this.render(); });
      return;
    }
    const sc = R().truthScenes[cur];
    this.scene.innerHTML = `<div class="screen-frame truth-booth"><div class="screen-top"><b>场景${cur === 's1' ? '1' : '2'}：${escape(sc.label)}</b><span class="console-note">看图判断：是这样→真，不是这样→假</span></div>
      <div class="truth-grid"><div class="campus">${campusSvg(sc.facts)}</div><ol id="truth-list" class="truth-list">${R().statements.map(([k, l]) => `<li data-st="${k}"><span>“${escape(l)}”</span><span class="tf"><button type="button" class="tf-btn t" data-k="${k}" data-v="T" aria-pressed="${this.answers[k] === 'T'}">真 1</button><button type="button" class="tf-btn f" data-k="${k}" data-v="F" aria-pressed="${this.answers[k] === 'F'}">假 0</button></span></li>`).join('')}</ol></div>
      <p class="console-note center" id="truth-msg" role="status"></p></div>`;
    this.scene.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { this.answers[b.dataset.k] = b.dataset.v; this.ctx.sfx?.('tap'); this.render(); this.ctx.refresh(); });
    this.controls.innerHTML = `<div class="console-row"><button id="truth-submit" type="button" class="big-btn">提交这个场景</button></div>`;
    this.controls.querySelector('#truth-submit').onclick = () => this.submit(cur);
  }
  submit(cur) {
    if (Object.keys(this.answers).length < R().statements.length) { this.scene.querySelector('#truth-msg').textContent = '还有句子没判断。'; return; }
    const ok = R().sceneOk(cur, this.answers), wrong = R().statements.filter(([k]) => this.answers[k] !== R().truthScenes[cur].facts[k]).length;
    this.ctx.addTrial({ kind: 'scene', scene: cur, answers: { ...this.answers }, at: Date.now() });
    if (ok) { this.answers = {}; this.ctx.say(cur === 's1' ? '四句都判断对了！接着看傍晚放学后的校园。' : '这个场景也全对了！', 'good'); this.render(); }
    else { this.ctx.say(`有 ${wrong} 句和场景图不符。再仔细看图。`, 'bad'); this.render(); this.scene.querySelector('#truth-msg').textContent = `✗ 有 ${wrong} 句和场景不符`; }
    this.ctx.refresh();
  }
}

/* ---------- 5 取反实验室：取反机、非运算案例表、路灯接线（蓝栏B5：取相反结果；小组填表后对照参考答案） ---------- */
export class NotExperiment extends Base {
  mount(scene, controls) {
    this.scene = scene; this.controls = controls; this.input = 1; this.guess = null; this.table = {}; this.wire = 'direct'; this.day = null; this.compared = false;
    const lastTable = this.trials().filter(t => t.kind === 'table').at(-1); if (lastTable) { this.table = { ...lastTable.answers }; this.compared = true; }
    this.render();
  }
  part() { const ch = R().experimentChecks('not', this.ctx.record()); return !ch[0].complete ? 'machine' : !ch[1].complete ? 'table' : !ch[2].complete ? 'lamp' : 'lamp'; }
  options() { const p = this.part(); const done = this.trials().filter(t => t.kind === 'machine' && t.guess === t.out); return { part: p, guess: this.guess, input: this.input, testedInputs: [...new Set(done.map(t => t.input))], tableFilled: Object.keys(this.table).length, wire: this.wire, lampDay: this.trials().some(t => t.kind === 'lamp' && t.wire === 'not' && t.day), lampNight: this.trials().some(t => t.kind === 'lamp' && t.wire === 'not' && !t.day) }; }
  render() {
    const p = this.part(), ch = R().experimentChecks('not', this.ctx.record());
    const tabs = `<div class="part-tabs">${[['machine', '① 取反机'], ['table', '② 案例表'], ['lamp', '③ 修路灯']].map(([k, l], i) => `<span class="${k === p ? 'now' : ''} ${ch[i].complete ? 'done' : ''}">${ch[i].complete ? '✓ ' : ''}${l}</span>`).join('')}</div>`;
    if (p === 'machine') {
      const last = this.lastOut;
      this.scene.innerHTML = `<div class="screen-frame not-lab">${tabs}<div class="machine"><div class="m-in"><small>输入</small><b class="bit b${this.input}">${this.input}</b><span>${this.input ? '开关闭合 · 真' : '开关断开 · 假'}</span></div><i class="m-arrow">→</i><div class="m-box">非<small>取反机</small></div><i class="m-arrow">→</i><div class="m-out"><small>输出</small><b class="bit ${last ? 'b' + last.out : ''}">${last && last.input === this.input ? last.out : '?'}</b><span>${last && last.input === this.input ? (last.out ? '真' : '假') : '运行后显示'}</span></div></div>
        <p class="console-note center" id="m-msg" role="status">${this.trials().filter(t => t.kind === 'machine').slice(-4).map(t => `输入${t.input}→输出${t.out}（猜${t.guess}${t.guess === t.out ? '✓' : '✗'}）`).join('　')}</p></div>`;
      this.controls.innerHTML = `<div class="console-row"><div class="pick-group" id="not-input" role="group" aria-label="输入"><span class="pick-title">输入</span><button type="button" class="pick" data-in="1" aria-pressed="${this.input === 1}">1 闭合</button><button type="button" class="pick" data-in="0" aria-pressed="${this.input === 0}">0 断开</button></div>
        <div class="pick-group" id="not-guess" role="group" aria-label="我猜输出"><span class="pick-title">我猜输出</span><button type="button" class="pick" data-g="1" aria-pressed="${this.guess === 1}">1</button><button type="button" class="pick" data-g="0" aria-pressed="${this.guess === 0}">0</button></div><button id="not-run" type="button" class="big-btn">运行取反机</button></div>`;
      this.controls.querySelectorAll('[data-in]').forEach(b => b.onclick = () => { this.input = Number(b.dataset.in); this.guess = null; this.lastOut = null; this.render(); this.ctx.refresh(); });
      this.controls.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { this.guess = Number(b.dataset.g); this.render(); this.ctx.refresh(); });
      this.controls.querySelector('#not-run').onclick = () => this.runMachine();
    } else if (p === 'table' || (p === 'lamp' && this.showTable)) {
      const cases = R().notCases;
      this.scene.innerHTML = `<div class="screen-frame not-lab">${tabs}<p class="sheet-title">非运算案例分析表（小组讨论后填写）</p><table class="l6-table not-table" id="not-table"><thead><tr><th>案例</th><th>状态</th><th>非运算结果</th>${this.compared ? '<th>参考答案</th>' : ''}</tr></thead><tbody>${Object.entries(cases).map(([k, c]) => { const bad = this.compared && this.table[k] !== c.answer; return `<tr class="${bad ? 'bad' : this.compared ? 'ok' : ''}"><td>${escape(c.label)}</td><td><b>${escape(c.state)}</b></td><td><span class="chips" data-row="${k}">${c.options.map(o => `<button type="button" class="pick small" data-case="${k}" data-v="${escape(o)}" aria-pressed="${this.table[k] === o}">${escape(o)}</button>`).join('')}</span></td>${this.compared ? `<td>${escape(c.answer)}${bad ? ' ✗' : ' ✓'}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
      this.scene.querySelectorAll('[data-case]').forEach(b => b.onclick = () => { this.table[b.dataset.case] = b.dataset.v; this.compared = false; this.render(); this.ctx.refresh(); });
      this.controls.innerHTML = `<div class="console-row"><button id="table-check" type="button" class="big-btn">和参考答案对照</button></div>`;
      this.controls.querySelector('#table-check').onclick = () => this.checkTable();
    } else {
      const on = this.day === null ? null : R().lampOn(this.wire, this.day);
      this.scene.innerHTML = `<div class="screen-frame not-lab">${tabs}<div class="lamp-row"><div class="street">${streetSvg(this.day, on)}</div>
        <div class="wire-diagram"><span class="w-box">光照传感器<br><small>“天亮了？”${this.day === null ? '' : this.day ? '→ 真(1)' : '→ 假(0)'}</small></span><i>→</i><span class="w-box ${this.wire === 'not' ? 'not-on' : 'w-direct'}">${this.wire === 'not' ? '非' : '直接连'}</span><i>→</i><span class="w-box">路灯<br><small>${on === null ? '' : on ? '亮(1)' : '灭(0)'}</small></span></div></div>
        <p class="console-note center" id="lamp-msg" role="status">${this.trials().filter(t => t.kind === 'lamp').slice(-4).map(t => `${t.wire === 'not' ? '接非' : '直接连'}·${t.day ? '白天' : '夜里'}→灯${t.lampOn ? '亮' : '灭'}`).join('　')}</p></div>`;
      this.controls.innerHTML = `<div class="console-row"><div id="wire" class="pick-group" role="group" aria-label="接线方式"><span class="pick-title">接线</span><button type="button" class="pick" data-w="direct" aria-pressed="${this.wire === 'direct'}">直接连</button><button type="button" class="pick" data-w="not" aria-pressed="${this.wire === 'not'}">接上“非”</button></div>
        <div id="lamp-time" class="pick-group" role="group" aria-label="试一试"><span class="pick-title">试一试</span><button type="button" class="pick" data-day="1" id="lamp-day">☀ 白天</button><button type="button" class="pick" data-day="0" id="lamp-night">🌙 夜里</button></div></div>`;
      this.controls.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { this.wire = b.dataset.w; this.day = null; this.render(); this.ctx.refresh(); });
      this.controls.querySelectorAll('[data-day]').forEach(b => b.onclick = () => this.tryLamp(b.dataset.day === '1'));
    }
  }
  runMachine() {
    if (this.guess === null) { this.ctx.say('先在“我猜输出”里选1或0，再运行。', 'bad'); return; }
    const out = R().NOT(this.input); this.lastOut = { input: this.input, out };
    this.ctx.addTrial({ kind: 'machine', input: this.input, guess: this.guess, out, at: Date.now() });
    this.ctx.say(this.guess === out ? `猜对了：输入${this.input}，输出${out}。` : `和你猜的不一样：输入${this.input}，输出是${out}。`, this.guess === out ? 'good' : 'bad');
    const tested = this.options().testedInputs; if (this.guess === out && tested.length < 2) { this.input = this.input ? 0 : 1; this.lastOut = null; }
    this.guess = null; this.render(); this.ctx.refresh();
  }
  checkTable() {
    if (Object.keys(this.table).length < Object.keys(R().notCases).length) { this.ctx.say('表格还有空行，先每行选一个结果。', 'bad'); return; }
    const wrong = R().tableWrong(this.table); this.compared = true;
    this.ctx.addTrial({ kind: 'table', answers: { ...this.table }, wrong: wrong.length, at: Date.now() });
    this.ctx.say(wrong.length ? `和参考答案对照：有 ${wrong.length} 行不一样，已标红。想想“取相反结果”，改一改再对照。` : '和参考答案完全一致！', wrong.length ? 'bad' : 'good');
    this.showTable = wrong.length > 0; this.render(); this.ctx.refresh();
  }
  tryLamp(day) {
    this.day = day; const on = R().lampOn(this.wire, day);
    this.ctx.addTrial({ kind: 'lamp', wire: this.wire, day, lampOn: on, at: Date.now() });
    const good = on === !day;
    this.ctx.say(good ? `${day ? '白天' : '夜里'}：灯${on ? '亮' : '灭'}，正合适。` : day ? '白天路灯却亮着，太浪费电了！' : '天黑了路灯却不亮，路人看不清！', good ? 'good' : 'bad');
    this.render(); this.ctx.refresh();
  }
}
function streetSvg(day, on) {
  const sky = day === null ? '#5c7690' : day ? '#bfe3f5' : '#0b1630';
  return `<svg viewBox="0 0 300 200" class="street-svg" role="img" aria-label="${day === null ? '还没试' : (day ? '白天' : '夜里') + '，路灯' + (on ? '亮' : '灭')}"><rect width="300" height="200" fill="${sky}"/>${day ? '<circle cx="250" cy="40" r="22" fill="#ffd968"/>' : day === false ? '<circle cx="250" cy="40" r="16" fill="#fff4c9"/>' : ''}
    <rect y="160" width="300" height="40" fill="#3a4a5a"/><rect x="96" y="40" width="8" height="122" fill="#7d8c96"/><path d="M100 44 h44" stroke="#7d8c96" stroke-width="6"/><rect x="134" y="44" width="26" height="12" rx="4" fill="${on ? '#ffe9a0' : '#4a5a6a'}"/>
    ${on ? '<path d="M136 56 L110 160 H190 L158 56z" fill="#ffe9a0" opacity=".45"/>' : ''}</svg>`;
}

/* ---------- 6 统计器工坊：输入—计算—输出，三组票数（蓝栏B6：口头描述后绘制示意图） ---------- */
export class CounterExperiment extends Base {
  mount(scene, controls) {
    this.scene = scene; this.controls = controls; this.picked = null; this.set = 'A'; this.guess = null; this.running = false; this.out = null;
    const done = this.trials().some(t => t.kind === 'schematic' && R().counterOk(t.slots));
    this.slots = done ? { ...R().counterAnswer } : {};
    this.render();
  }
  options() {
    const ch = R().experimentChecks('counter', this.ctx.record()), ok = new Set(this.trials().filter(t => t.kind === 'run' && t.guess === t.out).map(t => t.set));
    return { part: ch[0].complete ? 'run' : 'schematic', picked: this.picked, set: this.set, guess: this.guess, running: this.running, setsDone: [...ok], nextSet: ['A', 'B', 'C'].find(k => !ok.has(k)) || null };
  }
  render() {
    const o = this.options(), parts = R().counterParts;
    if (o.part === 'schematic') {
      const slot = (id, tag) => { const v = this.slots[id]; return `<button type="button" class="sch-slot${v ? ' filled' : ''}" data-slot="${id}"><small>${tag}</small><b>${v ? escape(parts[v]) : '？'}</b></button>`; };
      this.scene.innerHTML = `<div class="screen-frame counter-shop"><div class="screen-top"><b>投票统计器 · 工作过程示意图</b><span class="console-note">先说一说：统计器怎样工作？再把卡片放进框里</span></div>
        <div class="say-first"><p>“把同学们举牌的数字输入统计器，统计1和0的次数；1的次数大于0的次数就输出‘去’，反之输出‘不去’。”</p></div>
        <div id="schematic-slots" class="sch-row">${slot('s1', '输入')}<i>→</i>${slot('s2', '计算')}<i>→</i>${slot('s3', '输出')}</div><p id="sch-msg" class="console-note center" role="status"></p></div>`;
      this.controls.innerHTML = `<div id="schematic-parts" class="sch-parts" role="group" aria-label="卡片">${['out', 'paper', 'in', 'calc'].map(k => `<button type="button" class="sch-part${this.picked === k ? ' on' : ''}" data-part="${k}" ${Object.values(this.slots).includes(k) ? 'disabled' : ''}>${escape(parts[k])}</button>`).join('')}<button type="button" id="sch-reset" class="mini-btn">重新放</button></div>`;
      this.controls.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { this.picked = b.dataset.part; this.render(); this.ctx.refresh(); });
      this.scene.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => this.place(b.dataset.slot));
      this.controls.querySelector('#sch-reset').onclick = () => { this.slots = {}; this.picked = null; this.render(); this.ctx.refresh(); };
      return;
    }
    const ds = R().dataSets[this.set], runs = this.trials().filter(t => t.kind === 'run');
    this.scene.innerHTML = `<div class="screen-frame counter-shop"><div class="screen-top"><b>投票统计器</b><span class="console-note">输入 → 计算 → 输出</span></div>
      <div class="counter-machine"><div class="cm-in"><small>输入：举牌的数字</small><div class="digit-stream" id="stream">${this.streamHtml(ds)}</div></div>
        <div class="cm-calc"><small>计算：比较1和0的次数</small><p><b class="n1" id="n1">${this.out ? ds.ones : '?'}</b><span id="cmp">${this.out ? (ds.ones > ds.zeros ? '＞' : ds.ones < ds.zeros ? '＜' : '＝') : 'vs'}</span><b class="n0" id="n0">${this.out ? ds.zeros : '?'}</b></p><small>1的次数　　0的次数</small></div>
        <div class="counter-screen ${this.out || ''}" id="cnt-screen"><small>输出：野炊的决定</small><b>${this.out ? (this.out === 'go' ? '去（1）' : '不去（0）') : '—'}</b></div></div>
      <p class="console-note center">${runs.slice(-5).map(t => `第${t.set}组 ${R().dataSets[t.set].ones}:${R().dataSets[t.set].zeros}→${t.out === 'go' ? '去' : '不去'}（我判断${t.guess === 'go' ? '去' : '不去'}${t.guess === t.out ? '✓' : '✗'}）`).join('　')}</p></div>`;
    this.controls.innerHTML = `<div class="console-row"><div id="cnt-set" class="pick-group" role="group" aria-label="选一组票数"><span class="pick-title">票数</span>${['A', 'B', 'C'].map(k => `<button type="button" class="pick" data-set="${k}" aria-pressed="${this.set === k}">${o.setsDone.includes(k) ? '✓' : ''}${k}组 ${R().dataSets[k].ones}:${R().dataSets[k].zeros}</button>`).join('')}</div>
      <div id="cnt-guess" class="pick-group" role="group" aria-label="我判断"><span class="pick-title">我判断</span><button type="button" class="pick" data-g="go" aria-pressed="${this.guess === 'go'}">去</button><button type="button" class="pick" data-g="nogo" aria-pressed="${this.guess === 'nogo'}">不去</button></div>
      <button id="cnt-run" type="button" class="big-btn" ${this.running ? 'disabled' : ''}>运行统计器</button></div>`;
    this.controls.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { if (this.running) return; this.set = b.dataset.set; this.guess = null; this.out = null; this.render(); this.ctx.refresh(); });
    this.controls.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { if (this.running) return; this.guess = b.dataset.g; this.render(); this.ctx.refresh(); });
    this.controls.querySelector('#cnt-run').onclick = () => this.run();
  }
  streamHtml(ds) { const r = R().rng('stream' + this.set), a = [...Array(ds.ones).fill(1), ...Array(ds.zeros).fill(0)]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.map(v => `<i class="d${v}">${v}</i>`).join(''); }
  place(slotId) {
    if (!this.picked) { this.scene.querySelector('#sch-msg').textContent = '先点下面的一张卡片。'; return; }
    for (const [k, v] of Object.entries(this.slots)) if (v === this.picked) delete this.slots[k];
    this.slots[slotId] = this.picked; this.picked = null;
    if (Object.keys(this.slots).length < 3) { this.render(); this.ctx.refresh(); return; }
    const ok = R().counterOk(this.slots);
    this.ctx.addTrial({ kind: 'schematic', slots: { ...this.slots }, at: Date.now() });
    if (ok) { this.ctx.say('示意图补好了：举牌的数字 → 比较1和0的次数、生成指令 → 野炊的决定。现在用三组票数检验统计器。', 'good'); }
    else { const wrong = Object.entries(R().counterAnswer).filter(([k, v]) => this.slots[k] !== v).map(([k]) => k); const names = wrong.map(k => ({ s1: '输入', s2: '计算', s3: '输出' }[k])).join('、'); for (const k of wrong) delete this.slots[k]; this.ctx.say(`${names}框放得不对，卡片已退回。想一想：什么被送进统计器？统计器“算”什么？最后给出什么？`, 'bad'); }
    this.render(); this.ctx.refresh();
  }
  run() {
    if (this.guess === null) { this.ctx.say('先在“我判断”里选“去”或“不去”。', 'bad'); return; }
    const ds = R().dataSets[this.set], out = R().counterOut(this.set), guess = this.guess, set = this.set;
    this.running = true; this.out = null; this.render(); this.ctx.pose('interact');
    const finish = () => { this.running = false; this.out = out; this.ctx.addTrial({ kind: 'run', set, guess, out, at: Date.now() });
      this.ctx.say(`${ds.ones} ${ds.ones > ds.zeros ? '＞' : ds.ones < ds.zeros ? '＜' : '＝'} ${ds.zeros} → 输出「${out === 'go' ? '去' : '不去'}」。${guess === out ? '和你判断的一样。' : '和你判断的不一样，想想规则里的“大于”。'}`, guess === out ? 'good' : 'bad');
      this.guess = null; this.render(); this.ctx.refresh(); };
    if (reduced()) { finish(); return; }
    let k = 0; const total = ds.ones + ds.zeros, digits = [...this.scene.querySelectorAll('#stream i')]; let c1 = 0, c0 = 0;
    const tick = this.every(() => { const d = digits[k]; if (d) { d.classList.add('in'); if (d.textContent === '1') c1++; else c0++; this.scene.querySelector('#n1').textContent = c1; this.scene.querySelector('#n0').textContent = c0; } k++; if (k >= total) { this.stopTimer(tick); this.later(finish, 250); } }, 35);
  }
}

export const experimentClasses = { cmd: CmdExperiment, panel: PanelExperiment, vote: VoteExperiment, truth: TruthExperiment, not: NotExperiment, counter: CounterExperiment };
