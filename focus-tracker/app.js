/*
 * Focus Tracker — study companion for students rebuilding their grades.
 *
 * WHY THIS EXISTS (and why a plain timer isn't enough):
 * a stopwatch forgets the moment you stop it. This one RUNS your focus session
 * and then remembers it — it builds your day streak, keeps a daily goal, and
 * shows how your minutes split across subjects so a neglected class is obvious.
 *
 * All data lives only in this browser's localStorage. No account, no server,
 * nothing leaves the device.
 *
 * Data model:
 *   sessions: [{ date:"YYYY-MM-DD", subject:"Math", minutes: 45 }]
 *   settings: { goal: <daily minutes goal>, subjects: [ ...names ] }
 */

const STORE = { sessions: "ft.sessions.v2", settings: "ft.settings.v2" };
const DEFAULT_SUBJECTS = ["Math", "Physics", "Chemistry", "English", "Biology"];
const DEFAULT_GOAL = 120;
const RING_C = 2 * Math.PI * 52; // circumference of the ring (r = 52)

let selectedSubject = null;
let selectedMinutes = 45;
let subjectRange = "week";
let timer = { total: 0, remaining: 0, running: false, id: null, inSession: false };

/* ---------- storage ---------- */
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    toast("Storage blocked (private mode?)");
  }
}
const getSessions = () => load(STORE.sessions, []);
const setSessions = (s) => save(STORE.sessions, s);
function getSettings() {
  const s = load(STORE.settings, {});
  return { goal: s.goal || DEFAULT_GOAL, subjects: s.subjects || DEFAULT_SUBJECTS.slice() };
}
const setSettings = (s) => save(STORE.settings, s);

/* ---------- dates ---------- */
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const todayStr = () => fmt(new Date());
function dayIndex(ds) {
  const [y, m, d] = ds.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/* ---------- logging ---------- */
function logSession(subject, minutes, dateStr) {
  minutes = Math.round(minutes);
  if (minutes < 1) return;
  const s = getSessions();
  s.push({ date: dateStr || todayStr(), subject: (subject || "Study").trim() || "Study", minutes });
  setSessions(s);
}

/* ---------- derivations ---------- */
function computeStreaks(sessions) {
  const days = [...new Set(sessions.map((e) => dayIndex(e.date)))].sort((a, b) => a - b);
  if (!days.length) return { current: 0, best: 0 };
  let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  const set = new Set(days);
  const today = dayIndex(todayStr());
  let start = set.has(today) ? today : set.has(today - 1) ? today - 1 : null;
  if (start === null) return { current: 0, best };
  let current = 0, d = start;
  while (set.has(d)) { current++; d--; }
  return { current, best };
}
function todayStats(sessions) {
  const t = todayStr();
  const today = sessions.filter((e) => e.date === t);
  return { minutes: today.reduce((a, e) => a + e.minutes, 0), count: today.length };
}
function weekStats(sessions) {
  const today = dayIndex(todayStr());
  const days = new Set();
  let minutes = 0;
  sessions.forEach((e) => {
    const di = dayIndex(e.date);
    if (di > today - 7 && di <= today) { minutes += e.minutes; days.add(di); }
  });
  return { days: days.size, minutes };
}
function subjectTotals(sessions, range) {
  const today = dayIndex(todayStr());
  const totals = {};
  sessions.forEach((e) => {
    if (range === "week" && dayIndex(e.date) <= today - 7) return;
    totals[e.subject] = (totals[e.subject] || 0) + e.minutes;
  });
  return Object.entries(totals).map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);
}
function overallStats(sessions) {
  const totalMin = sessions.reduce((a, e) => a + e.minutes, 0);
  const studyDays = new Set(sessions.map((e) => e.date)).size;
  const avg = studyDays ? Math.round(totalMin / studyDays) : 0;
  const top = subjectTotals(sessions, "all")[0];
  const today = dayIndex(todayStr());
  const recentDays = new Set(sessions.map((e) => dayIndex(e.date)).filter((d) => d > today - 28 && d <= today)).size;
  return { totalMin, avg, top: top ? top.name : "—", consistency: Math.round((recentDays / 28) * 100) };
}

/* ---------- formatting ---------- */
function fmtDur(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function mmss(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- rendering ---------- */
function renderSubjectChips() {
  const { subjects } = getSettings();
  if (!selectedSubject || !subjects.includes(selectedSubject)) selectedSubject = subjects[0];
  const box = document.getElementById("subject-chips");
  box.innerHTML = "";
  subjects.forEach((name) => {
    const b = document.createElement("button");
    b.className = "chip" + (name === selectedSubject ? " active" : "");
    b.textContent = name;
    b.addEventListener("click", () => {
      if (timer.inSession) return;
      selectedSubject = name;
      renderSubjectChips();
    });
    box.appendChild(b);
  });
}
function renderTimerDisplay() {
  const total = timer.inSession ? timer.total : selectedMinutes * 60;
  const remaining = timer.inSession ? timer.remaining : total;
  document.getElementById("timer-time").textContent = mmss(remaining);
  const ring = document.getElementById("timer-ring");
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (remaining / total); // fills up as you focus
}
function renderToday() {
  const { goal } = getSettings();
  const { minutes, count } = todayStats(getSessions());
  const frac = Math.min(1, goal ? minutes / goal : 0);
  document.getElementById("today-min").textContent = fmtDur(minutes);
  document.getElementById("today-sub").textContent = `${count} session${count === 1 ? "" : "s"} · goal ${goal} min`;
  const pct = document.getElementById("goal-pct");
  pct.textContent = `${Math.round(frac * 100)}% of goal`;
  pct.classList.toggle("hit", frac >= 1);
  const ring = document.getElementById("goal-ring");
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - frac);
}
function renderStreaks() {
  const s = getSessions();
  const { current, best } = computeStreaks(s);
  document.getElementById("current-streak").textContent = current;
  document.getElementById("best-streak").textContent = best;
  document.getElementById("week-count").textContent = `${weekStats(s).days}/7`;
}
function renderSubjectBars() {
  const rows = subjectTotals(getSessions(), subjectRange);
  const box = document.getElementById("subject-bars");
  if (!rows.length) {
    box.innerHTML = '<div class="empty-state">No sessions yet — run a focus block to see where your time goes.</div>';
    return;
  }
  const max = rows[0].minutes || 1;
  box.innerHTML = "";
  rows.forEach((r) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML =
      `<span class="name">${escapeHtml(r.name)}</span>` +
      `<span class="bar-track"><span class="bar-fill" style="width:${(r.minutes / max) * 100}%"></span></span>` +
      `<span class="val">${fmtDur(r.minutes)}</span>`;
    box.appendChild(row);
  });
}
function renderHeatmap() {
  const byDate = {};
  getSessions().forEach((e) => { byDate[e.date] = (byDate[e.date] || 0) + e.minutes; });
  const map = document.getElementById("heatmap");
  map.innerHTML = "";
  const today = new Date();
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = fmt(d);
    const cell = document.createElement("div");
    cell.className = "cell";
    const min = byDate[ds];
    if (min !== undefined) cell.classList.add(min >= 90 ? "high" : min >= 45 ? "mid" : "low");
    if (i === 0) cell.classList.add("today");
    cell.title = min !== undefined ? `${ds} · ${fmtDur(min)}` : `${ds} · no study`;
    map.appendChild(cell);
  }
}
function renderStats() {
  const st = overallStats(getSessions());
  document.getElementById("stat-total").textContent = fmtDur(st.totalMin);
  document.getElementById("stat-avg").textContent = fmtDur(st.avg);
  document.getElementById("stat-top").textContent = st.top;
  document.getElementById("stat-consistency").textContent = `${st.consistency}%`;
}
function renderRecent() {
  const sessions = getSessions().map((s, i) => ({ ...s, _i: i }));
  sessions.sort((a, b) => b.date.localeCompare(a.date) || b._i - a._i);
  const ul = document.getElementById("recent-list");
  if (!sessions.length) {
    ul.innerHTML = '<li class="empty-state">No sessions yet. Your first focus block starts the chain.</li>';
    return;
  }
  ul.innerHTML = "";
  sessions.slice(0, 8).forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="r-sub">${escapeHtml(e.subject)}</span><span class="r-meta">${fmtDur(e.minutes)} · ${e.date}</span>`;
    ul.appendChild(li);
  });
}
function renderAll() {
  renderSubjectChips();
  renderTimerDisplay();
  renderToday();
  renderStreaks();
  renderSubjectBars();
  renderHeatmap();
  renderStats();
  renderRecent();
}

/* ---------- timer engine ---------- */
function updateControls() {
  const start = document.getElementById("start-btn");
  const pause = document.getElementById("pause-btn");
  const end = document.getElementById("end-btn");
  const card = document.getElementById("focus-card");
  if (timer.running) {
    start.hidden = true; pause.hidden = false; end.hidden = false;
    card.classList.add("running");
    document.getElementById("timer-label").textContent = `Focusing · ${selectedSubject}`;
  } else if (timer.inSession) {
    start.hidden = false; start.textContent = "▶ Resume"; pause.hidden = true; end.hidden = false;
    card.classList.remove("running");
    document.getElementById("timer-label").textContent = "Paused";
  } else {
    start.hidden = false; start.textContent = "▶ Start focus"; pause.hidden = true; end.hidden = true;
    card.classList.remove("running");
    document.getElementById("timer-label").textContent = "Ready to focus";
  }
}
function tick() {
  timer.remaining--;
  if (timer.remaining <= 0) { timer.remaining = 0; renderTimerDisplay(); completeSession(); return; }
  renderTimerDisplay();
}
function startTimer() {
  if (timer.running) return;
  if (!timer.inSession) { timer.total = selectedMinutes * 60; timer.remaining = timer.total; timer.inSession = true; }
  timer.running = true;
  timer.id = setInterval(tick, 1000);
  updateControls();
  renderTimerDisplay();
}
function pauseTimer() {
  timer.running = false;
  clearInterval(timer.id);
  updateControls();
}
function resetIdle() {
  clearInterval(timer.id);
  timer = { total: selectedMinutes * 60, remaining: selectedMinutes * 60, running: false, id: null, inSession: false };
  updateControls();
  renderTimerDisplay();
}
function completeSession() {
  clearInterval(timer.id);
  const minutes = Math.round(timer.total / 60);
  logSession(selectedSubject, minutes);
  resetIdle();
  renderAll();
  const { current } = computeStreaks(getSessions());
  toast(`🎉 ${minutes}m of ${selectedSubject} logged · ${current}-day streak`);
}
function endTimer() {
  const elapsedMin = Math.round((timer.total - timer.remaining) / 60);
  clearInterval(timer.id);
  if (elapsedMin >= 1) {
    logSession(selectedSubject, elapsedMin);
    resetIdle();
    renderAll();
    toast(`Logged ${elapsedMin}m of ${selectedSubject}`);
  } else {
    resetIdle();
    toast("Session too short to log");
  }
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

/* ---------- events ---------- */
function wire() {
  document.querySelectorAll("#duration-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (timer.inSession) return;
      document.querySelectorAll("#duration-chips .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      selectedMinutes = parseInt(chip.dataset.min, 10);
      resetIdle();
    });
  });
  document.getElementById("add-subject-btn").addEventListener("click", () => {
    const input = document.getElementById("new-subject");
    const name = input.value.trim();
    if (!name) return;
    const s = getSettings();
    if (!s.subjects.includes(name)) { s.subjects.push(name); setSettings(s); }
    selectedSubject = name;
    input.value = "";
    renderSubjectChips();
  });
  document.getElementById("start-btn").addEventListener("click", startTimer);
  document.getElementById("pause-btn").addEventListener("click", pauseTimer);
  document.getElementById("end-btn").addEventListener("click", endTimer);

  document.getElementById("goal-edit").addEventListener("click", () => {
    const s = getSettings();
    const val = prompt("Daily study goal in minutes:", s.goal);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) { s.goal = n; setSettings(s); renderToday(); }
  });
  document.querySelectorAll("#range-toggle button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll("#range-toggle button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      subjectRange = b.dataset.range;
      renderSubjectBars();
    });
  });
  document.getElementById("manual-add").addEventListener("click", () => {
    const subj = document.getElementById("m-subject").value.trim();
    const min = parseInt(document.getElementById("m-minutes").value, 10);
    const date = document.getElementById("m-date").value || todayStr();
    if (!subj || isNaN(min) || min < 1) { toast("Enter a subject and minutes"); return; }
    logSession(subj, min, date);
    document.getElementById("m-subject").value = "";
    document.getElementById("m-minutes").value = "";
    renderAll();
    toast(`Added ${min}m of ${subj}`);
  });
  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("Clear ALL your data on this device? This cannot be undone.")) {
      localStorage.removeItem(STORE.sessions);
      localStorage.removeItem(STORE.settings);
      selectedSubject = null;
      selectedMinutes = 45;
      resetIdle();
      renderAll();
      toast("All data cleared");
    }
  });
}

/* ---------- init ---------- */
function injectGradient() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.innerHTML =
    '<defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#7c8bff"/><stop offset="100%" stop-color="#b56bff"/>' +
    "</linearGradient></defs>";
  document.body.appendChild(svg);
}
injectGradient();
document.getElementById("m-date").value = todayStr();
wire();
resetIdle();
renderAll();
