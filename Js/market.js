// ====== CONFIG (PUT YOUR MARKET SHEETBEST URL BELOW) ======

const API_URL =https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf

// Expected columns (any casing/alias ok): 
// State, Type ("Pellet"/"Briquette"), Price, Year, "6 Month"/"6mo"/"SixMonth", Month, Week,
// Material (optional), Updated (optional), Ash (%), Moisture (%), Kcal/GCV/CalorificValue (kcal/kg)

let sheetData = [];
let selectedLocation = "AVERAGE";
let pelletChart, briquetteChart;

// ====== UTILS ======
const fmtINR = (n) => (n == null || isNaN(n)) ? "--" : Number(n).toLocaleString("en-IN");
const toNum = (v) => v ? parseInt(String(v).replace(/,/g, ""), 10) : 0;
const el = (id) => document.getElementById(id);
const safeSet = (id, val) => { const x = el(id); if (x) x.textContent = val; };

const pick = (row, keys) => {
  if (!row) return undefined;
  for (const k of keys) {
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return undefined;
};

const get6M = (row) => toNum(pick(row, ["6 Month","6month","6mo","SixMonth"]));

const getAsh = (row) => {
  const v = pick(row, ["Ash","Ash %","Ash%","AshPercent","Ash(%)"]);
  return v != null ? Number(String(v).replace("%","")) : null;
};
const getMoisture = (row) => {
  const v = pick(row, ["Moisture","Moisture %","Moisture%","MoisturePercent","Moist(%)"]);
  return v != null ? Number(String(v).replace("%","")) : null;
};
const getKcal = (row) => {
  const v = pick(row, ["Kcal","GCV","CV","CalorificValue","Calorific Value"]);
  return v != null ? Number(String(v).replace(/,/g,"")) : null;
};

const confidenceFrom = (pelletRow, briquetteRow) => {
  let score = 0;
  [pelletRow, briquetteRow].forEach(r => {
    if (!r) return;
    let parts = 0;
    if (toNum(r.Year)) parts++;
    if (get6M(r)) parts++;
    if (toNum(r.Month)) parts++;
    if (toNum(r.Week)) parts++;
    score += parts;
  });
  if (score >= 6) return { label: "High", cls: "ok" };
  if (score >= 3) return { label: "Medium", cls: "mid" };
  return { label: "Low", cls: "low" };
};

// ====== DATA LOAD ======
async function fetchData() {
  try {
    const res = await fetch(API_URL);
    sheetData = await res.json();
    buildLocationSelect();
    buildMaterialSelects();
    setSelectedLocation("AVERAGE");
    computeBestDeals();
    setSeasonalBanner();
    wireFreightCalc();
    updateAll();
  } catch (e) {
    console.error("Market fetch failed:", e);
  }
}

// ====== CONTROLS ======
function buildLocationSelect() {
  const sel = el("locationSelect");
  if (!sel) return; // page may not have this control yet
  sel.innerHTML = "";
  const states = [...new Set(sheetData.map(r => r.State?.trim()).filter(Boolean))].sort();
  states.forEach(s => {
    const o = document.createElement("option");
    o.value = s; o.textContent = s; sel.appendChild(o);
  });
  if (![...sel.options].some(o => o.value.toUpperCase()==="AVERAGE")) {
    const o = document.createElement("option");
    o.value = "AVERAGE"; o.textContent = "AVERAGE";
    sel.insertBefore(o, sel.firstChild);
  }
  sel.value = selectedLocation;
  sel.addEventListener("change", (e) => {
    setSelectedLocation(e.target.value);
    updateAll();
  });
}

function buildMaterialSelects() {
  const pelletSel = el("pelletMaterialSelect");
  const briqSel   = el("briquetteMaterialSelect");
  const pellets = sheetData.filter(r => (r.Type||"").toLowerCase()==="pellet");
  const briqs   = sheetData.filter(r => (r.Type||"").toLowerCase()==="briquette");
  const pList = [...new Set(pellets.map(r => r.Material || "Standard"))].sort();
  const bList = [...new Set(briqs.map(r => r.Material || "Standard"))].sort();

  const fill = (select, list) => {
    if (!select) return;
    select.innerHTML = "";
    (list.length ? list : ["Standard"]).forEach(m => {
      const o = document.createElement("option");
      o.value = m; o.textContent = m; select.appendChild(o);
    });
    select.addEventListener("change", updateChartsOnly);
  };

  fill(pelletSel, pList);
  fill(briqSel, bList);
}

function setSelectedLocation(loc) {
  selectedLocation = (loc || "AVERAGE").trim().toUpperCase();
  const sel = el("locationSelect");
  if (sel && sel.value !== selectedLocation) sel.value = selectedLocation;
}

// ====== RENDER ======
function updateAll() {
  renderPrices();
  renderStatus();
  renderQuality();
  renderCharts();
}

function findRow(type, material) {
  const t = (type||"").toLowerCase();
  const m = (material || "Standard").trim();
  let rows = sheetData.filter(r =>
    (r.State?.trim().toUpperCase() === selectedLocation) &&
    ((r.Type||"").toLowerCase() === t)
  );

  let exact = rows.find(r => (r.Material || "Standard") === m);
  if (exact) return exact;
  if (rows.length) return rows[0];

  if (selectedLocation !== "AVERAGE") {
    rows = sheetData.filter(r =>
      (r.State?.trim().toUpperCase() === "AVERAGE") &&
      ((r.Type||"").toLowerCase() === t)
    );
    let fb = rows.find(r => (r.Material || "Standard") === m) || rows[0];
    if (fb) return fb;
  }
  return null;
}

function renderPrices() {
  const pelletRow = findRow("pellet", el("pelletMaterialSelect")?.value);
  const briqRow   = findRow("briquette", el("briquetteMaterialSelect")?.value);

  const pelletPrice = pelletRow ? toNum(pelletRow.Price) : null;
  const briqPrice   = briqRow ? toNum(briqRow.Price) : null;

  safeSet("pelletPrice", fmtINR(pelletPrice));
  safeSet("briquettePrice", fmtINR(briqPrice));

  const pUpd = pelletRow?.Updated || "";
  const bUpd = briqRow?.Updated || "";
  safeSet("pelletTimestamp", pUpd ? `Updated: ${pUpd}` : "—");
  safeSet("briquetteTimestamp", bUpd ? `Updated: ${bUpd}` : "—");
}

function renderStatus() {
  const pelletRow = findRow("pellet", el("pelletMaterialSelect")?.value);
  const briqRow   = findRow("briquette", el("briquetteMaterialSelect")?.value);
  const { label, cls } = confidenceFrom(pelletRow, briqRow);
  const badge = el("confidenceBadge");
  if (badge) {
    badge.textContent = `Confidence: ${label}`;
    badge.className = `badge ${cls}`;
  }
  const anyUpd = pelletRow?.Updated || briqRow?.Updated;
  safeSet("lastUpdated", `Last updated: ${anyUpd || "--"}`);
}

function renderQuality() {
  // Show quality for the currently selected "Pellet" material (primary focus)
  const pelletRow = findRow("pellet", el("pelletMaterialSelect")?.value);
  const ash = getAsh(pelletRow);
  const moisture = getMoisture(pelletRow);
  const kcal = getKcal(pelletRow);

  safeSet("ashValue", ash != null ? `${ash}%` : "—");
  safeSet("moistureValue", moisture != null ? `${moisture}%` : "—");
  safeSet("kcalValue", kcal != null ? `${fmtINR(kcal)} kcal/kg` : "—");

  // Optional quality badge if present
  const qb = el("qualityBadge");
  if (qb) {
    // Simple heuristic: lower ash + moisture, higher kcal → better
    let score = 0;
    if (ash != null) score += (ash <= 8 ? 2 : ash <= 12 ? 1 : 0);
    if (moisture != null) score += (moisture <= 8 ? 2 : moisture <= 12 ? 1 : 0);
    if (kcal != null) score += (kcal >= 3800 ? 2 : kcal >= 3400 ? 1 : 0);

    let label = "Unknown", cls = "";
    if (score >= 5) { label = "A • Premium"; cls = "ok"; }
    else if (score >= 3) { label = "B • Standard"; cls = "mid"; }
    else if (score >= 1) { label = "C • Low"; cls = "low"; }
    else { label = "Unrated"; cls = ""; }

    qb.textContent = `Quality: ${label}`;
    qb.className = `badge ${cls}`;
  }
}

function renderCharts() {
  if (pelletChart) pelletChart.destroy();
  if (briquetteChart) briquetteChart.destroy();

  const labels = ["Year", "6 Months", "Month", "Week"];
  const pelletRow = findRow("pellet", el("pelletMaterialSelect")?.value);
  const briqRow   = findRow("briquette", el("briquetteMaterialSelect")?.value);

  const pelletVals = [ toNum(pelletRow?.Year), get6M(pelletRow), toNum(pelletRow?.Month), toNum(pelletRow?.Week) ];
  const briqVals   = [ toNum(briqRow?.Year),   get6M(briqRow),   toNum(briqRow?.Month),   toNum(briqRow?.Week) ];

  const bounds = (vals) => {
    const arr = vals.filter(v => v > 0);
    if (!arr.length) return { min: 0, max: 1000 };
    const min = Math.min(...arr), max = Math.max(...arr);
    if (min === max) return { min: min * 0.95, max: max * 1.05 || min + 100 };
    return { min: Math.floor(min * 0.95), max: Math.ceil(max * 1.05) };
  };

  const pB = bounds(pelletVals), bB = bounds(briqVals);

  const baseOpts = (min, max) => ({
    type: "line",
    options: {
      responsive: true, maintainAspectRatio: false,
      elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 3 } },
      scales: {
        y: { beginAtZero: false, suggestedMin: min, suggestedMax: max,
             ticks: { callback: v => `₹${Number(v).toLocaleString("en-IN")}` } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton` } }
      }
    }
  });

  pelletChart = new Chart(el("pelletChart"), {
    ...baseOpts(pB.min, pB.max),
    data: { labels, datasets: [{ label: "Pellet", data: pelletVals, borderColor: "#1C3D5A", backgroundColor: "rgba(29,61,90,.1)", fill: true }] }
  });

  briquetteChart = new Chart(el("briquetteChart"), {
    ...baseOpts(bB.min, bB.max),
    data: { labels, datasets: [{ label: "Briquette", data: briqVals, borderColor: "#FFA500", backgroundColor: "rgba(255,165,0,.12)", fill: true }] }
  });
}

function updateChartsOnly() {
  renderPrices();
  renderQuality();
  renderCharts();
}

// ====== BEST DEALS ======
function computeBestDeals() {
  const pellets = sheetData.filter(r => (r.Type||"").toLowerCase()==="pellet" && toNum(r.Price)>0);
  const briqs   = sheetData.filter(r => (r.Type||"").toLowerCase()==="briquette" && toNum(r.Price)>0);

  const minPellet = pellets.reduce((a,b)=>!a||toNum(b.Price)<toNum(a.Price)?b:a, null);
  const maxPellet = pellets.reduce((a,b)=>!a||toNum(b.Price)>toNum(a.Price)?b:a, null);
  const minBriq   = briqs.reduce((a,b)=>!a||toNum(b.Price)<toNum(a.Price)?b:a, null);
  const maxBriq   = briqs.reduce((a,b)=>!a||toNum(b.Price)>toNum(a.Price)?b:a, null);

  const bestBuy  = [minPellet, minBriq].filter(Boolean).reduce((a,b)=>!a||toNum(b.Price)<toNum(a.Price)?b:a, null);
  const bestSell = [maxPellet, maxBriq].filter(Boolean).reduce((a,b)=>!a||toNum(b.Price)>toNum(a.Price)?b:a, null);

  safeSet("bestBuyPrice", fmtINR(bestBuy ? toNum(bestBuy.Price) : null));
  safeSet("bestBuyWhere", bestBuy ? (bestBuy.State || "—") : "—");
  safeSet("bestSellPrice", fmtINR(bestSell ? toNum(bestSell.Price) : null));
  safeSet("bestSellWhere", bestSell ? (bestSell.State || "—") : "—");
}

// ====== SEASONAL IMPACT ======
function setSeasonalBanner() {
  const month = new Date().getMonth(); // 0=Jan
  const notes = {
    3: "Rabi harvest increases agri‑residue → prices may soften regionally.",
    4: "Transport tightness around holidays → freight can spike.",
    9: "Kharif harvest brings fresh residue → watch short‑term dips.",
  };
  const text = notes[month] || "Stable seasonality expected. Track freight & local availability.";
  safeSet("seasonalText", text);
}

// ====== FREIGHT CALC ======
function wireFreightCalc() {
  const d = el("fcDistance"), t = el("fcTonnage"), r = el("fcRate");
  if (!d || !t || !r) return;
  const calc = () => {
    const dist = Number(d.value||0), tons = Number(t.value||0), rate = Number(r.value||0);
    const total = dist * rate * tons;      // ₹
    const perTon = dist * rate;            // ₹/ton
    safeSet("fcTotal", fmtINR(total));
    safeSet("fcPerTon", fmtINR(perTon));
  };
  [d,t,r].forEach(x => x.addEventListener("input", calc));
  calc();
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", fetchData);