// ── STATE ──────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 88; // 553

let dur = loadDur();
let stats = loadStats();
let tasks = loadTasks();

let mode = 'focus';
let timeLeft = dur.focus * 60;
let totalTime = dur.focus * 60;
let running = false;
let iv = null;
let activeTaskId = null;

const GRADIENTS = {
  focus: 'linear-gradient(160deg, #3d2f80 0%, #1a1640 50%, #0a0a18 100%)',
  short: 'linear-gradient(160deg, #1e4f71 0%, #0d2a40 50%, #070d14 100%)',
  long:  'linear-gradient(160deg, #5a2870 0%, #2c1040 50%, #0a0614 100%)',
};
const LABELS = { focus:'Focus', short:'Short Break', long:'Long Break' };

// ── STORAGE ────────────────────────────────────────────────
function loadDur() {
  try { return JSON.parse(localStorage.getItem('pm_dur')) || {focus:25,short:5,long:15}; }
  catch { return {focus:25,short:5,long:15}; }
}
function saveDur() { localStorage.setItem('pm_dur', JSON.stringify(dur)); }

function loadStats() {
  try {
    const today = new Date().toDateString();
    const s = JSON.parse(localStorage.getItem('pm_stats'));
    if (s && s.date === today) return s;
  } catch {}
  return { date: new Date().toDateString(), sessions:0, minutes:0, streak:0 };
}
function saveStats() { localStorage.setItem('pm_stats', JSON.stringify(stats)); }

function loadTasks() {
  try { return JSON.parse(localStorage.getItem('pm_tasks')) || []; }
  catch { return []; }
}
function saveTasks() { localStorage.setItem('pm_tasks', JSON.stringify(tasks)); }

// ── TIMER ──────────────────────────────────────────────────
function toggleTimer() {
  running ? pause() : start();
}
function start() {
  running = true;
  document.getElementById('btnPlay').textContent = '⏸';
  document.getElementById('ringWrap').classList.add('running');
  iv = setInterval(() => {
    if (timeLeft > 0) { timeLeft--; renderTimer(); }
    else { clearInterval(iv); running = false; onEnd(); }
  }, 1000);
}
function pause() {
  clearInterval(iv); running = false;
  document.getElementById('btnPlay').textContent = '▶';
  document.getElementById('ringWrap').classList.remove('running');
}
function resetTimer() {
  pause();
  timeLeft = totalTime;
  document.getElementById('btnPlay').textContent = '▶';
  renderTimer();
}
function skipTimer() { clearInterval(iv); running = false; onEnd(); }

function onEnd() {
  document.getElementById('btnPlay').textContent = '▶';
  document.getElementById('ringWrap').classList.remove('running');
  playBeep();
  if (mode === 'focus') {
    stats.sessions++; stats.minutes += dur.focus; stats.streak++;
    saveStats(); renderStats(); renderDailyProgress();
    notify('Focus done! 🎉 Take a break.');
    showToast('🔥', 'Focus session complete!');
    // increment task pomodoro
    if (activeTaskId !== null) {
      const t = tasks.find(t => t.id === activeTaskId);
      if (t) { t.pomos = (t.pomos||0)+1; saveTasks(); renderTasks(); }
    }
    const isLong = stats.sessions % 4 === 0;
    setTimeout(() => setMode(isLong ? 'long' : 'short'), 400);
  } else {
    notify('Break over! 💪 Back to focus.');
    showToast('💪', 'Break over — let\'s go!');
    setTimeout(() => setMode('focus'), 400);
  }
}

// ── MODE ───────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  clearInterval(iv); running = false;
  document.getElementById('btnPlay').textContent = '▶';
  document.getElementById('ringWrap').classList.remove('running');

  totalTime = (m === 'focus' ? dur.focus : m === 'short' ? dur.short : dur.long) * 60;
  timeLeft = totalTime;

  // Card gradient
  document.getElementById('timerCard').style.background = GRADIENTS[m];
  document.getElementById('timerModeLabel').textContent = LABELS[m];

  // Tabs
  document.getElementById('tabFocus').className = 'tab' + (m==='focus'?' active-focus':'');
  document.getElementById('tabShort').className = 'tab' + (m==='short'?' active-short':'');
  document.getElementById('tabLong').className = 'tab' + (m==='long'?' active-long':'');

  renderTimer();
  renderSessionDots();
}

// ── RENDER ─────────────────────────────────────────────────
function renderTimer() {
  const m = String(Math.floor(timeLeft/60)).padStart(2,'0');
  const s = String(timeLeft%60).padStart(2,'0');
  document.getElementById('timerDisplay').textContent = `${m}:${s}`;
  document.title = `${m}:${s} — ${LABELS[mode]}`;

  const ratio = totalTime > 0 ? timeLeft / totalTime : 1;
  document.getElementById('timerRing').style.strokeDashoffset = CIRC * (1 - ratio);
}

function renderSessionDots() {
  const wrap = document.getElementById('sessionDots');
  wrap.innerHTML = '';
  const inCycle = stats.sessions % 4;
  for (let i = 0; i < 4; i++) {
    const d = document.createElement('div');
    d.className = 'si-dot' + (i < inCycle ? ' done' : i === inCycle && mode === 'focus' ? ' current' : '');
    wrap.appendChild(d);
  }
}

function renderStats() {
  document.getElementById('statPomos').textContent = stats.sessions;
  const h = Math.floor(stats.minutes/60), m = stats.minutes%60;
  document.getElementById('statMins').textContent = h > 0 ? `${h}h${m}m` : `${m}m`;
  document.getElementById('statStreak').textContent = stats.streak;
}

function renderDailyProgress() {
  const GOAL = 8;
  const pct = Math.min(100, Math.round(stats.sessions / GOAL * 100));
  const CIRC2 = 2 * Math.PI * 22; // 138
  document.getElementById('dailyRing').style.strokeDashoffset = CIRC2 * (1 - pct/100);
  document.getElementById('dailyPct').textContent = `${pct}%`;
  document.getElementById('dailyStatus').textContent = `Daily goal: ${stats.sessions} / ${GOAL} sessions`;
  document.getElementById('dailySubtext').textContent =
    pct === 100 ? '🎉 Goal reached! Amazing!' :
    stats.sessions === 0 ? 'Start your first session!' :
    `${GOAL - stats.sessions} more to reach your goal`;
  document.getElementById('streakTag').textContent = `🔥 ${stats.streak} streak`;
}

// ── TASKS ──────────────────────────────────────────────────
function renderTasks() {
  const list = document.getElementById('taskList');
  const empty = document.getElementById('taskEmpty');
  const badge = document.getElementById('tasksBadge');

  const active = tasks.filter(t => !t.done);
  badge.textContent = active.length;

  if (tasks.length === 0) { list.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  list.innerHTML = tasks.map(t => {
    const catColors = {Design:'#9c93e5',Code:'#74b0cc',Study:'#be74be',Writing:'#ffb347',Other:'#3bbf8a'};
    const cc = catColors[t.category] || '#9c93e5';
    return `<div class="task-item ${t.done?'done-task':''} ${t.id===activeTaskId&&!t.done?'active-task':''}"
      onclick="selectTask(${t.id})">
      <div class="task-active-bar"></div>
      <div class="task-check" onclick="event.stopPropagation();toggleTask(${t.id})">
        ${t.done ? '✓' : ''}
      </div>
      <div class="task-info">
        <div class="task-name">${t.name}</div>
        <div class="task-meta">
          <span class="task-pomo">🍅 ${t.pomos||0}</span>
          <span class="task-cat" style="background:${cc}22;color:${cc}">${t.category}</span>
        </div>
      </div>
      <div class="task-duration">${t.pomos||0}x</div>
    </div>`;
  }).join('');

  // Update active task chip
  const activeTask = tasks.find(t => t.id === activeTaskId && !t.done);
  document.getElementById('activeTaskName').textContent = activeTask ? activeTask.name : 'No task selected';
}

function selectTask(id) {
  if (tasks.find(t => t.id === id)?.done) return;
  activeTaskId = id === activeTaskId ? null : id;
  renderTasks();
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; if (t.done && activeTaskId === id) activeTaskId = null; }
  saveTasks(); renderTasks();
}

function toggleAddTask() {
  const f = document.getElementById('addTaskForm');
  f.classList.toggle('visible');
  if (f.classList.contains('visible')) document.getElementById('taskNameInput').focus();
}

function addTask() {
  const name = document.getElementById('taskNameInput').value.trim();
  if (!name) return;
  const cat = document.getElementById('taskCatSelect').value;
  tasks.unshift({ id: Date.now(), name, category: cat, done: false, pomos: 0 });
  saveTasks();
  document.getElementById('taskNameInput').value = '';
  document.getElementById('addTaskForm').classList.remove('visible');
  renderTasks();
}
document.getElementById('taskNameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTask();
});

// ── DURATION ───────────────────────────────────────────────
function changeDur(key, delta) {
  const min = key==='focus'?5:1, max = key==='focus'?90:60;
  dur[key] = Math.min(max, Math.max(min, dur[key]+delta));
  document.getElementById('dv'+key.charAt(0).toUpperCase()+key.slice(1)).textContent = dur[key];
  saveDur();
  if (!running) {
    if (mode===key || (mode==='focus'&&key==='focus') || (mode==='short'&&key==='short') || (mode==='long'&&key==='long')) {
      totalTime = dur[key]*60; timeLeft = totalTime; renderTimer();
    }
  }
}

function toggleSettings() {
  const s = document.getElementById('durationSection');
  s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

// ── NOTIFICATIONS ──────────────────────────────────────────
function checkNotif() {
  if (!('Notification' in window)) { document.getElementById('notifBar').classList.add('hidden'); return; }
  if (Notification.permission !== 'default') { document.getElementById('notifBar').classList.add('hidden'); }
}
document.getElementById('enableNotif').onclick = () => {
  Notification.requestPermission().then(() => document.getElementById('notifBar').classList.add('hidden'));
};
function notify(msg) {
  if (Notification.permission === 'granted') new Notification('Pomo', { body: msg });
}

// ── SOUND ──────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [[440,0],[554,0.2],[659,0.4]].forEach(([freq,delay]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq; o.type = 'sine';
      const t = ctx.currentTime + delay;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t+0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.4);
      o.start(t); o.stop(t+0.4);
    });
  } catch(e) {}
}

// ── TOAST ──────────────────────────────────────────────────
let toastTimeout;
function showToast(emoji, msg) {
  clearTimeout(toastTimeout);
  document.getElementById('toastEmoji').textContent = emoji;
  document.getElementById('toastMsg').textContent = msg;
  const t = document.getElementById('toast');
  t.classList.add('show');
  toastTimeout = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── KEYBOARD ───────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target !== document.body) return;
  if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
  if (e.code === 'KeyR') resetTimer();
});

// ── INIT ───────────────────────────────────────────────────
document.getElementById('dvFocus').textContent = dur.focus;
document.getElementById('dvShort').textContent = dur.short;
document.getElementById('dvLong').textContent = dur.long;
setMode('focus');
renderStats();
renderDailyProgress();
renderTasks();
checkNotif();
