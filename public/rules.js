/* 第6课《开关量的真与假》共享规则：浏览器与课堂服务使用同一份判定。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LessonRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* 教参第32页：学习目标（goal 1—3）与教学重难点（key=重点“开关量的生成和表现形式”，hard=难点“控制系统中开关量的非运算规则”）。 */
  const GOALS = ['能找出控制系统中的开关量', '了解开关量的表现形式及应用', '了解非运算的规则'];
  const FOCI = { key: '重点：开关量的生成和表现形式', hard: '难点：控制系统中开关量的非运算规则' };
  const stages = [
    { id: 'cmd', name: '课堂导入：指令是一种什么数据', short: '指令是什么数据', points: 10, goal: 1, focus: 'key', textbook: '课堂导入（流程图）' },
    { id: 'panel', name: '学习活动1：认识开关量数据（开/关·1/0）', short: '开关量与1/0', points: 10, goal: 1, focus: 'key', textbook: '学习活动1' },
    { id: 'vote', name: '学习活动2：情景剧·举牌投票', short: '举牌投票', points: 10, goal: 2, focus: 'key', textbook: '学习活动2' },
    { id: 'truth', name: '学习活动2续：开关量的真值', short: '真值', points: 10, goal: 2, focus: 'key', textbook: '开关量的真值说明表' },
    { id: 'not', name: '学习活动3：了解非运算的规则', short: '非运算', points: 10, goal: 3, focus: 'hard', textbook: '学习活动3' },
    { id: 'counter', name: '拓展与提升：设计投票统计器', short: '投票统计器', points: 10, goal: 1, focus: 'key', textbook: '拓展与提升' }
  ];
  const stageIds = stages.map(s => s.id);
  const LIMIT = 55; // 噪声监测：超过55 dB发提示（承接第5课）
  const round1 = v => Math.round(v * 10) / 10;
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  /** 确定的伪随机（服务端可复算）。 */
  function rng(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------- 第1站：噪声监测系统的流程图——音量有很多数值，指令只有两种 ---------- */
  const sounds = {
    quiet: { label: '夜深人静', base: 38 }, page: { label: '翻书声', base: 44 }, chat: { label: '小声聊天', base: 49 },
    door: { label: '用力关门', base: 59 }, dance: { label: '广场舞音乐', base: 66 }, moto: { label: '摩托车经过', base: 77 }
  };
  function measure(scene, seed = 0) { const s = sounds[scene]; return s ? round1(s.base + 1.5 * Math.sin(seed * 1.7 + s.base)) : null; }
  /** 流程图“数据超标？”：超过55为“是”→发提示；等于55不算超过。 */
  const commandFor = db => finite(db) && db > LIMIT ? 'alarm' : 'none';

  /* ---------- 第2站：控制室——1 开设备，0 关设备 ---------- */
  const devices = [['light', '教室灯'], ['valve', '饮水机阀门'], ['fan', '走廊风扇电源'], ['gate', '校门']];
  const CODES = ['1011', '0110', '1100', '0101', '1001', '0011', '1110', '0100'];
  const codeFor = (kind, seed) => CODES[Math.floor(rng(kind + ':' + seed)() * CODES.length)];
  const validCode = c => typeof c === 'string' && /^[01]{4}$/.test(c);
  /* 教材：电源的闭合与断开、阀门的接通与断开、灯的亮与不亮都属于开关量；干扰项是第5课的连续量。 */
  const switchCards = {
    power: { label: '电源的闭合或断开', kind: 's' }, temp: { label: '教室里的温度', kind: 'c' },
    valve: { label: '阀门的接通或断开', kind: 's' }, noise: { label: '监测器测到的音量', kind: 'c' },
    lamp: { label: '灯亮还是不亮', kind: 's' }, level: { label: '水箱里的水位高度', kind: 'c' }
  };

  /* ---------- 第3站：举牌投票（教参：也可改为其他案例，如投票是否同意某位同学当班长） ---------- */
  const voteCases = {
    picnic: { title: '秋游是否去郊外野炊', yes: '去', no: '不去', ones: [9, 10, 8] },
    monitor: { title: '是否同意小林当班长', yes: '当班长', no: '不当班长', ones: [5, 6, 4] }
  };
  const CROWD = 15;
  /** 某个案例、某一轮的举牌（数组，1/0），服务端可复算。 */
  function crowd(caseId, seed) {
    const c = voteCases[caseId]; if (!c || !Number.isInteger(seed)) return null;
    const r = rng(caseId + '#' + seed), k = c.ones[seed % c.ones.length];
    const boards = Array.from({ length: CROWD }, (_, i) => i < k ? 1 : 0);
    for (let i = boards.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [boards[i], boards[j]] = [boards[j], boards[i]]; }
    return boards;
  }
  const decide = (ones, zeros) => ones > zeros ? 'go' : 'nogo';
  function countOk(t) {
    const b = crowd(t.case, t.seed); if (!b) return false;
    const ones = b.filter(Boolean).length, zeros = b.length - ones;
    return t.ones === ones && t.zeros === zeros && t.decision === decide(ones, zeros);
  }

  /* ---------- 第4站：真值——举1为真、举0为假；状态变了，真值也变 ---------- */
  const statements = [['rain', '正在下雨'], ['light', '教室的灯亮着'], ['gate', '校门开着'], ['fan', '走廊风扇在转']];
  const truthScenes = {
    s1: { label: '晴天 · 早上7:30上学时', facts: { rain: 'F', light: 'T', gate: 'T', fan: 'F' } },
    s2: { label: '雨天 · 傍晚5:30放学后', facts: { rain: 'T', light: 'F', gate: 'F', fan: 'T' } }
  };
  const sceneOk = (scene, answers) => !!truthScenes[scene] && statements.every(([k]) => obj(answers)[k] === truthScenes[scene].facts[k]);

  /* ---------- 第5站：非运算——取相反结果 ---------- */
  const NOT = v => v === 1 ? 0 : 1;
  /* 教材“非运算案例分析表”（5个案例，原样） */
  const notCases = {
    door: { label: '教室门', state: '开', answer: '关', options: ['关', '开', '锁上'] },
    lamp: { label: '教室的灯', state: '亮', answer: '不亮', options: ['不亮', '亮', '更亮'] },
    volume: { label: '手机的音量', state: '大', answer: '小', options: ['小', '大', '更大'] },
    rope: { label: '小智每分钟跳绳次数', state: '达标', answer: '不达标', options: ['不达标', '达标', '优秀'] },
    lift: { label: '电梯运行方向', state: '上', answer: '下', options: ['下', '上', '停'] }
  };
  const tableWrong = answers => Object.entries(notCases).filter(([k, c]) => obj(answers)[k] !== c.answer).map(([k]) => k);
  /** 路灯：传感器判断“天亮了？”（真/假），直接连→天亮灯亮；接“非”→天亮灯灭、天黑灯亮。 */
  const lampOn = (wire, day) => wire === 'not' ? !day : !!day;

  /* ---------- 第6站：投票统计器（教材拓展与提升）---------- */
  const counterParts = { in: '举牌的数字', calc: '比较举牌1和0的次数，生成指令', out: '郊外野炊的决定', paper: '举牌用的白纸' };
  const counterAnswer = { s1: 'in', s2: 'calc', s3: 'out' };
  const counterOk = slots => !!slots && typeof slots === 'object' && Object.entries(counterAnswer).every(([k, v]) => slots[k] === v);
  const dataSets = { A: { ones: 23, zeros: 17 }, B: { ones: 15, zeros: 25 }, C: { ones: 20, zeros: 20 } };
  const counterOut = set => dataSets[set] ? decide(dataSets[set].ones, dataSets[set].zeros) : null;

  /* ---------- 实验证据检查（界面与服务端同一函数） ---------- */
  function experimentChecks(stage, record = {}) {
    const ts = Array.isArray(record.trials) ? record.trials.filter(t => t && typeof t === 'object') : [];
    const check = (id, label, complete) => ({ id, label, complete: !!complete });
    if (stage === 'cmd') {
      const valid = ts.filter(t => sounds[t.scene] && finite(t.db) && Math.abs(t.db - sounds[t.scene].base) <= 2 && t.cmd === commandFor(t.db));
      return [
        check('many', '输入至少4种不同的声音', new Set(valid.map(t => t.scene)).size >= 4),
        check('both', '既有“发提示”也有“不发提示”', valid.some(t => t.cmd === 'alarm') && valid.some(t => t.cmd === 'none'))
      ];
    }
    if (stage === 'panel') {
      const dec = ts.filter(t => t.kind === 'decode' && validCode(t.code) && t.code === codeFor('decode', t.seed) && t.states === t.code);
      return [
        check('decode', '按两张不同的指令单把设备开/关对', new Set(dec.map(t => t.code)).size >= 2),
        check('encode', '把设备的状态读成一串1和0', ts.some(t => t.kind === 'encode' && validCode(t.shown) && t.shown === codeFor('encode', t.seed) && t.typed === t.shown))
      ];
    }
    if (stage === 'vote') {
      const ok = ts.filter(t => t.kind === 'count' && countOk(t));
      return [
        check('picnic', '数清“野炊”举牌，统计器给出结果', ok.some(t => t.case === 'picnic')),
        check('monitor', '换一个案例（选班长）再数一次', ok.some(t => t.case === 'monitor'))
      ];
    }
    if (stage === 'truth') {
      return [
        check('s1', '晴天早上：四句话判断真假全对', ts.some(t => t.kind === 'scene' && t.scene === 's1' && sceneOk('s1', t.answers))),
        check('s2', '雨天放学后：同样四句话再判断', ts.some(t => t.kind === 'scene' && t.scene === 's2' && sceneOk('s2', t.answers))),
        check('self', '用真/假回答“你喜欢吃苹果吗？”', ts.some(t => t.kind === 'self' && ['T', 'F'].includes(t.answer)))
      ];
    }
    if (stage === 'not') {
      const m = ts.filter(t => t.kind === 'machine' && [0, 1].includes(t.input) && t.out === NOT(t.input) && t.guess === t.out);
      const l = ts.filter(t => t.kind === 'lamp' && t.wire === 'not' && typeof t.day === 'boolean' && t.lampOn === lampOn('not', t.day));
      return [
        check('machine', '取反机：输入1和0都先猜对输出', m.some(t => t.input === 1) && m.some(t => t.input === 0)),
        check('table', '填好非运算案例分析表并对照', ts.some(t => t.kind === 'table' && tableWrong(t.answers).length === 0)),
        check('lamp', '路灯接上“非”，白天、夜里都试过', l.some(t => t.day) && l.some(t => !t.day))
      ];
    }
    if (stage === 'counter') {
      const runs = ts.filter(t => t.kind === 'run' && dataSets[t.set] && t.out === counterOut(t.set) && t.guess === t.out);
      return [
        check('schematic', '补全统计器的工作过程示意图', ts.some(t => t.kind === 'schematic' && counterOk(t.slots))),
        check('sets', '三组票数都先判断对结果', ['A', 'B', 'C'].every(k => runs.some(t => t.set === k)))
      ];
    }
    return [];
  }

  /* ---------- “说清楚”卡片的目标答案 ---------- */
  const sortExplain = Object.fromEntries(Object.entries(switchCards).map(([k, v]) => ['sort:' + k, v.kind]));
  const goals = {
    cmd: { prediction: 'two', explain: { evidence: 'two', where: 'judge', diff: 'two-state' }, transfer: 'switch' },
    panel: { prediction: 'on', explain: { evidence: 'one-on', ...sortExplain }, transfer: 'off' },
    vote: { prediction: 'two', explain: { evidence: 'switch', compute: 'compute', kinds: 'two' }, transfer: 'switch' },
    truth: { prediction: 'true', explain: { evidence: 'state', digit: 'one', off: 'false' }, transfer: 'true1' },
    not: { prediction: 'open', explain: { evidence: 'flip', rule: 'neg', lamp: 'opposite' }, transfer: 'flip' },
    counter: { prediction: 'go', explain: { evidence: 'greater', instr: 'switch', neg: 'nogo' }, transfer: 'nogo' }
  };
  const predictionValues = {
    cmd: ['many', 'two', 'three'], panel: ['on', 'off', 'half'], vote: ['two', 'many', 'three'],
    truth: ['true', 'false', 'none'], not: ['open', 'closed', 'half'], counter: ['go', 'nogo', 'tie']
  };
  const transferItems = ['A', 'B'];
  const optionValues = {
    cmd: { evidence: ['two', 'many', 'one'], where: ['judge', 'input', 'screen'], diff: ['two-state', 'continuous', 'bigger'], transfer: ['switch', 'continuous', 'none'] },
    panel: { evidence: ['one-on', 'one-off', 'count'], ...Object.fromEntries(Object.keys(switchCards).map(k => ['sort:' + k, ['s', 'c']])), transfer: ['off', 'on', 'dim'] },
    vote: { evidence: ['switch', 'continuous', 'device'], compute: ['compute', 'input', 'output'], kinds: ['two', 'many', 'three'], transfer: ['switch', 'continuous', 'none'] },
    truth: { evidence: ['state', 'fixed', 'random'], digit: ['one', 'zero', 'two'], off: ['false', 'true', 'half'], transfer: ['true1', 'false0', 'true0'] },
    not: { evidence: ['flip', 'same', 'zero'], rule: ['neg', 'same', 'other'], lamp: ['opposite', 'brighter', 'none'], transfer: ['flip', 'same', 'other'] },
    counter: { evidence: ['greater', 'random', 'broken'], instr: ['switch', 'continuous', 'none'], neg: ['nogo', 'go', 'two'], transfer: ['nogo', 'go', 'tie'] }
  };

  /* ---------- 常见误解：干扰项按误解设计，选错时记录误解标签（教师大屏统计） ---------- */
  const tagLabels = {
    'no-compare': '没有把自己的预测与实验结果对照',
    'cmd-as-continuous': '把指令（开关量）当成连续量，以为指令随数据连续变化',
    'cmd-one': '认为系统只会生成一种指令',
    'cmd-not-data': '认为指令不是数据',
    'gen-at-input': '认为指令在输入数据时就生成了',
    'gen-at-output': '认为指令是显示屏/报警器（输出装置）生成的',
    'switch-size': '用数值大小区分开关量与连续量',
    'digit-reversed': '把1和0（真和假）对应反了',
    'digit-as-number': '把1、0当成数量（1台、0台）而不是两种状态',
    'switch-half': '认为开关量可以有“一半”的中间状态',
    'switch-three': '认为开关量（或投票结果）有三种及以上状态',
    'continuous-as-switch': '把连续量（温度、音量、水位）当成开关量',
    'switch-as-continuous': '把开关状态当成连续量',
    'result-as-count': '把投票人数（统计）与结果指令（开关量）混为一谈',
    'board-as-device': '把举牌用的纸当成设备，没看出举牌的数字是数据',
    'stage-mix': '分不清输入、计算、输出各环节',
    'truth-fixed': '认为一句话的真值固定不变，不看实际状态',
    'truth-random': '认为真值可以随便定',
    'truth-none': '认为开关量没有真值',
    'not-same': '以为非运算后结果不变',
    'not-always-zero': '以为非运算总是输出0（假）',
    'not-other': '把“取反”当成换成另一个具体的东西（如红→蓝），而不是“不是”',
    'tie-random': '平票时认为结果随便定或机器出错，没按规则判断',
    'compare-wrong': '比较1和0的次数时判断反了'
  };
  const optionTags = {
    cmd: { evidence: { many: 'cmd-as-continuous', one: 'cmd-one' }, where: { input: 'gen-at-input', screen: 'gen-at-output' }, diff: { continuous: 'cmd-as-continuous', bigger: 'switch-size' }, transfer: { continuous: 'cmd-as-continuous', none: 'cmd-not-data' } },
    panel: { evidence: { 'one-off': 'digit-reversed', count: 'digit-as-number' }, transfer: { on: 'digit-reversed', dim: 'switch-half' } },
    vote: { evidence: { continuous: 'result-as-count', device: 'board-as-device' }, compute: { input: 'stage-mix', output: 'stage-mix' }, kinds: { many: 'result-as-count', three: 'switch-three' }, transfer: { continuous: 'switch-as-continuous', none: 'cmd-not-data' } },
    truth: { evidence: { fixed: 'truth-fixed', random: 'truth-random' }, digit: { zero: 'digit-reversed', two: 'digit-as-number' }, off: { true: 'digit-reversed', half: 'switch-half' }, transfer: { false0: 'truth-fixed', true0: 'digit-reversed' } },
    not: { evidence: { same: 'not-same', zero: 'not-always-zero' }, rule: { same: 'not-same', other: 'not-other' }, lamp: { brighter: 'not-other', none: 'not-same' }, transfer: { same: 'not-same', other: 'not-other' } },
    counter: { evidence: { random: 'tie-random', broken: 'tie-random' }, instr: { continuous: 'cmd-as-continuous', none: 'cmd-not-data' }, neg: { go: 'not-same', two: 'digit-as-number' }, transfer: { go: 'compare-wrong', tie: 'tie-random' } }
  };
  const predictionTags = {
    cmd: { many: 'cmd-as-continuous', three: 'switch-three' }, panel: { off: 'digit-reversed', half: 'switch-half' },
    vote: { many: 'result-as-count', three: 'switch-three' }, truth: { false: 'digit-reversed', none: 'truth-none' },
    not: { closed: 'not-same', half: 'switch-half' }, counter: { nogo: 'compare-wrong', tie: 'tie-random' }
  };
  function tagFor(stage, key, value) {
    if (!value) return null;
    if (key.startsWith('sort:')) {
      const c = switchCards[key.slice(5)]; if (!c || value === c.kind) return null;
      return c.kind === 'c' ? 'continuous-as-switch' : 'switch-as-continuous';
    }
    return optionTags[stage]?.[key]?.[value] || null;
  }
  /* ---------- 站末句块（只记录，不判分；误解句块计入大屏） ---------- */
  const reflectOptions = {
    cmd: { saw: ['two', 'many'], so: ['switch', 'continuous'] },
    panel: { saw: ['match', 'number'], so: ['onoff', 'count'] },
    vote: { saw: ['two', 'many'], so: ['switch', 'count'] },
    truth: { saw: ['change', 'fixed'], so: ['state', 'fixed'] },
    not: { saw: ['flip', 'same'], so: ['opposite', 'other'] },
    counter: { saw: ['rule', 'random'], so: ['instr', 'random'] }
  };
  const reflectTags = {
    cmd: { many: 'cmd-as-continuous', continuous: 'cmd-as-continuous' }, panel: { number: 'digit-as-number', count: 'digit-as-number' },
    vote: { many: 'result-as-count', count: 'result-as-count' }, truth: { fixed: 'truth-fixed' }, not: { same: 'not-same', other: 'not-other' }, counter: { random: 'tie-random' }
  };
  function validReflect(stage, r) { const o = reflectOptions[stage]; return !!(o && r && typeof r === 'object' && o.saw.includes(r.saw) && o.so.includes(r.so)); }

  const messages = {
    cmd: {
      compare: '对照需再检查：你的预测和指令记录表里出现的指令种类一致吗？',
      evidence: '证据需再检查：数一数指令记录表里一共出现了几种指令。',
      where: '生成指令的步骤需再检查：流程图里哪一步之后才分成“发提示/不发提示”？',
      diff: '指令和音量的不同需再检查：音量可以取中间值，指令呢？',
      transfer: '新情境：控制器发出的指令能取到中间值吗？',
      experiment: '至少输入4种不同的声音，其中既要有超标的，也要有不超标的'
    },
    panel: {
      compare: '对照需再检查：你的预测和你按指令单操作的结果一致吗？',
      evidence: '证据需再检查：指令单上的1对应的设备，是开着还是关着？',
      sort: '开关量分类需再检查：它是只有两种状态，还是能在一个范围内连续变化？',
      transfer: '新情境：收到0，设备是开还是关？',
      experiment: '按两张不同的指令单把设备开/关对，再把设备状态读成一串1和0'
    },
    vote: {
      compare: '对照需再检查：两次举牌，举牌和结果各有几种？',
      evidence: '证据需再检查：举牌的数字和统计器给出的结果，各有几种状态？',
      compute: '“根据人数决定”是哪个环节需再检查：比较、判断属于哪一环节？',
      kinds: '结果种类需再检查：统计器显示过的结果一共几种？',
      transfer: '新情境：这些数据只有几种状态？',
      experiment: '数清两个案例的举牌人数，并判断统计器给出的结果'
    },
    truth: {
      compare: '对照需再检查：举1（同意）对应的真值是什么？',
      evidence: '证据需再检查：同一句话，两个场景里事情的实际状态一样吗？',
      digit: '数字形式需再检查：看真值表，“真”对应哪个数字？',
      off: '真值表需再检查：“关设备”对应的真值是什么？',
      transfer: '新情境：先看事情是不是真的发生了，再对照数字形式。',
      experiment: '在两个场景里判断四句话的真假，并用真/假回答一个问题'
    },
    not: {
      compare: '对照需再检查：取反机把“闭合（1）”变成了什么？',
      evidence: '证据需再检查：回看取反机，输入1和输入0时，输出分别是什么？',
      rule: '非运算需再检查：取反是“不是这样”，还是换成另一样东西？',
      lamp: '路灯需再检查：“天亮了”为真时，灯应该开还是关？',
      transfer: '新情境：非运算后，真值变成了什么？',
      experiment: '取反机先猜对两种输入的输出，填好非运算表，再给路灯接上“非”并在白天、夜里各试一次'
    },
    counter: {
      compare: '对照需再检查：23比17时，统计器输出了什么？',
      evidence: '证据需再检查：20比20时，“1的个数大于0的个数”成立吗？',
      instr: '指令的类型需再检查：统计器的输出有几种状态？',
      neg: '非运算需再检查：“去”是1，取反后是什么？',
      transfer: '新情境：按“1的个数大于0的个数才输出1”的规则判断。',
      experiment: '补全统计器示意图，再对三组票数先判断、再运行'
    }
  };

  /** 判定一份记录：pass、errors、需修订的卡片 wrong、误解标签 tags、分项 parts。 */
  function assess(stage, record) {
    const empty = { prediction: false, experiment: false, explain: false, design: true, transfer: false };
    if (!stageIds.includes(stage) || !record || typeof record !== 'object') return { pass: false, errors: ['还没有本关学习记录'], wrong: [], tags: [], parts: empty };
    const errors = [], wrong = [], tags = new Set();
    const g = goals[stage], m = messages[stage], r = record, ex = obj(r.explain);
    const add = msg => { if (!errors.includes(msg)) errors.push(msg); };
    if (r.submitted !== true) add('请提交本次解释后再检验');
    const predOk = predictionValues[stage].includes(r.prediction);
    if (!predOk) add('先留下你的首次预测');
    const expOk = experimentChecks(stage, r).every(c => c.complete);
    if (!expOk) add(m.experiment);
    const cmp = predOk ? (r.prediction === g.prediction ? 'match' : 'differ') : null;
    if (ex.compare !== cmp) { wrong.push('compare'); add(m.compare); if (ex.compare) tags.add('no-compare'); }
    for (const [k, expect] of Object.entries(g.explain)) {
      if (ex[k] === expect) continue;
      wrong.push(k);
      add(k.startsWith('sort:') ? m.sort : m[k]);
      const t = tagFor(stage, k, ex[k]); if (t) tags.add(t);
    }
    const transferOk = transferItems.includes(r.transferItem || 'A') && r.transfer === g.transfer;
    if (!transferOk) { wrong.push('transfer'); add(m.transfer); const t = tagFor(stage, 'transfer', r.transfer); if (t) tags.add(t); }
    const explainOk = wrong.every(k => k === 'transfer');
    return { pass: errors.length === 0, errors, wrong, tags: [...tags], parts: { prediction: predOk, experiment: expOk, explain: explainOk, design: true, transfer: transferOk } };
  }
  function answerKey(r) { const x = obj(r); return JSON.stringify([x.prediction, obj(x.explain), x.transfer, x.transferItem || 'A']); }

  /**
   * 一站的证据摘要。证据星（出门门禁看 ★≥2）：
   *   ★1 完成本站；★2 解释卡与证据一致（首次或修订后，可二刷挣到）；★3 首次独立（首次检验前未用第3级具体帮助）且解释+迁移首次都对。
   */
  function stageSummary(stage, st, awarded) {
    st = obj(st);
    const fs = st.firstSubmitted, ls = st.lastSubmitted, latest = st.latest || ls;
    const fa = fs ? assess(stage, fs) : null, la = ls ? assess(stage, ls) : null;
    const firstHint = Number(fs?.conceptHintLevel) || 0, independent = firstHint < 3;
    const explainFirst = !!fa?.parts.explain, transferFirst = !!fa?.parts.transfer;
    const explainOk = !!(fa?.parts.explain || la?.parts.explain);
    const stars = awarded ? 1 + (explainOk ? 1 : 0) + (explainFirst && transferFirst && independent ? 1 : 0) : 0;
    const pred = st.first?.prediction || null;
    const reflectSrc = [latest, ls].find(x => validReflect(stage, x?.reflect));
    const reflect = reflectSrc ? { saw: reflectSrc.reflect.saw, so: reflectSrc.reflect.so } : null;
    const rTags = reflect ? [reflectTags[stage][reflect.saw], reflectTags[stage][reflect.so]].filter(Boolean) : [];
    const levels = [latest, ls, fs].map(x => Number(x?.conceptHintLevel) || 0);
    return {
      prediction: pred, predictionCorrect: pred ? pred === goals[stage].prediction : null, predictionTag: pred ? predictionTags[stage][pred] || null : null,
      submitted: !!fs, attempts: Number.isInteger(st.attempts) ? st.attempts : (fs ? 1 : 0), firstPass: !!fa?.pass, passed: !!awarded,
      explainFirst, transferFirst, transferFinal: !!la?.parts.transfer, explainOk,
      firstHintLevel: firstHint, conceptHintLevel: Math.min(3, Math.max(...levels)), opHints: Number(latest?.hints) || 0,
      tagsFirst: fa?.tags || [], tagsLatest: la && !la.pass ? la.tags : [], reflect, reflectTags: [...new Set(rTags)], stars
    };
  }

  /** 第二次检验起的教学引导（不给标准答案）：按未完成证据与误解标签给“观察/思路”。 */
  function retryGuidance(stage, record = {}) {
    const checks = experimentChecks(stage, record).filter(c => !c.complete);
    const tags = Array.isArray(record._tags) ? record._tags : [];
    const tips = {
      cmd: {
        miss: '多换几种声音，让指令记录表里既有超标的，也有不超标的。',
        'cmd-as-continuous': '回看指令记录表：音量有38.x、49.x、66.x……那么多数值，“指令”一栏一共出现过几种写法？',
        'cmd-one': '安静时和吵闹时，指令一栏写的一样吗？',
        'gen-at-input': '刚输入音量时，系统已经知道要不要发提示了吗？它先要做哪一步？',
        'gen-at-output': '报警器只负责执行。“发不发提示”是在哪个菱形框里决定的？',
        'switch-size': '比较的不是数的大小，而是能不能取到中间值。',
        'cmd-not-data': '指令也是控制系统里流动的数据，它被送到报警器。',
        default: '把“音量”和“指令”两栏并排看：哪一栏可以取中间值，哪一栏只有两种？'
      },
      panel: {
        miss: '按指令单从左到右一位一位对照：1对应的设备要打开，0对应的设备要关上。',
        'digit-reversed': '回看你按对的那张指令单：写着1的设备，最后是开着还是关着？',
        'digit-as-number': '每一位只管一台设备的两种状态，不是“几台”。',
        'switch-half': '开关能“开一半”吗？指令单上出现过0和1以外的数字吗？',
        'continuous-as-switch': '温度、音量、水位能取到中间值（如23.5 ℃），它们是第5课的连续量。',
        'switch-as-continuous': '阀门只有接通和断开两种，没有中间的状态。',
        default: '判断方法：只有两种状态（开/关）的是开关量；能在一个范围里连续变化的是连续量。'
      },
      vote: {
        miss: '一个一个点着数：举1的点一下、举0的点一下，最后核对总人数。',
        'result-as-count': '人数会有很多种（9人、10人……），但统计器最后显示的结果有几种？',
        'board-as-device': '纸只是载体，上面写的0或1才是同学们送进系统的数据。',
        'stage-mix': '输入是举牌，输出是显示结果。中间“比较人数、决定去不去”属于哪个环节？',
        'switch-three': '统计器只显示过两种结果。有第三种吗？',
        default: '举牌只有0和1两种，结果也只有两种：它们都像控制系统里的开关量。'
      },
      truth: {
        miss: '先看场景图：雨下没下、灯亮没亮、门开没开、风扇转没转。是这样就选“真”，不是就选“假”。',
        'truth-fixed': '同一句话放在两个场景里，事情的实际状态一样吗？',
        'truth-random': '真值要看事情是不是真的这样，不是随便定的。',
        'digit-reversed': '举1的同学表示“同意”，真值是真还是假？看看真值表的数字形式一栏。',
        'switch-half': '开关量只有真和假两种。',
        default: '“是这样”为真（1），“不是这样”为假（0）。'
      },
      not: {
        miss: '取反机先猜后运行；表格填完点“和参考答案对照”；路灯接上“非”后，白天、夜里各试一次。',
        'not-same': '回看取反机：输入1时，灯牌亮出的数字和输入一样吗？',
        'not-always-zero': '输入0的时候，取反机输出的是什么？',
        'not-other': '“我的外套是红色的”取反，是“不是红色的”。“是蓝色的”说多了还是说少了？',
        default: '非运算就是“取相反结果”：真变假、假变真；开变关、关变开。'
      },
      counter: {
        miss: '示意图按“输入—计算—输出”放三张卡；三组票数都要先选“我判断”，再运行。',
        'tie-random': '规则写的是“1的个数大于0的个数才去”。20和20，大于成立吗？',
        'compare-wrong': '先比较哪一种票多。1的票多才输出1（去）。',
        'cmd-as-continuous': '统计器只会输出“去”或“不去”。票数多少会改变指令的种类吗？',
        'not-same': '“去”是1，非运算是取相反结果。',
        'digit-as-number': '开关量只有1和0，没有2。',
        default: '投票统计器：输入举牌的数字 → 计算比较1和0的次数 → 输出“去/不去”的指令（开关量）。'
      }
    }[stage] || { default: '先完成实验证据，再对照自己的记录说清楚。' };
    const lines = [];
    if (checks.length) lines.push('还缺：' + checks.map(c => c.label).join('；') + '。' + (tips.miss || tips.default));
    for (const tag of tags) if (tips[tag]) lines.push(tips[tag]);
    if (!lines.length) lines.push(tips.default);
    return { active: true, title: '再试一次的小提示', lines: [...new Set(lines)].slice(0, 3) };
  }

  /** 教师测试的达标示例（虚构，不进入班级统计）。 */
  const full = (stage, extra) => ({ explain: { compare: 'match', ...goals[stage].explain }, transfer: goals[stage].transfer, transferItem: 'A', prediction: goals[stage].prediction, ...extra });
  const countTrial = (c, seed) => { const b = crowd(c, seed), ones = b.filter(Boolean).length; return { kind: 'count', case: c, seed, ones, zeros: b.length - ones, decision: decide(ones, b.length - ones) }; };
  const examples = {
    cmd: full('cmd', { trials: ['quiet', 'chat', 'dance', 'moto'].map((s, i) => { const db = measure(s, i + 1); return { scene: s, db, cmd: commandFor(db) }; }) }),
    panel: full('panel', { trials: [1, 2].map(seed => ({ kind: 'decode', seed, code: codeFor('decode', seed), states: codeFor('decode', seed) })).filter((t, i, a) => a.findIndex(x => x.code === t.code) === i).concat([3, 4, 5].map(seed => ({ kind: 'decode', seed, code: codeFor('decode', seed), states: codeFor('decode', seed) }))).concat([{ kind: 'encode', seed: 1, shown: codeFor('encode', 1), typed: codeFor('encode', 1) }]) }),
    vote: full('vote', { trials: [countTrial('picnic', 1), countTrial('monitor', 1)] }),
    truth: full('truth', { trials: [{ kind: 'scene', scene: 's1', answers: { ...truthScenes.s1.facts } }, { kind: 'scene', scene: 's2', answers: { ...truthScenes.s2.facts } }, { kind: 'self', q: 'apple', answer: 'T' }] }),
    not: full('not', { trials: [{ kind: 'machine', input: 1, guess: 0, out: 0 }, { kind: 'machine', input: 0, guess: 1, out: 1 }, { kind: 'table', answers: Object.fromEntries(Object.entries(notCases).map(([k, c]) => [k, c.answer])) }, { kind: 'lamp', wire: 'not', day: true, lampOn: false }, { kind: 'lamp', wire: 'not', day: false, lampOn: true }] }),
    counter: full('counter', { trials: [{ kind: 'schematic', slots: { ...counterAnswer } }, ...['A', 'B', 'C'].map(set => ({ kind: 'run', set, guess: counterOut(set), out: counterOut(set) }))] })
  };
  for (const [k, e] of Object.entries(examples)) { e.submitted = true; e.reflect = { saw: reflectOptions[k].saw[0], so: reflectOptions[k].so[0] }; }

  return {
    stages, stageIds, GOALS, FOCI, LIMIT, rng,
    sounds, measure, commandFor, devices, CODES, codeFor, validCode, switchCards,
    voteCases, CROWD, crowd, decide, countOk, statements, truthScenes, sceneOk,
    NOT, notCases, tableWrong, lampOn, counterParts, counterAnswer, counterOk, dataSets, counterOut,
    experimentChecks, assess, goals, predictionValues, messages, examples,
    transferItems, optionValues, tagLabels, optionTags, predictionTags, tagFor, reflectOptions, reflectTags, validReflect, answerKey, stageSummary, retryGuidance
  };
});
