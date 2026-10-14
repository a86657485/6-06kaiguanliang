/* 取反闪电站：键盘 F/J 或鼠标作答，音效默认关闭，不使用麦克风。学生模式成绩由服务端重放核算；/game-test 只留在本页。 */
const C = window.LampCore, $ = id => document.getElementById(id);
const testMode = location.pathname === '/game-test';
let me = null, qs = [], idx = -1, log = [], t0 = 0, timer = null, seed = 0, score = 0, soundOn = false, ac = null, locked = false;
async function api(p, body) {
  const r = await fetch(p, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.error || '请求失败'), { status: r.status }); return j;
}
function beep(ok) { if (!soundOn) return; ac ||= new AudioContext(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = ok ? 880 : 220; g.gain.value = 0.08; o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.12); }
$('sound').onclick = () => { soundOn = !soundOn; $('sound').textContent = soundOn ? '🔊 音效开' : '🔇 音效关'; $('sound').setAttribute('aria-pressed', soundOn); };
function hud() { $('hud').textContent = `第 ${Math.max(0, idx + 1)}/${C.ROUNDS} 题 · ${Math.round(score * 10) / 10} 分`; }
function sceneHtml(q) {
  const s = C.byScene[q.scene];
  return `<div class="sensor"><div class="big">${s.icon}</div><div class="q">${s.input}</div><div class="bit">A = ${q.a}</div><div class="q">${q.a ? '是（真）' : '否（假）'}</div></div>
    <div class="op">${q.double ? 'NOT NOT A<br><small>取反两次</small>' : 'NOT A<br><small>取反</small>'} →</div>
    <div class="device" id="dev"><div class="big">${s.icon}</div><div class="q">${s.name} · ${s.device}</div><div class="bit">?</div><div class="q">1=${s.on} / 0=${s.off}</div></div>`;
}
function next() {
  idx++; hud();
  if (idx >= C.ROUNDS) return finish();
  const q = qs[idx]; locked = false; $('scene').innerHTML = sceneHtml(q); $('fb').textContent = ''; $('fb').className = 'fb';
  t0 = performance.now(); const bar = $('timebar');
  clearInterval(timer); timer = setInterval(() => { const left = 1 - (performance.now() - t0) / q.limit; bar.style.width = Math.max(0, left * 100) + '%'; if (left <= 0) answer(null); }, 40);
}
function answer(v) {
  if (locked || idx < 0 || idx >= C.ROUNDS) return; locked = true; clearInterval(timer);
  const q = qs[idx], ms = Math.round(performance.now() - t0), s = C.byScene[q.scene];
  if (v !== null) log.push({ i: q.i, v, ms });
  const ok = v === q.answer && ms <= q.limit;
  if (ok) score += 4 + Math.round((1 - ms / q.limit) * 10) / 10;
  const dev = $('dev'); dev.querySelector('.bit').textContent = q.answer; dev.classList.add(q.answer ? 'lit' : 'dark');
  $('fb').className = 'fb ' + (ok ? 'ok' : 'bad');
  $('fb').textContent = ok ? `✓ 对！A=${q.a}，${q.double ? '取反两次又回到' : '取反后是'} ${q.answer}：${s.device}${q.answer ? s.on : s.off}。`
    : `${v === null ? '⏰ 超时' : '✗ 不对'}：A=${q.a}，${q.double ? 'NOT NOT A' : 'NOT A'} = ${q.answer}，${s.device}应该${q.answer ? s.on : s.off}。`;
  beep(ok); hud(); setTimeout(next, ok ? 650 : 1500);
}
async function finish() {
  $('play').hidden = true; const d = $('done'); d.hidden = false;
  const local = C.replay(seed, log); let status = null, note = '';
  if (!testMode) { try { const r = await api('/api/game/result', { sid: me.student.id, round: me.round, runId: `${seed}-${Date.now()}`, seed, log }); status = r.status; Object.assign(local, r.result); } catch (e) { note = '成绩未能保存：' + e.message; } }
  else note = '教师测试：成绩只留在本页，不写入班级数据。';
  const st = local.stats;
  d.innerHTML = `<h1>${'⭐'.repeat(local.stars) || '再接再厉'}　${local.score} 分</h1>
    <p>答对 ${st.right}/${st.total} 题，超时 ${st.timeout} 题，最长连对 ${st.bestCombo} 题。</p>
    <p>记住：取反就是“相反”——1 变 0，0 变 1；取反两次又回到原来的值。</p><p>${note}</p>
    ${status?.leaderboard?.length ? `<h3>本班排行榜</h3><table><tr><th>#</th><th>姓名</th><th>最好成绩</th><th>星</th></tr>${status.leaderboard.map((x, i) => `<tr><td>${i + 1}</td><td>${x.name.replace(/[<&]/g, '')}</td><td>${x.total}</td><td>${'⭐'.repeat(x.stars)}</td></tr>`).join('')}</table>` : ''}
    <p><button id="again" class="go">再玩一次（空格）</button> <a href="/" style="color:#ffd166">回到校园</a></p>`;
  $('again').onclick = start; $('again').focus();
}
function start() {
  seed = 1 + Math.floor(Math.random() * 2147483646); qs = C.build(seed); idx = -1; log = []; score = 0;
  $('intro').hidden = true; $('done').hidden = true; $('play').hidden = false; next();
}
$('k0').onclick = () => answer(0); $('k1').onclick = () => answer(1); $('start').onclick = start;
addEventListener('keydown', e => {
  if (!$('play').hidden) { if (e.key === 'f' || e.key === 'F') answer(0); if (e.key === 'j' || e.key === 'J') answer(1); return; }
  if (e.key === ' ' && e.target.tagName !== 'BUTTON' && !$('start').disabled) { e.preventDefault(); start(); }
});
window.__lamp = { start, answer, get q() { return qs[idx]; } };
(async () => {
  if (testMode) { $('gate-msg').textContent = '教师测试模式：不受分数限制。'; $('back').href = '/test'; return; }
  try { me = await api('/api/me'); const g = await api('/api/game/status');
    if (!g.unlocked) { $('start').disabled = true; $('gate-msg').textContent = `🔒 最近一次20题考核达到 80 分才能解锁（最近 ${g.latest ?? '—'} 分）。`; }
    else $('gate-msg').textContent = `🎉 已解锁！${g.game?.best ? `你的最好成绩 ${g.game.best.score} 分。` : ''}`;
  } catch { $('start').disabled = true; $('gate-msg').textContent = '请先回到校园登录。'; }
})();
