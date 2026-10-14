import { api, download, escape } from './sync.mjs?v=1';
import { summarizeClass } from './teacher-stats.mjs?v=5';
import { renderClassCharts } from './teacher-charts.mjs?v=6';
import { activities } from './activities.mjs?v=5';

const $ = id => document.getElementById(id), R = window.LessonRules;
const DEMO = new URLSearchParams(location.search).get('demo') === '1';
let data = null, stats = null, goals = [], selected = null, chartStage = null, misTag = null, request = 0;
for (let c = 601; c <= 606; c++) $('teacher-class').add(new Option(c + '班', String(c)));
const time = v => v ? new Date(v).toLocaleTimeString('zh-CN', { hour12: false }) : '未进入';
const done = (s, id) => (s.awards || []).some(a => a.stage === id);
const sumOf = (s, id) => s.records?.[id]?.summary || R.stageSummary(id, s.records?.[id] || {}, done(s, id));
const starTxt = n => '★'.repeat(n) + '☆'.repeat(3 - n);
function phase(s, id) { if (done(s, id)) { const n = sumOf(s, id).stars; return `<span class="${n === 3 ? 'st3' : ''}" title="证据星 ${n}/3">${starTxt(n)}</span>`; } const r = s.records?.[id]; if (r?.lastSubmitted && !r.lastSubmitted.assessment?.pass) return '需修订'; return r?.first || r?.latest ? '进行中' : '—'; }
function current(s) { if (!s.updated) return '未进入'; const next = R.stages.find(t => !done(s, t.id)); return next ? next.short : '主线完成'; }
const tagsOf = s => [...new Set(R.stageIds.flatMap(id => { const m = sumOf(s, id); return [...(m.tagsLatest || []), ...(m.reflectTags || []), ...(done(s, id) ? [] : m.tagsFirst || [])]; }))];
const actions = {
  cmd: '把两名同学的指令记录表投到大屏，问：“音量一栏有几种数？指令一栏有几种？”再指着流程图的菱形框问“指令在哪一步生成”。',
  panel: '出示“控制指令—设备状态—数字形式”表，请学生按一张新指令单口头说出每台设备开还是关；再追问“教室温度能用1和0表示吗？”',
  vote: '全班真实举牌一次（教参情景剧），请统计员报数；追问“人数有很多种，结果有几种？比较人数是哪个环节？”',
  truth: '按教参只简单提及真值：请喜欢吃苹果的同学说“真”、不喜欢的说“假”，再问“今天下雨吗？”核对“看实际状态”。',
  not: '展示非运算案例表参考答案，让小组对比；针对“优秀/更亮/锁上”这类错选追问：取反是“不是这样”，还是换成别的？',
  counter: '请一名同学口头描述统计器工作过程，再把20:20平票拿出来讨论：“大于”成立吗？输出什么？'
};

if (DEMO) { $('demo-banner').hidden = false; $('demo-toggle').textContent = '回到真实班级'; $('demo-toggle').href = '/teacher'; $('new-round').disabled = true; }
async function load(classId) {
  if (!DEMO) return api('/api/teacher/class?class=' + classId);
  const d = await (await fetch('/demo-class.json', { cache: 'no-store' })).json();
  // 演示文件只有601班；其他班显示空班（用来看“尚无证据”）
  return classId === d.classId ? d : { classId, round: 'r1', at: d.at, demo: true, students: [] };
}
async function refresh() {
  const classId = $('teacher-class').value, n = ++request;
  if (data?.classId !== classId) { data = null; stats = null; clearView(); $('class-status').textContent = classId + '班数据加载中…'; }
  try {
    if (!goals.length) goals = (await api('/api/teacher/answers')).goals;
    const incoming = await load(classId);
    if (n !== request || classId !== $('teacher-class').value) return;
    stats = summarizeClass(incoming, R.stages, goals, R, DEMO ? Date.parse(incoming.at) : Date.now()); data = incoming;
    $('class-status').textContent = DEMO ? `演示数据（虚构）· ${incoming.students.length} 人 · 生成于 ${time(incoming.at)}` : `已更新 ${time(incoming.at)} · ${incoming.round} · 每5秒自动刷新`; $('class-status').className = 'dash-status';
    render();
  } catch (e) {
    if (n !== request) return;
    $('class-status').textContent = '数据未更新：' + e.message + (data ? '（下方仍是 ' + time(data.at) + ' 的旧数据）' : ''); $('class-status').className = 'dash-status warning';
  }
}
const CARDS = { target: 'c-target', progress: 'c-progress', mastery: 'c-mastery', mis: 'c-mis', pred: 'c-pred', hint: 'c-hint', quiz: 'c-quiz', timeline: 'c-timeline', notTable: 'c-not', counter: 'c-counter' };
function clearView() { for (const id of ['summary', 'diagnosis', 'student-rows', ...Object.values(CARDS)]) $(id).innerHTML = ''; $('student-detail').hidden = true; }
function render() {
  const ss = data.students, st = stats;
  const charts = renderClassCharts(st, { stageFilter: chartStage, misTag, R });
  $('summary').innerHTML = charts.kpi;
  for (const [k, id] of Object.entries(CARDS)) $(id).innerHTML = charts[k];
  document.querySelectorAll('[data-chart-stage]').forEach(b => b.onclick = () => { chartStage = chartStage === b.dataset.chartStage ? null : b.dataset.chartStage; render(); });
  document.querySelectorAll('[data-tag]').forEach(b => b.onclick = () => { misTag = misTag === b.dataset.tag ? null : b.dataset.tag; render(); });
  const q = $('teacher-search').value.trim(), unfinished = $('unfinished').checked;
  let rows = ss.filter(s => (!q || s.student.name.includes(q)) && (!unfinished || !R.stages.every(t => done(s, t.id))));
  if (chartStage) rows = rows.filter(s => !done(s, chartStage));
  if (misTag) { const ids = new Set(st.misconceptions.find(m => m.tag === misTag)?.students.map(x => x.id)); rows = rows.filter(s => ids.has(s.student.id)); }
  const mis = misTag && st.misconceptions.find(m => m.tag === misTag);
  $('chart-filter').innerHTML = (chartStage || mis ? `明细筛选：${chartStage ? '「' + R.stages.find(t => t.id === chartStage).short + '」未完成 ' : ''}${mis ? '误解「' + escape(mis.label) + '」' : ''} · <button id="clear-filter" class="subtle">清除图表筛选</button>` : '') + (q ? ` 姓名搜索“${escape(q)}”只影响明细，图表仍为全班。` : '');
  $('clear-filter')?.addEventListener('click', () => { chartStage = null; misTag = null; render(); });
  $('student-rows').innerHTML = rows.map(s => { const tags = tagsOf(s); const stars = R.stageIds.reduce((n, id) => n + (done(s, id) ? sumOf(s, id).stars : 0), 0); return `<tr><td>${escape(s.student.name)}${s.student.manual ? ' <small>手动</small>' : ''}</td><td>${current(s)}</td>${R.stages.map(t => `<td class="phase">${phase(s, t.id)}</td>`).join('')}<td>${stars}/18</td><td class="tags" title="${escape(tags.map(t => R.tagLabels[t] || t).join('；'))}">${tags.length || ''}</td><td>${s.quizAttempts?.[0]?.score ?? '未考'} / ${s.quizAttempts?.at(-1)?.score ?? '未考'}</td><td>${time(s.updated)}</td><td><button data-student="${escape(s.student.id)}">查看证据</button></td></tr>`; }).join('') || '<tr><td colspan="12">没有符合条件的学生。</td></tr>';
  $('student-rows').querySelectorAll('[data-student]').forEach(b => b.onclick = () => { selected = b.dataset.student; detail(); $('student-detail').scrollIntoView({ block: 'nearest' }); });
  if (selected) detail();
  $('diagnosis').innerHTML = '<h2>看到证据，再决定怎样支持</h2><div class="diag">' + R.stages.map((t, i) => {
    const row = st.stages[i], e = row.evidence, top = st.misconceptions.filter(m => m.stages.includes(t.id) && m.unresolved).sort((a, b) => b.students.filter(x => x.stage === t.id && !x.resolved).length - a.students.filter(x => x.stage === t.id && !x.resolved).length)[0];
    return `<div><b>${i + 1} ${escape(t.short)}</b>${e.submitted ? `首次解释一致 ${e.explainFirst}/${e.submitted}，迁移首答 ${e.transferFirst}/${e.submitted}，平均尝试 ${e.attemptsAvg} 次。${top ? `<br>未纠正的误解：<b style="display:inline;font-size:15px">${escape(top.label)}</b>` : ''}<br><span class="note">建议：${actions[t.id]}</span>` : '尚无证据。'}</div>`;
  }).join('') + '</div><p class="note">未提交不计为错误；积分只说明完成了哪些站，理解看“首次解释、迁移首答、提示级别、误解”这些证据。讨论错例时隐去姓名。</p>';
}
function detail() {
  const s = data?.students.find(x => x.student.id === selected); if (!s) return;
  $('student-detail').hidden = false;
  const lab = (list, v) => list?.find(o => o[0] === v)?.[1] || v;
  const predLabel = (id, v) => v ? '“' + lab(activities[id].predict, v) + '”' + (v === R.goals[id].prediction ? '（与目标一致）' : '（与目标不同）') : '尚无证据';
  const tagTxt = a => (a || []).map(t => R.tagLabels[t] || t).join('；') || '无';
  $('student-detail').innerHTML = `<h2>${escape(s.student.name)} 的学习证据</h2><p>${s.student.classId}班 · ${data.round} · 通关积分 ${s.points || 0} · 证据星 ${R.stageIds.reduce((n, id) => n + (done(s, id) ? sumOf(s, id).stars : 0), 0)}/18 · 旧轮次 ${s.roundHistory?.length || 0} 份</p><div class="detail-grid">` +
    R.stages.map(t => { const v = s.records?.[t.id] || {}, m = sumOf(s, t.id); return `<section><h3>${escape(t.name)} · ${phase(s, t.id)}</h3>${v.first || v.latest ? `<p>首次预测：${escape(predLabel(t.id, m.prediction))}</p><p>实验记录 ${v.latest?.trials?.length || 0} 条；检验 ${m.attempts} 次；第一次${m.firstPass ? '全部通过' : '未通过'}</p><p>首次解释：${m.submitted ? (m.explainFirst ? '与证据一致' : '有不一致') : '—'}；迁移：首答${m.submitted ? (m.transferFirst ? '对' : '错') : '—'} / 最终${m.transferFinal ? '对' : '—'}</p><p>想法提示最高第 ${m.conceptHintLevel} 级（首次检验前第 ${m.firstHintLevel} 级）；操作提示 ${m.opHints} 次</p><p>首次误解：${escape(tagTxt(m.tagsFirst))}${m.tagsLatest?.length ? '；仍存在：' + escape(tagTxt(m.tagsLatest)) : ''}</p><p>句块：${m.reflect ? escape('我看到' + lab(activities[t.id].reflect.saw, m.reflect.saw) + '，所以' + lab(activities[t.id].reflect.so, m.reflect.so)) + (m.reflectTags.length ? '（含误解：' + escape(tagTxt(m.reflectTags)) + '）' : '') : '—'}</p>` : '<p>尚无证据</p>'}</section>`; }).join('') +
    `<section><h3>20题考核</h3><p>首次 ${s.quizAttempts?.[0]?.score ?? '未考'}，最近 ${s.quizAttempts?.at(-1)?.score ?? '未考'}；共 ${s.quizAttempts?.length || 0} 次。</p>${(s.quizAttempts || []).map((a, i) => `<p>第${i + 1}次 ${a.score}分：${Object.entries(a.byGoal || {}).map(([g, v]) => escape(g) + ' ' + v.right + '/' + v.total).join('，')}</p>`).join('')}</section></div><button id="detail-close">收起详情</button>`;
  $('detail-close').onclick = () => { selected = null; $('student-detail').hidden = true; };
}
$('teacher-class').onchange = () => { selected = null; chartStage = null; misTag = null; $('student-detail').hidden = true; refresh(); };
$('teacher-search').oninput = () => data && render(); $('unfinished').onchange = () => data && render();
$('class-export').onclick = async () => { if (!data) return; try { download('第6课-' + data.classId + '-' + data.round + (DEMO ? '-演示' : '') + '.json', DEMO ? data : await api('/api/teacher/class?full=1&class=' + data.classId)); } catch (e) { $('class-status').textContent = '导出失败：' + e.message; } };
$('new-round').onclick = async () => {
  if (DEMO || !data || !confirm('为' + data.classId + '班开启新轮次？旧轮次记录会保留，本轮进度和积分重新开始。')) return;
  try { await api('/api/teacher/new-round', { classId: data.classId }); await refresh(); } catch (e) { $('class-status').textContent = e.message; }
};

async function boot() {
  await refresh(); if (!DEMO) setInterval(refresh, 5000);
}
boot().catch(e => { $('class-status').textContent = '教师大屏打开失败：' + e.message; });
