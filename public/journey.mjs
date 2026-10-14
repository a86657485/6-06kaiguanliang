/* 学习三步的进度、“当前唯一主要操作”与解释卡片顺序（纯函数，便于测试）。 */
import { cardKeys, explainKeys } from './cards.mjs';
export { cardKeys, explainKeys };

export function cardAnswered(stage, record, key) {
  if (key === 'transfer') return typeof record.transfer === 'string' && !!record.transfer;
  return !!record.explain?.[key];
}
export function explainDone(stage, record, rules) { return explainKeys(stage, rules).every(k => cardAnswered(stage, record, k)); }
export function transferDone(stage, record) { return cardAnswered(stage, record, 'transfer'); }
export function learningProgress(stage, record, rules) {
  const checks = rules.experimentChecks(stage, record);
  const experimentDone = checks.length > 0 && checks.every(c => c.complete);
  const eDone = explainDone(stage, record, rules), tDone = transferDone(stage, record);
  return {
    checks, experimentDone, explainDone: eDone, transferDone: tDone,
    initialStep: !record.prediction ? 'predict' : !experimentDone ? 'experiment' : 'explain',
    readyToSubmit: !!record.prediction && experimentDone && eDone && tDone
  };
}

/**
 * 实验步骤中“下一步点哪里”。操作方法可以直接告诉学生：
 * selector 是此刻唯一要突出的控件；tip 是贴在控件旁的一句话；instruction 是小递气泡里的完整说明。
 * selector 为 null 表示正在运行动画，只需观察。
 */
export function nextExperimentAction(stage, checks, o = {}) {
  const missing = checks.find(c => !c.complete);
  const act = (selector, tip, instruction) => ({ selector, tip, instruction: instruction || tip });
  if (!missing) return act('#go-explain', '实验记好了，去说清楚', '实验证据都已自动保存。点亮着的“说清楚”按钮。');
  if (stage === 'cmd') {
    if (o.busy) return act(null, '', '监测器正在测量：看流程图亮起的是哪一条路。');
    if (missing.id === 'many') return act('#sound-cards', '点一种声音输入监测器', '点一张声音卡：监测器测音量，流程图亮出它走的路，指令记录表多一行。至少换4种声音。');
    return act('#sound-cards', o.hasAlarm ? '再试一种安静的声音' : '再试一种吵闹的声音', '记录表里还缺一种指令。换一种' + (o.hasAlarm ? '安静' : '吵闹') + '的声音试试。');
  }
  if (stage === 'panel') {
    if (o.phase === 'encode') return o.typed === 4 ? act('#enc-check', '点“读出指令”', '4位都输入好了，点“读出指令”。') : act('#enc-input', '看设备状态，输入4位1和0', '设备现在有的开着、有的关着。从左到右读成4位1和0，用键盘输入。');
    if (o.needNext) return act('#panel-next', '换一张指令单', '这张指令单执行成功！换一张不同的指令单再做一次。');
    return o.touched ? act('#panel-check', '设好了就检查', '对照指令单设好每台设备后，点“按指令单检查”。') : act('#devices', '按指令单开/关每台设备', '指令单从左到右对应4台设备。点设备下面的开关，打开或关上它。');
  }
  if (stage === 'vote') {
    if (o.needNext) return act('#vote-next', '去下一个案例', '野炊投票完成了。换一个案例：是否同意小林当班长。');
    if (!o.all) return act('#crowd', '点每位同学，数一数', '点一位同学，就把他举的牌记进对应的一栏。全部数完（共15人）。');
    if (!o.decision) return act('#vote-decide', '判断结果', '人数数好了。按“人数多少决定”，你判断统计器会显示什么？');
    return act('#vote-submit', '交给统计器', '点“交给统计器”，看看和你判断的一样吗。');
  }
  if (stage === 'truth') {
    if (o.cur === 'self') return act('#self-pick', '用真或假回答', '你喜欢吃苹果吗？喜欢选“真”，不喜欢选“假”。');
    return o.filled < o.total ? act('#truth-list', '看图，每句选真或假', '看场景图：每句话是这样就选“真”，不是这样就选“假”。') : act('#truth-submit', '提交这个场景', '四句都判断好了，点“提交这个场景”。');
  }
  if (stage === 'not') {
    if (o.part === 'machine') {
      if (o.guess === null) return act('#not-guess', '先猜：输出是1还是0？', `输入是${o.input}。先猜取反机会输出什么，再运行。${o.testedInputs.length === 1 ? '（另一种输入也要试）' : ''}`);
      return act('#not-run', '运行取反机', '点“运行取反机”，看看和你猜的一样吗。');
    }
    if (o.part === 'table') return o.tableFilled < 5 ? act('#not-table', '每行选一个非运算结果', '和同桌讨论：每个案例的状态取反后是什么？每行点一个。') : act('#table-check', '和参考答案对照', '表格填好了，点“和参考答案对照”。');
    if (o.wire !== 'not' && !o.lampDay && !o.lampNight) return act('#lamp-time', '先试一试：白天、夜里', '路灯现在直接连在传感器上。点“白天”“夜里”试一试，看灯什么时候亮。');
    if (o.wire !== 'not') return act('#wire', '改一改接线', '直接连时灯亮得不对。试试另一种接线。');
    return act('#lamp-time', o.lampDay ? '再试“夜里”' : '再试“白天”', '接上“非”后，白天、夜里各试一次。');
  }
  if (stage === 'counter') {
    if (o.part === 'schematic') return o.picked ? act('#schematic-slots', '点它该放的框', '你选了一张卡片。它是输入、计算还是输出？点对应的框。') : act('#schematic-parts', '先点一张卡片', '按“输入—计算—输出”补全统计器的示意图。有一张卡片用不上。');
    if (o.running) return act(null, '', '统计器正在数：看1和0各有多少次。');
    if (o.nextSet && o.set !== o.nextSet && o.setsDone.includes(o.set)) return act('#cnt-set', `选${o.nextSet}组票数`, `这一组完成了。换${o.nextSet}组票数再检验。`);
    if (!o.guess) return act('#cnt-guess', '先判断：去还是不去', '按统计器的规则，这组票数会输出什么？先判断。');
    return act('#cnt-run', '运行统计器', '点“运行统计器”，检验你的判断。');
  }
  return act(null, '', '');
}

/** 检验后需要修订的卡片（直接来自 rules.assess 的 wrong）。 */
export function wrongCards(stage, record, rules) {
  return rules.assess(stage, { ...record, submitted: true }).wrong;
}
/**
 * 说清楚环节的下一张卡与唯一主要操作：
 * 通过后 → 站末句块 → 回到地图；方案不合格 → 回去改方案；否则按卡片顺序找“没答的或需修订的”→ 检验按钮。
 * 只定位要操作的卡片（整组选项），不指向某个选项，概念判断留给学生。
 */
export function explainTarget(stage, record, rules, { revisit = [], reviewed = false, passed = false } = {}) {
  if (passed) {
    const r = record.reflect || {};
    if (!r.saw) return { card: 'reflect', selector: '#reflect-saw', label: '选一句：你看到了什么' };
    if (!r.so) return { card: 'reflect', selector: '#reflect-so', label: '再选一句：所以你认为' };
    if (!record.reflectDone) return { card: 'reflect', selector: '#reflect-done', label: '就这样说' };
    return { card: 'summary', selector: '#next', label: '回到地图' };
  }
  const next = cardKeys(stage, rules).find(k => !cardAnswered(stage, record, k) || revisit.includes(k));
  if (next) return { card: next, selector: `[data-card="${next}"] .card-options`, label: revisit.includes(next) ? '再想想，改一改' : '选一个答案' };
  return { card: 'summary', selector: '#check', label: '检验我的解释' };
}
