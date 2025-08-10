
New market js

// ====== CONFIG ======
const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";
// Expected columns: State, Type ("Pellet"/"Briquette"), Price, Year, "6 Month" (or "6mo"), Month, Week, Material (optional), Updated (optional)

let sheetData = [];
let selectedLocation = "AVERAGE";
let pelletChart, briquetteChart;

// ====== UTILS ======
const fmtINR = (n) => isNaN(n) || n === null ? "--" : Number(n).toLocaleString("en-IN");
const toNum = (v) => v ? parseInt(String(v).replace(/,/g, ""), 10) : 0;

const get6M = (row) => {
  if (!row) return 0;
  return toNum(row["6 Month"] ?? row["6month"] ?? row["6mo"] ?? row["SixMonth"] ?? 0);
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
  const res = await fetch(API_URL);
  sheetData = await res.json();
  buildLocationSelect();
  buildMaterialSelects();
  setSelectedLocation("AVERAGE"); // default view
  computeBestDeals();
  setSeasonalBanner();
  wireFreightCalc();
  updateAll();
}

// ====== CONTROLS ======
function buildLocationSelect() {
  const sel = document.getElementById("locationSelect");
  sel.innerHTML = "";
  const states = [...new Set(sheetData.map(r => r.State?.trim()).filter(Boolean))].sort();
  states.forEach(state => {
    const opt = document.createElement("option");
    opt.value = state;
    opt.textContent = state;
    sel.appendChild(opt);
  });
  // make sure AVERAGE exists visually; if not present, prepend it
  if (![...sel.options].some(o => o.value.toUpperCase() === "AVERAGE")) {
    const opt = document.createElement("option");
    opt.value = "AVERAGE";
    opt.textContent = "AVERAGE";
    sel.insertBefore(opt, sel.firstChild);
  }
  sel.value = selectedLocation;
  sel.addEventListener("change", (e) => {
    setSelectedLocation(e.target.value);
    updateAll();
  });
}

function buildMaterialSelects() {
  const pelletSel = document.getElementById("pelletMaterialSelect");
  const briqSel = document.getElementById("briquetteMaterialSelect");
  const pelletMaterials = [...new Set(sheetData.filter(r => (r.Type||"").toLowerCase()==="pellet").map(r => r.Material || "Standard"))].sort();
  const briqMaterials   = [...new Set(sheetData.filter(r => (r.Type||"").toLowerCase()==="briquette").map(r => r.Material || "Standard"))].sort();

  const fill = (el, list) => {
    el.innerHTML = "";
    list.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      el.appendChild(opt);
    });
    el.addEventListener("change", updateChartsOnly);
  };

  fill(pelletSel, pelletMaterials.length ? pelletMaterials : ["Standard"]);
  fill(briqSel,   briqMaterials.length   ? briqMaterials   : ["Standard"]);
}

function setSelectedLocation(loc) {
  selectedLocation = (loc || "AVERAGE").trim().toUpperCase();
  const sel = document.getElementById("locationSelect");
  if (sel && sel.value !== selectedLocation) sel.value = selectedLocation;
}

// ====== RENDER ======
function updateAll() {
  renderPrices();
  renderStatus();
  renderCharts();
}

function findRow(type, material) {
  const t = type.toLowerCase();
  const m = (material || "Standard").trim();
  // Prefer exact material match for location; fallback to any material in location; then fallback to AVERAGE
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
    let fallback = rows.find(r => (r.Material || "Standard") === m) || rows[0];
    if (fallback) return fallback;
  }
  return null;
}

function renderPrices() {
  const pelletRow = findRow("pellet", document.getElementById("pelletMaterialSelect").value);
  const briqRow   = findRow("briquette", document.getElementById("briquetteMaterialSelect").value);

  const pelletPrice = pelletRow ? toNum(pelletRow.Price) : null;
  const briqPrice   = briqRow ? toNum(briqRow.Price) : null;

  document.getElementById("pelletPrice").textContent = fmtINR(pelletPrice);
  document.getElementById("briquettePrice").textContent = fmtINR(briqPrice);

  // timestamps if present
  const pUpd = pelletRow?.Updated || "";
  const bUpd = briqRow?.Updated || "";
  document.getElementById("pelletTimestamp").textContent = pUpd ? `Updated: ${pUpd}` : "—";
  document.getElementById("briquetteTimestamp").textContent = bUpd ? `Updated: ${bUpd}` : "—";
}

function renderStatus() {
  const pelletRow = findRow("pellet", document.getElementById("pelletMaterialSelect").value);
  const briqRow   = findRow("briquette", document.getElementById("briquetteMaterialSelect").value);
  const { label, cls } = confidenceFrom(pelletRow, briqRow);
  const badge = document.getElementById("confidenceBadge");
  badge.textContent = `Confidence: ${label}`;
  badge.className = `badge ${cls}`;

  const anyUpd = pelletRow?.Updated || briqRow?.Updated;
  document.getElementById("lastUpdated").textContent = `Last updated: ${anyUpd || "--"}`;
}

function renderCharts() {
  // destroy old
  if (pelletChart) pelletChart.destroy();
  if (briquetteChart) briquetteChart.destroy();

  const labels = ["Year", "6 Months", "Month", "Week"];
  const pelletRow = findRow("pellet", document.getElementById("pelletMaterialSelect").value);
  const briqRow   = findRow("briquette", document.getElementById("briquetteMaterialSelect").value);

  const pelletVals = [
    toNum(pelletRow?.Year),
    get6M(pelletRow),
    toNum(pelletRow?.Month),
    toNum(pelletRow?.Week)
  ];
  const briqVals = [
    toNum(briqRow?.Year),
    get6M(briqRow),
    toNum(briqRow?.Month),
    toNum(briqRow?.Week)
  ];

  const bounds = (vals) => {
    const arr = vals.filter(v => v > 0);
    if (!arr.length) return { min: 0, max: 1000 };
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (min === max) return { min: min * 0.95, max: max * 1.05 || min + 100 };
    return { min: Math.floor(min * 0.95), max: Math.ceil(max * 1.05) };
    };

  const pB = bounds(pelletVals);
  const bB = bounds(briqVals);

  const baseOpts = (min, max) => ({
    type: "line",
    options: {
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        line: { tension: 0.3, borderWidth: 2 },
        point: { radius: 3 }
      },
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: min,
          suggestedMax: max,
          ticks: { callback: v => `₹${Number(v).toLocaleString("en-IN")}` }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton`
          }
        }
      }
    }
  });

  pelletChart = new Chart(document.getElementById("pelletChart"), {
    ...baseOpts(pB.min, pB.max),
    data: {
      labels,
      datasets: [{
        label: "Pellet",
        data: pelletVals,
        borderColor: "#1C3D5A",
        backgroundColor: "rgba(29, 61, 90, 0.08)",
        fill: true
      }]
    }
  });

  briquetteChart = new Chart(document.getElementById("briquetteChart"), {
    ...baseOpts(bB.min, bB.max),
    data: {
      labels,
      datasets: [{
        label: "Briquette",
        data: briqVals,
        borderColor: "#FFA500",
        backgroundColor: "rgba(255,165,0,0.12)",
        fill: true
      }]
    }
  });
}

function updateChartsOnly() {
  renderPrices();
  renderCharts();
}

// ====== BEST DEALS ======
function computeBestDeals() {
  // min pellet across India
  const pellets = sheetData.filter(r => (r.Type||"").toLowerCase()==="pellet" && toNum(r.Price)>0);
  const briqs   = sheetData.filter(r => (r.Type||"").toLowerCase()==="briquette" && toNum(r.Price)>0);

  const minPellet = pellets.reduce((a,b) => toNum(b.Price) < toNum(a.Price) ? b : a, pellets[0] || null);
  const maxPellet = pellets.reduce((a,b) => toNum(b.Price) > toNum(a.Price) ? b : a, pellets[0] || null);
  const minBriq   = briqs.reduce((a,b) => toNum(b.Price) < toNum(a.Price) ? b : a, briqs[0] || null);
  const maxBriq   = briqs.reduce((a,b) => toNum(b.Price) > toNum(a.Price) ? b : a, briqs[0] || null);

  const bestBuy = [minPellet, minBriq].filter(Boolean).reduce((a,b)=> toNum(b.Price) < toNum(a.Price) ? b : a, minPellet || minBriq);
  const bestSell = [maxPellet, maxBriq].filter(Boolean).reduce((a,b)=> toNum(b.Price) > toNum(a.Price) ? b : a, maxPellet || maxBriq);

  document.getElementById("bestBuyPrice").textContent = fmtINR(bestBuy ? toNum(bestBuy.Price): null);
  document.getElementById("bestBuyWhere").textContent = bestBuy ? (bestBuy.State || "—") : "—";
  document.getElementById("bestSellPrice").textContent = fmtINR(bestSell ? toNum(bestSell.Price): null);
  document.getElementById("bestSellWhere").textContent = bestSell ? (bestSell.State || "—") : "—";
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
  document.getElementById("seasonalText").textContent = text;
}

// ====== FREIGHT CALC ======
function wireFreightCalc() {
  const d = document.getElementById("fcDistance");
  const t = document.getElementById("fcTonnage");
  const r = document.getElementById("fcRate");
  const calc = () => {
    const dist = Number(d.value||0);
    const tons = Number(t.value||0);
    const rate = Number(r.value||0);
    const total = dist * rate * tons;          // ₹
    const perTon = dist * rate;                // ₹/ton
    document.getElementById("fcTotal").textContent = fmtINR(total);
    document.getElementById("fcPerTon").textContent = fmtINR(perTon);
  };
  [d,t,r].forEach(el => el.addEventListener("input", calc));
  calc();
}

// ====== INIT ======
document.addEventListener("DOMContentLoaded", fetchData);


