"use strict";

/* ---------- state ---------- */
const answers = { type: null, concerns: [], sensitivity: null, budget: null };
let photoSignal = null; // {shine, redness} 0..1, an honest heuristic only

/* ---------- photo: honest client-side read ---------- */
const fileInput = document.getElementById("file");
const preview = document.getElementById("preview");
const uploaderInner = document.getElementById("uploaderInner");
const photoRead = document.getElementById("photoRead");

fileInput.addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  preview.src = url;
  preview.hidden = false;
  uploaderInner.hidden = true;
  preview.onload = () => { analyzePhoto(preview); URL.revokeObjectURL(url); };
});

// A deliberately modest read: average shine (brightness spread) + redness (R vs G/B).
// This is NOT a diagnosis. It just gives the routine a small nudge and shows the user
// the app really looked at their photo.
function analyzePhoto(img) {
  try {
    const c = document.createElement("canvas");
    const w = (c.width = 120), h = (c.height = 120);
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let lumSum = 0, brightPixels = 0, rSum = 0, gSum = 0, bSum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumSum += lum; rSum += r; gSum += g; bSum += b; n++;
      if (lum > 200) brightPixels++;
    }
    const shine = Math.min(1, (brightPixels / n) * 4);          // lots of hot highlights => shine
    const redness = Math.min(1, Math.max(0, (rSum - (gSum + bSum) / 2) / n / 40));
    photoSignal = { shine, redness };

    const parts = [];
    parts.push(shine > 0.45 ? "I see a fair bit of shine" : shine > 0.2 ? "I see a little shine" : "I don't see much shine");
    parts.push(redness > 0.5 ? "and some redness" : "and even tone overall");
    photoRead.hidden = false;
    photoRead.innerHTML = `<strong>Quick read:</strong> ${parts.join(" ")}. This is just a starting hint from your photo, your answers below matter more.`;
  } catch (err) {
    photoSignal = null; // canvas can fail on some browsers; routine still works from the quiz
  }
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
        const arr = answers[key];
        const idx = arr.indexOf(v);
        if (idx >= 0) { arr.splice(idx, 1); btn.classList.remove("sel"); }
        else {
          if (arr.length >= max) return; // cap
          arr.push(v); btn.classList.add("sel");
        }
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

function ready() {
  return answers.type && answers.concerns.length >= 1 && answers.sensitivity && answers.budget;
}
function refreshGate() {
  buildBtn.disabled = !ready();
  hint.style.display = ready() ? "none" : "block";
}

/* ---------- routine engine ---------- */
const INGREDIENTS = {
  gentleCleanser: { name: "Gentle cleanser", why: "Cleans without stripping your skin barrier." },
  foamingCleanser: { name: "Gentle foaming cleanser", why: "Lifts extra oil without over-drying." },
  moisturizerLight: { name: "Light gel moisturizer", why: "Hydration that won't feel greasy on oily skin." },
  moisturizerRich: { name: "Rich cream moisturizer", why: "Seals in water and repairs a dry, tight barrier." },
  sunscreen: { name: "Sunscreen SPF 30+", why: "The single biggest thing for dark spots and aging. Every morning." },
  salicylic: { name: "Salicylic acid (BHA)", why: "Gets inside pores to reduce breakouts and blackheads." },
  niacinamide: { name: "Niacinamide serum", why: "Calms oil and fades uneven tone. Very well tolerated." },
  vitaminC: { name: "Vitamin C serum", why: "Brightens dullness and helps even out dark spots in the morning." },
  hyaluronic: { name: "Hyaluronic acid serum", why: "Pulls water into the skin for a plumper, less tight feel." },
  retinol: { name: "Low-strength retinol", why: "The best-studied ingredient for fine lines. Start 2 nights a week." },
  ceramide: { name: "Ceramide moisturizer", why: "Rebuilds a sensitive or damaged barrier." },
};

function buildRoutine() {
  const { type, concerns, sensitivity, budget } = answers;
  const sensitive = sensitivity === "yes";
  const low = budget === "low";
  const has = (c) => concerns.includes(c) || (photoSignal && ((c === "oiliness" && photoSignal.shine > 0.45)));

  const cleanser = (type === "oily" && !sensitive) ? INGREDIENTS.foamingCleanser : INGREDIENTS.gentleCleanser;
  const moisturizer = (type === "dry" || sensitive) ? (sensitive ? INGREDIENTS.ceramide : INGREDIENTS.moisturizerRich) : INGREDIENTS.moisturizerLight;

  const am = [cleanser];
  const pm = [cleanser];

  // AM actives
  if (has("dullness") && !sensitive && !low) am.push(INGREDIENTS.vitaminC);
  if (has("dryness")) am.push(INGREDIENTS.hyaluronic);
  am.push(moisturizer);
  am.push(INGREDIENTS.sunscreen);

  // PM actives (one treatment focus to avoid overloading)
  let pmTreatment = null;
  if (has("acne") || has("oiliness")) pmTreatment = INGREDIENTS.salicylic;
  else if (has("aging") && !sensitive && !low) pmTreatment = INGREDIENTS.retinol;
  else if (has("pigmentation")) pmTreatment = INGREDIENTS.niacinamide;
  else if (has("dryness")) pmTreatment = INGREDIENTS.hyaluronic;

  if (sensitive && pmTreatment === INGREDIENTS.retinol) pmTreatment = INGREDIENTS.niacinamide; // gentler swap
  if (pmTreatment) pm.push(pmTreatment);
  if ((has("pigmentation") || has("oiliness")) && pmTreatment !== INGREDIENTS.niacinamide && !low) pm.push(INGREDIENTS.niacinamide);
  pm.push(moisturizer);

  return { am, pm, sensitive };
}

function typeLabel(t){return {dry:"dry",oily:"oily",combo:"combination",normal:"normal"}[t]||t;}

function render() {
  const r = buildRoutine();
  const amOl = document.getElementById("am");
  const pmOl = document.getElementById("pm");
  const why = document.getElementById("why");
  amOl.innerHTML = ""; pmOl.innerHTML = ""; why.innerHTML = "";

  const seen = new Set();
  const line = (ing) => `<li><b>${ing.name}</b></li>`;
  r.am.forEach((i) => (amOl.innerHTML += line(i)));
  r.pm.forEach((i) => (pmOl.innerHTML += line(i)));

  [...r.am, ...r.pm].forEach((i) => {
    if (seen.has(i.name)) return;
    seen.add(i.name);
    why.innerHTML += `<li><b>${i.name}:</b> ${i.why}</li>`;
  });

  const concernText = answers.concerns.map((c)=>({acne:"breakouts",pigmentation:"uneven tone",dullness:"dullness",dryness:"dryness",oiliness:"oiliness",aging:"fine lines"}[c])).join(" and ");
  document.getElementById("summary").textContent =
    `For ${typeLabel(answers.type)}${r.sensitive ? ", sensitive" : ""} skin focused on ${concernText}. Keep it simple and give it a few weeks.`;

  document.getElementById("step-result").hidden = false;
  document.getElementById("step-result").scrollIntoView({ behavior: "smooth" });
}

buildBtn.addEventListener("click", () => { if (ready()) render(); });
document.getElementById("restart").addEventListener("click", () => location.reload());
document.getElementById("share").addEventListener("click", () => {
  const am = [...document.querySelectorAll("#am li")].map((li,i)=>`  ${i+1}. ${li.textContent}`).join("\n");
  const pm = [...document.querySelectorAll("#pm li")].map((li,i)=>`  ${i+1}. ${li.textContent}`).join("\n");
  const text = `My SkinSense routine\n\nMorning:\n${am}\n\nEvening:\n${pm}\n\n(General guidance, not medical advice.)`;
  const done = () => { const b=document.getElementById("share"); b.textContent="Copied ✓"; setTimeout(()=>b.textContent="Copy my routine",1800); };
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(done); else done();
});
