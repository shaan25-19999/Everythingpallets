// ====== CONFIG (Pinned to MARKET Prices sheet) ======
const API_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf";

// ====== STATE ======
let sheetData = [];
let dataset = {};               // { [location]: { materials: { pellets: { [material]: {price, trend}}, briquettes: {...} } } }
let pelletLabels = new Set();   // all pellet materials
let briquetteLabels = new Set();// all briquette materials

// ====== UTILS ======
const fmtINR = (n) => (isNaN(n) || n == null) ? "--" : Number(n).toLocaleString("en-IN");
const toNum  = (v) => v ? parseInt(String(v).replace(/,/g, ""), 10) : 0;

// robust “6 Month” accessor
const get6M = (row) => toNum(row?.["6 Month"] ?? row?.["6month"] ?? row?.["6mo"] ?? row?.SixMonth ?? 0);

// optional confidence badge logic (only runs if #confidenceBadge exists)
const confidenceFrom = (pelletRow, briqRow) => {
  let score = 0;
  [pelletRow, briqRow].forEach(r => {
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
async function loadData() {
  const res = await fetch(API_URL);
  sheetData = await res.json();

  dataset = {};
  pelletLabels = new Set();
  briquetteLabels = new Set();

  for (const row of sheetData) {
    const location = row.State?.trim();
    const material = (row.Material ?? "Standard").toString().trim();
    const type     = (row.Type ?? "").toString().trim().toLowerCase();

    if (!location) continue;

    // build trend + price off the weekly column (as in original)
    const price = toNum(row.Week);
    const trend = [ toNum(row.Year), get6M(row), toNum(row.Month), toNum(row.Week) ];

    if (!dataset[location]) {
      dataset[location] = { materials: { pellets: {}, briquettes: {} } };
    }

    const formatted = { price, trend, raw: row };

    if (type === "pellet") {
      dataset[location].materials.pellets[material] = formatted;
      pelletLabels.add(material);
    } else if (type === "briquette") {
      dataset[location].materials.briquettes[material] = formatted;
      briquetteLabels.add(material);
    }
  }

  // don’t show GLOBAL in dropdowns
  pelletLabels.delete("GLOBAL");
  briquetteLabels.delete("GLOBAL");
}

// ====== DOM GETTERS (Market.html IDs) ======
const els = {
  locationSelect:     () => document.getElementById("locationSelect"),
  materialSelect:     () => document.getElementById("materialSelect"),
  briquetteSelect:    () => document.getElementById("briquetteSelect"),
  materialTable:      () => document.getElementById("materialTable"),
  briquetteTable:     () => document.getElementById("briquetteTable"),
  pelletSpecs:        () => document.getElementById("pelletSpecs"),
  briquetteSpecs:     () => document.getElementById("briquetteSpecs"),
  pelletTimestamp:    () => document.getElementById("pelletTimestamp"),
  briquetteTimestamp: () => document.getElementById("briquetteTimestamp"),
  chartTitle:         () => document.getElementById("chartTitle"),
  briqChartTitle:     () => document.getElementById("briquetteChartTitle"),
  confidenceBadge:    () => document.getElementById("confidenceBadge"), // optional
  lastUpdatedBadge:   () => document.getElementById("lastUpdated"),     // optional
  bestBuyPrice:       () => document.getElementById("bestBuyPrice"),     // optional
  bestBuyWhere:       () => document.getElementById("bestBuyWhere"),     // optional
  bestSellPrice:      () => document.getElementById("bestSellPrice"),    // optional
  bestSellWhere:      () => document.getElementById("bestSellWhere"),    // optional
  seasonalText:       () => document.getElementById("seasonalText"),     // optional
  fcDistance:         () => document.getElementById("fcDistance"),       // optional
  fcTonnage:          () => document.getElementById("fcTonnage"),        // optional
  fcRate:             () => document.getElementById("fcRate"),           // optional
  fcTotal:            () => document.getElementById("fcTotal"),          // optional
  fcPerTon:           () => document.getElementById("fcPerTon"),         // optional
};

// ====== TABLE RENDER ======
function renderPelletTable(locationKey) {
  const table = els.materialTable();
  if (!table) return;

  const data = dataset[locationKey]?.materials?.pellets ?? {};
  table.innerHTML =
    `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
    Object.entries(data).map(([type, { price, trend }]) => {
      const trendHTML = trend.map(val =>
        `<span style="display:inline-block;width:5px;height:${10 + (toNum(val)/100)}px;background:#52b788;margin:0 1px;"></span>`
      ).join("");
      return `<tr><td>${type}</td><td><strong>₹${fmtINR(price)}</strong></td><td>${trendHTML}</td></tr>`;
    }).join("");
}

function renderBriquetteTable(locationKey) {
  const table = els.briquetteTable();
  if (!table) return;

  const data = dataset[locationKey]?.materials?.briquettes ?? {};
  table.innerHTML =
    `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
    Object.entries(data).map(([type, { price, trend }]) => {
      const trendHTML = trend.map(val =>
        `<span style="display:inline-block;width:5px;height:${10 + (toNum(val)/100)}px;background:#6a4f2d;margin:0 1px;"></span>`
      ).join("");
      return `<tr><td>${type}</td><td><strong>₹${fmtINR(price)}</strong></td><td>${trendHTML}</td></tr>`;
    }).join("");
}

// ====== SPECS + TIMESTAMP (GLOBAL rows) ======
function updateSpecs(material, isPellet) {
  const specBox   = isPellet ? els.pelletSpecs()        : els.briquetteSpecs();
  const timestamp = isPellet ? els.pelletTimestamp()    : els.briquetteTimestamp();
  if (!specBox && !timestamp) return;

  // Find GLOBAL row for the selected material and type
  const globalInfo = sheetData.find(row =>
    row.State?.trim().toLowerCase() === "global" &&
    (row.Material ?? "Standard").toString().trim() === material &&
    (row.Type ?? "").toString().trim().toLowerCase().includes(isPellet ? "pellet" : "briquette")
  );

  if (specBox && globalInfo) {
    const ash = globalInfo.Ash ?? "--";
    const mos = globalInfo.Moisture ?? "--";
    const kcal = globalInfo.Kcal ?? "--";
    specBox.innerHTML = `
      <p><strong>Ash:</strong> ${ash}%</p>
      <p><strong>Moisture:</strong> ${mos}%</p>
      <p><strong>Kcal Value:</strong> ${kcal}</p>
    `;
  }

  // Last Updated — look for any row carrying it
  const lastRow = sheetData.find(r => r["Last Updated"]);
  if (timestamp && lastRow) {
    timestamp.textContent = lastRow["Last Updated"];
  }
}

// ====== CHARTS ======
let pelletChart, briquetteChart;

function ensureCharts() {
  const ctxPellet = document.getElementById("priceChart")?.getContext?.("2d");
  const ctxBriq   = document.getElementById("briquetteChart")?.getContext?.("2d");
  if (!ctxPellet || !ctxBriq) return;

  if (pelletChart) pelletChart.destroy();
  if (briquetteChart) briquetteChart.destroy();

  pelletChart = new Chart(ctxPellet, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `₹${c.parsed.y.toLocaleString("en-IN")}` } }
      },
      scales: { y: { ticks: { callback: v => `₹${Number(v).toLocaleString("en-IN")}` } } }
    }
  });

  briquetteChart = new Chart(ctxBriq, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `₹${c.parsed.y.toLocaleString("en-IN")}` } }
      },
      scales: { y: { ticks: { callback: v => `₹${Number(v).toLocaleString("en-IN")}` } } }
    }
  });
}

function updateChartFor(material, locationKey, chartObj, isPellet) {
  const source = isPellet
    ? dataset[locationKey]?.materials?.pellets
    : dataset[locationKey]?.materials?.briquettes;

  const series = source?.[material] ?? { trend: [] };
  chartObj.data.datasets[0].label = material || (isPellet ? "Pellet" : "Briquette");
  chartObj.data.datasets[0].data  = series.trend || [];
  chartObj.update();

  // Title tweaks
  const titleEl = isPellet ? els.chartTitle() : els.briqChartTitle();
  if (titleEl) titleEl.textContent = `${isPellet ? "Pellet" : "Briquette"} Price Trend – ${locationKey} · ${material}`;

  // Specs + timestamp
  updateSpecs(material, isPellet);
}

// ====== DROPDOWNS ======
function populateLocationsAndMaterials() {
  const locationSelect  = els.locationSelect();
  const materialSelect  = els.materialSelect();
  const briquetteSelect = els.briquetteSelect();
  if (!locationSelect || !materialSelect || !briquetteSelect) return;

  // locations (exclude GLOBAL)
  const locations = Object.keys(dataset).filter(l => l && l.toUpperCase() !== "GLOBAL").sort();
  locationSelect.innerHTML = "";
  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });

  // Initial materials for first location
  const firstLoc = locations[0];
  fillMaterialDropdowns(firstLoc);

  locationSelect.addEventListener("change", () => {
    fillMaterialDropdowns(locationSelect.value);
    renderPelletTable(locationSelect.value);
    renderBriquetteTable(locationSelect.value);
    const pDef = materialSelect.options[0]?.value;
    const bDef = briquetteSelect.options[0]?.value;
    if (pDef) updateChartFor(pDef, locationSelect.value, pelletChart, true);
    if (bDef) updateChartFor(bDef, locationSelect.value, briquetteChart, false);
  });

  materialSelect.addEventListener("change", () =>
    updateChartFor(materialSelect.value, locationSelect.value, pelletChart, true)
  );

  briquetteSelect.addEventListener("change", () =>
    updateChartFor(briquetteSelect.value, locationSelect.value, briquetteChart, false)
  );

  // initial tables + charts
  renderPelletTable(firstLoc);
  renderBriquetteTable(firstLoc);
  ensureCharts();
  const p0 = materialSelect.options[0]?.value;
  const b0 = briquetteSelect.options[0]?.value;
  if (p0) updateChartFor(p0, firstLoc, pelletChart, true);
  if (b0) updateChartFor(b0, firstLoc, briquetteChart, false);
}

function fillMaterialDropdowns(locationKey) {
  const materialSelect  = els.materialSelect();
  const briquetteSelect = els.briquetteSelect();
  if (!materialSelect || !briquetteSelect) return;

  materialSelect.innerHTML = "";
  briquetteSelect.innerHTML = "";

  const pel = dataset[locationKey]?.materials?.pellets ?? {};
  const bri = dataset[locationKey]?.materials?.briquettes ?? {};

  Object.keys(pel).forEach(m => {
    const opt = document.createElement("option");
    opt.value = m; opt.textContent = m;
    materialSelect.appendChild(opt);
  });

  Object.keys(bri).forEach(m => {
    const opt = document.createElement("option");
    opt.value = m; opt.textContent = m;
    briquetteSelect.appendChild(opt);
  });
}

// ====== OPTIONAL NEW FEATURES (safe, only if elements exist) ======
function computeBestDeals() {
  const bestBuyPrice  = els.bestBuyPrice();
  const bestBuyWhere  = els.bestBuyWhere();
  const bestSellPrice = els.bestSellPrice();
  const bestSellWhere = els.bestSellWhere();
  if (!bestBuyPrice && !bestSellPrice) return;

  const pellets = sheetData.filter(r => (r.Type||"").toLowerCase()==="pellet"    && toNum(r.Price ?? r.Week) > 0);
  const briqs   = sheetData.filter(r => (r.Type||"").toLowerCase()==="briquette" && toNum(r.Price ?? r.Week) > 0);

  const minPellet = pellets.reduce((a,b) => !a || toNum(b.Price ?? b.Week) < toNum(a.Price ?? a.Week) ? b : a, null);
  const maxPellet = pellets.reduce((a,b) => !a || toNum(b.Price ?? b.Week) > toNum(a.Price ?? a.Week) ? b : a, null);
  const minBriq   = briqs.reduce(  (a,b) => !a || toNum(b.Price ?? b.Week) < toNum(a.Price ?? a.Week) ? b : a, null);
  const maxBriq   = briqs.reduce(  (a,b) => !a || toNum(b.Price ?? b.Week) > toNum(a.Price ?? a.Week) ? b : a, null);

  const bestBuy  = [minPellet, minBriq].filter(Boolean).reduce((a,b)=> toNum(b.Price ?? b.Week) < toNum(a.Price ?? a.Week) ? b : a);
  const bestSell = [maxPellet, maxBriq].filter(Boolean).reduce((a,b)=> toNum(b.Price ?? b.Week) > toNum(a.Price ?? a.Week) ? b : a);

  if (bestBuyPrice)  bestBuyPrice.textContent  = fmtINR(toNum(bestBuy?.Price ?? bestBuy?.Week));
  if (bestBuyWhere)  bestBuyWhere.textContent  = bestBuy?.State ?? "—";
  if (bestSellPrice) bestSellPrice.textContent = fmtINR(toNum(bestSell?.Price ?? bestSell?.Week));
  if (bestSellWhere) bestSellWhere.textContent = bestSell?.State ?? "—";
}

function setSeasonalBanner() {
  const node = els.seasonalText();
  if (!node) return;
  const month = new Date().getMonth(); // 0–11
  const notes = {
    3: "Rabi harvest increases agri‑residue → prices may soften regionally.",
    4: "Transport tightness around holidays → freight can spike.",
    9: "Kharif harvest brings fresh residue → watch short‑term dips.",
  };
  node.textContent = notes[month] || "Stable seasonality expected. Track freight & local availability.";
}

function wireFreightCalc() {
  const d = els.fcDistance(), t = els.fcTonnage(), r = els.fcRate(), total = els.fcTotal(), perTon = els.fcPerTon();
  if (!d || !t || !r || !total || !perTon) return;
  const calc = () => {
    const dist = Number(d.value||0), tons = Number(t.value||0), rate = Number(r.value||0);
    total.textContent  = fmtINR(dist * rate * tons);
    perTon.textContent = fmtINR(dist * rate);
  };
  [d,t,r].forEach(el => el.addEventListener("input", calc));
  calc();
}

// Optional: confidence + last updated badge
function renderStatusFor(locationKey) {
  const confEl = els.confidenceBadge();
  const lastEl = els.lastUpdatedBadge();
  if (!confEl && !lastEl) return;

  // choose current material selections if present
  const mSel = els.materialSelect();
  const bSel = els.briquetteSelect();
  const m = mSel?.value || Object.keys(dataset[locationKey]?.materials?.pellets ?? {})[0];
  const b = bSel?.value || Object.keys(dataset[locationKey]?.materials?.briquettes ?? {})[0];

  const pelletRow = sheetData.find(r =>
    r.State?.trim() === locationKey && (r.Type||"").toLowerCase()==="pellet" && (r.Material??"Standard").toString().trim() === m
  );
  const briqRow   = sheetData.find(r =>
    r.State?.trim() === locationKey && (r.Type||"").toLowerCase()==="briquette" && (r.Material??"Standard").toString().trim() === b
  );

  if (confEl) {
    const { label, cls } = confidenceFrom(pelletRow, briqRow);
    confEl.textContent = `Confidence: ${label}`;
    confEl.className = `badge ${cls}`;
  }

  const anyUpd = (pelletRow?.Updated || briqRow?.Updated || sheetData.find(r => r["Last Updated"])?.["Last Updated"]);
  if (lastEl) lastEl.textContent = `Last updated: ${anyUpd || "--"}`;
}

// ====== INIT FLOW ======
async function boot() {
  await loadData();
  populateLocationsAndMaterials();
  computeBestDeals();   // safe optional
  setSeasonalBanner();  // safe optional
  wireFreightCalc();    // safe optional

  // also safe status render
  const loc = els.locationSelect()?.value;
  if (loc) renderStatusFor(loc);
}

document.addEventListener("DOMContentLoaded", boot);