"use strict";

/* ---------- state ---------- */
const answers = { type: null, concerns: [], sensitivity: null, budget: null };
let photoSignal = null; // honest heuristic only

/* ---------- photo: honest client-side read ---------- */
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");
const uploaderInner = document.getElementById("uploaderInner");
const photoRead = document.getElementById("photoRead");

fileInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  preview.src = url; preview.hidden = false; uploaderInner.hidden = true;
  preview.onload = () => { analyzePhoto(preview); URL.revokeObjectURL(url); };
});

function analyzePhoto(img) {
  try {
    const c = document.createElement("canvas");
    const w = (c.width = 120), h = (c.height = 120);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let brightPixels = 0, rSum = 0, gSum = 0, bSum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      rSum += r; gSum += g; bSum += b; n++;
      if (lum > 200) brightPixels++;
    }
    const shine = Math.min(1, (brightPixels / n) * 4);
    const redness = Math.min(1, Math.max(0, (rSum - (gSum + bSum) / 2) / n / 40));
    photoSignal = { shine, redness };
    const a = shine > 0.45 ? "I see a fair bit of shine" : shine > 0.2 ? "I see a little shine" : "I don't see much shine";
    const b = redness > 0.5 ? "and some redness" : "and fairly even tone";
    photoRead.hidden = false;
    photoRead.innerHTML = `<strong>Quick read:</strong> ${a} ${b}. Just a starting hint, your answers below matter more.`;
  } catch (_) { photoSignal = null; }
}

/* ---------- quiz ---------- */
document.querySelectorAll(".opts").forEach((group) => {
  const key = group.dataset.q;
  const multi = group.classList.contains("multi");
  const max = parseInt(group.dataset.max || "1", 10);
  group.querySelectorAll(".opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.v;
      if (multi) {
        const arr = answers[key], idx = arr.indexOf(v);
        if (idx >= 0) { arr.splice(idx, 1); btn.classList.remove("sel"); }
        else { if (arr.length >= max) return; arr.push(v); btn.classList.add("sel"); }
      } else {
        answers[key] = v;
        group.querySelectorAll(".opt").forEach((b) => b.classList.remove("sel"));
        btn.classList.add("sel");
      }
      refreshGate();
    });
  });
});
const buildBtn = document.getElementById("build");
const hint = document.getElementById("hint");
const ready = () => answers.type && answers.concerns.length >= 1 && answers.sensitivity && answers.budget;
function refreshGate(){ buildBtn.disabled = !ready(); hint.style.display = ready() ? "none" : "block"; }

/* ---------- product knowledge base (wide brand range, KZ-buyable, budget + mid) ---------- */
// tiers: 'budget' (drugstore / affordable) and 'mid' (a few good products)
const STEPS = {
  sunscreen: { title: "Sunscreen SPF 30+", why: "The one product that does the most for dark spots and aging.",
    picks: [
      { n: "Anthelios UVMune 400", b: "La Roche‑Posay", t: "mid" },
      { n: "Ultra Light Daily Fluid SPF 60", b: "CeraVe", t: "budget" },
      { n: "Hydro Boost Water Gel SPF", b: "Neutrogena", t: "budget" },
      { n: "Aqua‑Gel Sunscreen SPF 50", b: "COSRX", t: "mid" },
    ] },
  cleanserGentle: { title: "Gentle cleanser", why: "Cleans without stripping your skin barrier.",
    picks: [
      { n: "Hydrating Cleanser", b: "CeraVe", t: "budget" },
      { n: "Toleriane Hydrating Cleanser", b: "La Roche‑Posay", t: "mid" },
      { n: "Gentle Skin Cleanser", b: "Cetaphil", t: "budget" },
      { n: "Low pH Good Morning Cleanser", b: "COSRX", t: "budget" },
    ] },
  cleanserFoaming: { title: "Gentle foaming cleanser", why: "Lifts extra oil without over‑drying.",
    picks: [
      { n: "Foaming Facial Cleanser", b: "CeraVe", t: "budget" },
      { n: "Effaclar Gel Cleanser", b: "La Roche‑Posay", t: "mid" },
      { n: "Squalane + Amino Acids Cleanser", b: "The Ordinary", t: "budget" },
      { n: "Salicylic Acid Cleanser", b: "CeraVe", t: "budget" },
    ] },
  salicylic: { title: "Salicylic acid (BHA)", why: "Goes inside pores to reduce breakouts and blackheads.",
    picks: [
      { n: "Salicylic Acid 2% Solution", b: "The Ordinary", t: "budget" },
      { n: "Skin Perfecting 2% BHA Liquid", b: "Paula's Choice", t: "mid" },
      { n: "BHA Blackhead Power Liquid", b: "COSRX", t: "mid" },
      { n: "Beta Hydroxy Acid", b: "The INKEY List", t: "budget" },
    ] },
  niacinamide: { title: "Niacinamide serum", why: "Calms oil and fades uneven tone. Very well tolerated.",
    picks: [
      { n: "Niacinamide 10% + Zinc", b: "The Ordinary", t: "budget" },
      { n: "Niacinamide Serum", b: "Good Molecules", t: "budget" },
      { n: "10% Niacinamide", b: "The INKEY List", t: "budget" },
      { n: "Niacinamide 10%", b: "Naturium", t: "mid" },
    ] },
  vitaminC: { title: "Vitamin C serum", why: "Brightens dullness and helps even out dark spots.",
    picks: [
      { n: "Discoloration Correcting Serum", b: "Good Molecules", t: "budget" },
      { n: "Vitamin C Suspension 23%", b: "The Ordinary", t: "budget" },
      { n: "C15 Super Booster", b: "Paula's Choice", t: "mid" },
      { n: "Vitamin C Serum", b: "The INKEY List", t: "budget" },
    ] },
  hyaluronic: { title: "Hydrating serum", why: "Pulls water into the skin so it feels less tight.",
    picks: [
      { n: "Hyaluronic Acid 2% + B5", b: "The Ordinary", t: "budget" },
      { n: "Hyaluronic Acid Serum", b: "The INKEY List", t: "budget" },
      { n: "Hyalu B5 Serum", b: "La Roche‑Posay", t: "mid" },
      { n: "Hydrating B5 Gel", b: "SkinCeuticals", t: "mid" },
    ] },
  retinol: { title: "Low‑strength retinol", why: "The best‑studied ingredient for fine lines. Start 2 nights a week.",
    picks: [
      { n: "Retinol 0.2% in Squalane", b: "The Ordinary", t: "budget" },
      { n: "Retinol 24 Night Serum", b: "Olay", t: "budget" },
      { n: "0.3% Retinol + Ceramides", b: "CeraVe", t: "budget" },
      { n: "1% Retinol Treatment", b: "Paula's Choice", t: "mid" },
    ] },
  moisturizerLight: { title: "Light gel moisturizer", why: "Hydration that won't feel greasy.",
    picks: [
      { n: "Oil Control Gel‑Cream", b: "CeraVe", t: "budget" },
      { n: "Water Gel", b: "Neutrogena Hydro Boost", t: "budget" },
      { n: "Effaclar Mat", b: "La Roche‑Posay", t: "mid" },
      { n: "Natural Moisturizing Factors", b: "The Ordinary", t: "budget" },
    ] },
  moisturizerRich: { title: "Rich cream moisturizer", why: "Seals in water and repairs dry, tight skin.",
    picks: [
      { n: "Moisturizing Cream", b: "CeraVe", t: "budget" },
      { n: "Lipikar Balm AP+M", b: "La Roche‑Posay", t: "mid" },
      { n: "Moisturizing Cream", b: "Cetaphil", t: "budget" },
      { n: "Rich Moisture Cream", b: "COSRX", t: "mid" },
    ] },
  ceramide: { title: "Barrier repair cream", why: "Rebuilds a sensitive or damaged barrier.",
    picks: [
      { n: "Moisturizing Cream (ceramides)", b: "CeraVe", t: "budget" },
      { n: "Cicaplast Baume B5", b: "La Roche‑Posay", t: "mid" },
      { n: "Ceramide Cream", b: "Dr.Jart+", t: "mid" },
      { n: "Barrier Repair Complex", b: "Good Molecules", t: "budget" },
    ] },
};

/* pick 2 diverse-brand options for a step, honoring budget */
function choosePicks(stepKey, budget) {
  const all = STEPS[stepKey].picks;
  const budgetFirst = budget === "low";
  const sorted = [...all].sort((a, b) =>
    budgetFirst ? (a.t === "budget" ? -1 : 1) - (b.t === "budget" ? -1 : 1) : 0
  );
  const out = [], brands = new Set();
  for (const p of sorted) { if (brands.has(p.b)) continue; brands.add(p.b); out.push(p); if (out.length === 2) break; }
  while (out.length < 2 && sorted.length) { const p = sorted.find((x) => !out.includes(x)); if (!p) break; out.push(p); }
  return out;
}

/* ---------- routine engine (Amina's caps: 1 AM, <=4 PM) ---------- */
function buildRoutine() {
  const { type, concerns, sensitivity } = answers;
  const sensitive = sensitivity === "yes";
  const has = (c) => concerns.includes(c) || (c === "oiliness" && photoSignal && photoSignal.shine > 0.45);

  // MORNING: exactly one thing, sunscreen (Amina: "morning one product, more is waste").
  const am = ["sunscreen"];

  // EVENING: cleanser + up to 2 actives + moisturizer, capped at 4 total ("more is marketing").
  const cleanser = (type === "oily" && !sensitive) ? "cleanserFoaming" : "cleanserGentle";
  const moisturizer = sensitive ? "ceramide" : (type === "dry" ? "moisturizerRich" : "moisturizerLight");

  const actives = [];
  const push = (k) => { if (!actives.includes(k) && actives.length < 2) actives.push(k); };
  if (has("acne") || has("oiliness")) push("salicylic");
  if (has("aging")) push(sensitive ? "niacinamide" : "retinol");
  if (has("pigmentation")) push("niacinamide");
  if (has("dullness")) push("niacinamide");
  if (has("dryness")) push("hyaluronic");

  const pm = ["", ...actives, ""]; // placeholder; assemble below
  const evening = [cleanser, ...actives, moisturizer].slice(0, 4);
  return { am, pm: evening, sensitive };
}

function priceLabel(t) { return t === "budget" ? "budget" : "mid"; }

function renderStep(container, stepKey) {
  const s = STEPS[stepKey];
  const picks = choosePicks(stepKey, answers.budget);
  const picksHtml = picks.map((p) =>
    `<div class="pick"><span><span class="pn">${p.n}</span> <span class="pb">· ${p.b}</span></span>
     <span class="price ${p.t}">${priceLabel(p.t)}</span></div>`).join("");
  container.insertAdjacentHTML("beforeend",
    `<div class="pcard">
       <div class="step"><span class="dot"></span>${s.title}</div>
       <div class="why">${s.why}</div>
       <div class="picks">${picksHtml}</div>
     </div>`);
}

function typeLabel(t){return {dry:"dry",oily:"oily",combo:"combination",normal:"normal"}[t]||t;}

function render() {
  const r = buildRoutine();
  const am = document.getElementById("am");
  const pm = document.getElementById("pm");
  am.innerHTML = ""; pm.innerHTML = "";
  r.am.forEach((k) => renderStep(am, k));
  r.pm.forEach((k) => renderStep(pm, k));

  const cText = answers.concerns.map((c) => ({acne:"breakouts",pigmentation:"dark spots",dullness:"dullness",dryness:"dryness",oiliness:"oiliness",aging:"fine lines"}[c])).join(" and ");
  document.getElementById("summary").textContent =
    `For ${typeLabel(answers.type)}${r.sensitive ? ", sensitive" : ""} skin focused on ${cText}. One step in the morning, ${r.pm.length} at night. Give it a few weeks.`;

  const res = document.getElementById("step-result");
  res.hidden = false;
  res.scrollIntoView({ behavior: "smooth" });
}

buildBtn.addEventListener("click", () => { if (ready()) render(); });
document.getElementById("restart").addEventListener("click", () => location.reload());
document.getElementById("share").addEventListener("click", () => {
  const grab = (id) => [...document.querySelectorAll(`#${id} .pcard`)].map((c, i) => {
    const step = c.querySelector(".step").textContent.trim();
    const pick = c.querySelector(".pick .pn") ? c.querySelector(".pick .pn").textContent + " · " + c.querySelector(".pick .pb").textContent.replace("· ", "") : "";
    return `  ${i + 1}. ${step}${pick ? " — try: " + pick : ""}`;
  }).join("\n");
  const text = `My Got Care routine\n\nMorning:\n${grab("am")}\n\nEvening:\n${grab("pm")}\n\n(General guidance, not medical advice.)`;
  const done = () => { const b = document.getElementById("share"); b.textContent = "Copied ✓"; setTimeout(() => b.textContent = "Copy my routine", 1800); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(done); else done();
});
