/*
 * Focus Tracker — v2 enhancements (self-contained; relies on app.js globals).
 * Loaded AFTER app.js. Adds: a 14-day momentum chart, a level/XP system, CSV export,
 * and a shareable streak card. It does NOT modify the verified timer/streak engine —
 * it only reads it (getSessions, getSettings, computeStreaks, overallStats, fmt, fmtDur,
 * toast) and renders new widgets, wrapping renderAll so everything stays in sync.
 */
(function () {
  if (typeof renderAll !== "function") return;
  const origRenderAll = renderAll;
  // eslint-disable-next-line no-global-assign
  renderAll = function () { origRenderAll(); renderMomentum(); renderLevel(); };

  /* ---- 14-day momentum bars ---- */
  function dailyMinutes(days) {
    const byDate = {};
    getSessions().forEach((e) => { byDate[e.date] = (byDate[e.date] || 0) + e.minutes; });
    const out = [], today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const ds = fmt(d);
      out.push({ ds, min: byDate[ds] || 0, isToday: i === 0 });
    }
    return out;
  }
  function renderMomentum() {
    const box = document.getElementById("momentum");
    if (!box) return;
    const data = dailyMinutes(14);
    const max = Math.max(...data.map((d) => d.min), 1);
    const goal = getSettings().goal || 120;
    box.innerHTML = "";
    data.forEach((d) => {
      const col = document.createElement("div");
      col.className = "mcol";
      const h = d.min ? Math.max(Math.round((d.min / max) * 100), 4) : 4;
      col.innerHTML =
        `<div class="mbar ${d.min ? "" : "zero"} ${d.isToday ? "today" : ""}" style="height:${h}%" title="${d.ds}: ${fmtDur(d.min)}"></div>` +
        `<div class="ml">${d.ds.slice(8)}</div>`;
      box.appendChild(col);
    });
    const g = document.getElementById("momentum-goal");
    if (g) {
      const frac = Math.min(goal / max, 1);
      g.innerHTML = goal <= max ? `<div class="gl" style="bottom:${frac * 100}%"><span>goal ${goal}m</span></div>` : "";
    }
  }

  /* ---- level / XP (1 focused minute = 1 XP; quadratic curve) ---- */
  const TITLES = [[0, "Getting started"], [480, "Consistent"], [1080, "On a roll"], [1920, "Focused"], [4320, "Disciplined"], [7680, "Relentless"], [12000, "Unstoppable"]];
  function renderLevel() {
    const nameEl = document.getElementById("level-name");
    if (!nameEl) return;
    const xp = getSessions().reduce((a, e) => a + e.minutes, 0);   // total minutes = XP
    let lvl = 1;
    while (xp >= lvl * lvl * 120) lvl++;                            // threshold to reach lvl+1 = lvl^2 * 120
    const cur = (lvl - 1) * (lvl - 1) * 120, next = lvl * lvl * 120;
    const into = xp - cur, span = next - cur || 1;
    const pct = Math.max(0, Math.min(100, Math.round((into / span) * 100)));
    let title = "Getting started";
    TITLES.forEach(([t, n]) => { if (xp >= t) title = n; });
    nameEl.textContent = title;
    document.getElementById("level-badge").textContent = "Lv " + lvl;
    document.getElementById("level-bar").style.width = pct + "%";
    document.getElementById("level-sub").textContent = `${fmtDur(xp)} focused total · ${fmtDur(Math.max(0, next - xp))} to Lv ${lvl + 1}`;
  }

  /* ---- CSV export ---- */
  const csvBtn = document.getElementById("export-csv");
  if (csvBtn) csvBtn.addEventListener("click", () => {
    const s = getSessions();
    if (!s.length) { toast("No sessions to export"); return; }
    const rows = [["date", "subject", "minutes"]];
    s.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((e) =>
      rows.push([e.date, '"' + String(e.subject).replace(/"/g, '""') + '"', e.minutes]));
    const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "focus-tracker-data.csv";
    document.body.appendChild(a); a.click(); a.remove();
    toast("CSV downloaded");
  });

  /* ---- JSON backup + restore (survives a browser-cache wipe) ---- */
  // CSV is for reading in a spreadsheet; this is the real safety net — a full,
  // re-importable copy of sessions + settings, so clearing the browser can't erase months of work.
  const backupBtn = document.getElementById("backup-json");
  if (backupBtn) backupBtn.addEventListener("click", () => {
    const payload = { app: "focus-tracker", version: 2, exportedAt: new Date().toISOString(), sessions: getSessions(), settings: getSettings() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `focus-tracker-backup-${fmt(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    toast("Backup saved — keep it safe");
  });

  const restoreBtn = document.getElementById("restore-json");
  const restoreFile = document.getElementById("restore-file");
  if (restoreBtn && restoreFile) {
    restoreBtn.addEventListener("click", () => restoreFile.click());
    restoreFile.addEventListener("change", () => {
      const file = restoreFile.files && restoreFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let data;
        try { data = JSON.parse(reader.result); } catch (e) { toast("That file isn't a valid backup"); restoreFile.value = ""; return; }
        if (!data || !Array.isArray(data.sessions)) { toast("That file isn't a Focus Tracker backup"); restoreFile.value = ""; return; }
        // guard the data shape so a broken file can't corrupt storage
        const clean = data.sessions
          .filter((e) => e && typeof e.date === "string" && !isNaN(Number(e.minutes)))
          .map((e) => ({ date: e.date, subject: String(e.subject || "Study").slice(0, 40), minutes: Math.round(Number(e.minutes)) }));
        if (!confirm(`Restore ${clean.length} sessions from this backup? This REPLACES the data currently on this device.`)) { restoreFile.value = ""; return; }
        setSessions(clean);
        if (data.settings && typeof data.settings === "object") setSettings(data.settings);
        restoreFile.value = "";
        renderAll();
        toast(`Restored ${clean.length} sessions`);
      };
      reader.readAsText(file);
    });
  }

  /* ---- auto-break: offered after a full focus block finishes ---- */
  // Purely a rest timer — it never logs a study session. Exposed as a global so
  // app.js's completeSession() can call it without importing anything.
  const BREAK_MIN = 5;
  let breakId = null;
  const breakEl = () => document.getElementById("break-banner");
  function stopBreak() { clearInterval(breakId); breakId = null; const el = breakEl(); if (el) el.hidden = true; }
  window.offerBreak = function () {
    const el = breakEl();
    if (!el) return;
    stopBreak();
    el.hidden = false;
    el.className = "break-banner offer";
    el.innerHTML =
      `<span>☕ Block done. Take a ${BREAK_MIN}-min break so you come back fresh.</span>` +
      `<span class="break-actions"><button id="break-start" class="ghost-btn tiny">Start break</button><button id="break-skip" class="ghost-btn tiny">Skip</button></span>`;
    document.getElementById("break-skip").addEventListener("click", stopBreak);
    document.getElementById("break-start").addEventListener("click", () => startBreak(BREAK_MIN));
  };
  function startBreak(min) {
    const el = breakEl();
    if (!el) return;
    let left = min * 60;
    const paint = () => {
      const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
      el.className = "break-banner running";
      el.innerHTML = `<span>😌 Break — back in <b>${mm}:${ss}</b></span><span class="break-actions"><button id="break-end" class="ghost-btn tiny">End break</button></span>`;
      document.getElementById("break-end").addEventListener("click", stopBreak);
    };
    paint();
    clearInterval(breakId);
    breakId = setInterval(() => {
      left--;
      if (left <= 0) { stopBreak(); toast("Break over — ready for the next block?"); return; }
      paint();
    }, 1000);
  }

  /* ---- shareable streak card (PNG) ---- */
  const shareBtn = document.getElementById("share-card");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    const sessions = getSessions();
    if (!sessions.length) { toast("Run a session first"); return; }
    const { current, best } = computeStreaks(sessions);
    const st = overallStats(sessions);
    const c = document.getElementById("cardCanvas"), x = c.getContext("2d"), W = 1080, H = 1080,
      F = '-apple-system,Segoe UI,Roboto,Arial,sans-serif';
    x.fillStyle = "#0a0c18"; x.fillRect(0, 0, W, H);
    const bg = x.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "rgba(124,139,255,.30)"); bg.addColorStop(.6, "rgba(181,107,255,.15)"); bg.addColorStop(1, "rgba(255,107,214,.18)");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    x.fillStyle = "#12152a"; x.strokeStyle = "rgba(255,255,255,.14)"; x.lineWidth = 3;
    x.beginPath(); x.roundRect(60, 60, W - 120, H - 120, 48); x.fill(); x.stroke();
    x.textAlign = "center";
    x.fillStyle = "#b9bdf0"; x.font = "700 40px " + F; x.fillText("FOCUS TRACKER", W / 2, 185);
    x.fillStyle = "#fff"; x.font = "800 210px " + F; x.fillText(current, W / 2, 480);
    x.fillStyle = "#ffb27a"; x.font = "600 46px " + F; x.fillText("day streak 🔥", W / 2, 552);
    const cells = [[fmtDur(st.totalMin), "focused"], [best, "best streak"], [st.consistency + "%", "consistency"]];
    cells.forEach((cl, i) => {
      const cx = W / 2 + (i - 1) * 300;
      x.fillStyle = "#fff"; x.font = "800 74px " + F; x.fillText(cl[0], cx, 770);
      x.fillStyle = "#9fa3cc"; x.font = "500 34px " + F; x.fillText(cl[1], cx, 822);
    });
    x.fillStyle = "#8f93c0"; x.font = "400 31px " + F; x.fillText("built by a student, for students rebuilding their grades", W / 2, 955);
    c.toBlob((b) => {
      const file = new File([b], "focus-streak.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Focus Tracker" }).catch(() => {});
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "focus-streak.png";
      document.body.appendChild(a); a.click(); a.remove(); toast("Card saved");
    }, "image/png");
  });

  /* initial paint — app.js already ran renderAll() once before this file loaded */
  renderMomentum();
  renderLevel();
})();
