// ── State ──────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 96; // ~603

let dur = loadDur();
let mode = 'focus';
let timeLeft, totalTime;
let running = false, interval = null;
let stats = loadStats();
let tasks = loadTasks();
let dailyGoal = 8;

// ── Persistence ────────────────────────────────────────────────────────
function loadDur() {
  try { return JSON.parse(localStorage.getItem('pomo_dur')) || {focus:25,short:5,long:15}; }
  catch { return {focus:25,short:5,long:15}; }
}
function saveDur() { localStorage.setItem('pomo_dur', JSON.stringify(dur)); }

function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem('pomo_stats'));
    const today = new Date().toDateString();
    if (s && s.date === today) return s;
  } catch {}
  return { date: new Date().toDateString(), sessions: 0, focusMin: 0, streak: 0 };
}
function saveStats() { localStorage.setItem('pomo_stats', JSON.stringify(stats)); }

function loadTasks() {
  try {
    const t = JSON.parse(localStorage.getItem('pomo_tasks'));
    const today = new Date().toDateString();
    if (t && t.date === today) return t.items || [];
  } catch {}
  return [
    { id: 1, name: 'Read Documentation', cat: 'study',  pomos: 2, done: false },
    { id: 2, name: 'Work on Project',     cat: 'work',   pomos: 3, done: false },
    { id: 3, name: 'Exercise',            cat: 'health', pomos: 1, done: false },
  ];
}
function saveTasks() {
  localStorage.setItem('pomo_tasks', JSON.stringify({ date: new Date().toDateString(), items: tasks }));
}

// ── Init ───────────────────────────────────────────────────────────────
function init() {
  setMode('focus', true);
  renderDurUI();
  renderTasks();
  renderStats();
  renderProgress();
  renderSessionDots();
  checkNotif();

  // Init ring dasharray
  document.getElementById('timerRing').style.strokeDasharray = CIRC;
  document.getElementById('timerRing').style.strokeDashoffset = 0;
}

// ── Mode ───────────────────────────────────────────────────────────────
function setMode(m, init = false) {
  mode = m;
  if (!init) { clearInterval(interval); running = false; }

  totalTime = (m === 'focus' ? dur.focus : m === 'short' ? dur.short : dur.long) * 60;
  timeLeft = totalTime;

  // Tabs
  ['tabFocus','tabShort','tabLong'].forEach((id,i) => {
    const modes = ['focus','short','long'];
    const el = document.getElementById(id);
    el.className = 'tab' + (modes[i] === m ? (m === 'focus' ? ' active' : ' active-break') : '');
  });

  // Timer appearance
  const disp = document.getElementById('timerDisplay');
  const ring = document.getElementById('timerRing');
  const sub  = document.getElementById('timerSub');
  const play = document.getElementById('btnPlay');

  if (m === 'focus') {
    disp.className = 'timer-display';
    ring.className = 'ring-fill';
    sub.textContent = 'Focus';
    play.className = 'btn-play';
  } else {
    disp.className = 'timer-display break-grad';
    ring.className = 'ring-fill break-stroke';
    sub.textContent = m === 'short' ? 'Short Break' : 'Long Break';
    play.className = 'btn-play break-play';
  }

  document.getElementById('btnPlay').innerHTML = '▶';
  updateTimerDisplay();
}

// ── Timer ──────────────────────────────────────────────────────────────
function toggleTimer() {
  if (running) pauseTimer(); else startTimer();
}

function startTimer() {
  running = true;
  document.getElementById('btnPlay').innerHTML = '⏸';
  interval = setInterval(() => {
    if (timeLeft > 0) { timeLeft--; updateTimerDisplay(); }
    else { clearInterval(interval); running = false; onEnd(); }
  }, 1000);
}

function pauseTimer() {
  clearInterval(interval); running = false;
  document.getElementById('btnPlay').innerHTML = '▶';
}

function resetTimer() {
  clearInterval(interval); running = false;
  timeLeft = totalTime;
  document.getElementById('btnPlay').innerHTML = '▶';
  updateTimerDisplay();
}

function skipTimer() {
  clearInterval(interval); running = false;
  onEnd();
}

function onEnd() {
  document.getElementById('btnPlay').innerHTML = '▶';
  playBeep();
  if (mode === 'focus') {
    stats.sessions++;
    stats.focusMin += dur.focus;
    stats.streak++;
    saveStats();
    renderStats();
    renderProgress();
    renderSessionDots();
    notify('Focus done! 🎉 Time to rest.');
    const isLong = stats.sessions % 4 === 0;
    showCongrats(isLong
      ? `Session ${stats.sessions} done! Long break earned 🏆`
      : `Focus session complete! Take a short break ☕`);
    setMode(isLong ? 'long' : 'short');
  } else {
    notify('Break over. Back to focus! ⚡');
    showToast('Break done — stay sharp ⚡');
    setMode('focus');
  }
}

function updateTimerDisplay() {
  const m = String(Math.floor(timeLeft/60)).padStart(2,'0');
  const s = String(timeLeft%60).padStart(2,'0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
  document.title = `${m}:${s} — Pomo ⚡`;
// Ring progress
  const ratio = totalTime > 0 ? timeLeft / totalTime : 1;
  document.getElementById('timerRing').style.strokeDashoffset = CIRC * (1 - ratio);
}

// ── Session dots ────────────────────────────────────────────────────────
function renderSessionDots() {
  const el = document.getElementById('sessionDots');
  const total = 4;
  const done = stats.sessions % 4;
  el.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    if (i < done) d.className = 'sdot done';
    else if (i === done && mode === 'focus') d.className = 'sdot current';
    else d.className = 'sdot';
    el.appendChild(d);
  }
}

// ── Duration ───────────────────────────────────────────────────────────
function changeDur(key, delta) {
  const limits = { focus:[5,90], short:[1,30], long:[5,60] };
  const [mn,mx] = limits[key];
  dur[key] = Math.min(mx, Math.max(mn, dur[key] + delta));
  saveDur();
  renderDurUI();
  if (!running) setMode(mode, true);
}
function renderDurUI() {
  document.getElementById('dFocus').textContent = dur.focus;
  document.getElementById('dShort').textContent = dur.short;
  document.getElementById('dLong').textContent  = dur.long;
}

// ── Tasks ──────────────────────────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById('taskList');
  const count = document.getElementById('tasksCount');
  const done = tasks.filter(t=>t.done).length;
  count.textContent = `${done}/${tasks.length}`;
  list.innerHTML = '';
  tasks.forEach((t, idx) => {
    const row = document.createElement('div');
    row.className = 'task-item' + (idx === 0 && !t.done ? ' active-task' : '');
    row.innerHTML = `
      <div class="task-check ${t.done?'done':''}" onclick="toggleTask(${t.id})"></div>
      <div class="task-info">
        <div class="task-name ${t.done?'done-text':''}">${escHtml(t.name)}</div>
        <div class="task-meta">
          <span class="task-cat cat-${t.cat}">${t.cat}</span>
        </div>
      </div>
      <div class="task-pomo"><span class="task-pomo-icon">🍅</span>${t.pomos}</div>
    `;
    list.appendChild(row);
  });
}
function toggleTask(id) {
  const t = tasks.find(t=>t.id===id);
  if (t) { t.done = !t.done; saveTasks(); renderTasks(); renderProgress(); }
}
function addTask() {
  const inp = document.getElementById('newTaskInput');
  const name = inp.value.trim();
  if (!name) return;
  const cats = ['study','work','health','learn'];
  tasks.push({ id: Date.now(), name, cat: cats[Math.floor(Math.random()*cats.length)], pomos: Math.ceil(Math.random()*3)+1, done: false });
  saveTasks(); renderTasks();
  inp.value = '';
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Progress ────────────────────────────────────────────────────────────
function renderProgress() {
  const pct = Math.min(100, Math.round((stats.sessions / dailyGoal) * 100));
  document.getElementById('dailyPct').textContent = pct + '%';
  document.getElementById('dailyTasksDone').textContent = `${stats.sessions} of ${dailyGoal} sessions done`;
  const msgs = ['Ready to focus 🎯','Keep it up! 💪','Halfway there 🌟','Almost done 🔥','Daily goal hit! 🏆'];
  const msgIdx = Math.min(4, Math.floor(pct/25));
  document.getElementById('dailyMsg').textContent = msgs[msgIdx];

  const PROG_CIRC = 2 * Math.PI * 30; // ~188
  const offset = PROG_CIRC * (1 - pct/100);
  document.getElementById('dailyProgRing').style.strokeDasharray = PROG_CIRC;
  document.getElementById('dailyProgRing').style.strokeDashoffset = offset;
}
// ── Stats ───────────────────────────────────────────────────────────────
function renderStats() {
  document.getElementById('statPomos').textContent = stats.sessions;
  const h = Math.floor(stats.focusMin/60), m = stats.focusMin%60;
  document.getElementById('statTime').textContent = h > 0 ? `${h}h${m}m` : `${m}m`;
  document.getElementById('statStreak').textContent = stats.streak + '🔥';
}

// ── Notifications ────────────────────────────────────────────────────────
function checkNotif() {
  if ('Notification' in window && Notification.permission === 'default') {
    document.getElementById('notifBanner').classList.remove('hidden');
  }
}
document.getElementById('enableNotifBtn').onclick = () => {
  Notification.requestPermission().then(() => {
    document.getElementById('notifBanner').classList.add('hidden');
  });
};
document.getElementById('headerNotifBtn').onclick = () => {
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  } else {
    showToast('Notifications already enabled ✓');
  }
};
function notify(msg) {
  if (Notification.permission === 'granted') {
    new Notification('Pomo ⚡', { body: msg });
  }
}

// ── Sound ───────────────────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[440,0],[554,0.18],[659,0.36],[880,0.54]].forEach(([f,t]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = f; o.type = 'sine';
      const s = ctx.currentTime + t;
      g.gain.setValueAtTime(0,s);
      g.gain.linearRampToValueAtTime(0.2, s+0.04);
      g.gain.exponentialRampToValueAtTime(0.001, s+0.3);
      o.start(s); o.stop(s+0.3);
    });
  } catch(e) {}
}

// ── Toast ────────────────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Congrats ─────────────────────────────────────────────────────────────
function showCongrats(msg) {
  document.getElementById('congratsSub').textContent = msg;
  document.getElementById('congratsOverlay').classList.add('show');
}
function closeCongratas() {
  document.getElementById('congratsOverlay').classList.remove('show');
}

// ── Keyboard ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
  if (e.code === 'KeyR') resetTimer();
  if (e.code === 'Digit1') setMode('focus');
  if (e.code === 'Digit2') setMode('short');
  if (e.code === 'Digit3') setMode('long');
});

function scrollToStats() {
  document.getElementById('statsSection').scrollIntoView({ behavior: 'smooth' });
}

init();
