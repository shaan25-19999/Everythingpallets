// ====== DATA SOURCE (Market Prices sheet ONLY) ======
let sheetData = [];

const MARKET_API_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf";

// ====== UTILS ======
const toNum = (v) => v ? parseInt(String(v).replace(/,/g, ""), 10) : 0;
const fmtINR = (n) => (n == null || isNaN(n)) ? "--" : Number(n).toLocaleString("en-IN");

// Support variant headers for "6 Month"
const sixM = (row) => row ? toNum(row["6 Month"] ?? row["6month"] ?? row["6mo"] ?? row["SixMonth"] ?? 0) : 0;

// Confidence score based on presence of Year/6M/Month/Week across pellet+briquette rows
const confidenceFrom = (pRow, bRow) => {
  let score = 0;
  [pRow, bRow].forEach(r => {
    if (!r) return;
    let parts = 0;
    if (toNum(r.Year)) parts++;
    if (sixM(r)) parts++;
    if (toNum(r.Month)) parts++;
    if (toNum(r.Week)) parts++;
    score += parts;
  });
  if (score >= 6) return { label: "High", cls: "ok" };
  if (score >= 3) return { label: "Medium", cls: "mid" };
  return { label: "Low", cls: "low" };
};

const safeEl = (id) => document.getElementById(id) || null;

// ====== LOAD + SHAPE (kept from original, lightly refined) ======
const loadData = async () => {
  const res = await fetch(MARKET_API_URL);
  sheetData = await res.json();

  const structured = {};
  const pelletLabels = new Set();
  const briquetteLabels = new Set();

  for (const row of sheetData) {
    const location = row.State?.trim();
    const material = (row.Material?.trim() || "Standard");
    const type = (row.Type?.trim() || "").toLowerCase();

    if (!location || !type) continue;

    const price = toNum(row.Week); // original used Week as the live price cell
    const trend = [toNum(row.Year), sixM(row), toNum(row.Month), toNum(row.Week)];

    if (!structured[location]) {
      structured[location] = { materials: { pellets: {}, briquettes: {} } };
    }
    const formatted = { price, trend };

    if (type === "pellet") {
      structured[location].materials.pellets[material] = formatted;
      pelletLabels.add(material);
    } else if (type === "briquette") {
      structured[location].materials.briquettes[material] = formatted;
      briquetteLabels.add(material);
    }
  }

  return { structured, pelletLabels, briquetteLabels };
};

// ====== MAIN ======
document.addEventListener("DOMContentLoaded", async () => {
  // DOM refs (existing)
  const locationSelect     = safeEl("locationSelect");
  const materialSelect     = safeEl("materialSelect");       // pellet
  const briquetteSelect    = safeEl("briquetteSelect");      // briquette
  const materialTable      = safeEl("materialTable");
  const briquetteTable     = safeEl("briquetteTable");
  const ctx                = safeEl("priceChart")?.getContext?.("2d");
  const briquetteCtx       = safeEl("briquetteChart")?.getContext?.("2d");

  // DOM refs (new/optional — code guards if absent)
  const pelletTimestampEl  = safeEl("pelletTimestamp");
  const briqTimestampEl    = safeEl("briquetteTimestamp");
  const pelletSpecsEl      = safeEl("pelletSpecs");
  const briquetteSpecsEl   = safeEl("briquetteSpecs");
  const confidenceBadge    = safeEl("confidenceBadge");
  const lastUpdatedEl      = safeEl("lastUpdated");
  const seasonalTextEl     = safeEl("seasonalText");
  const fcDistance         = safeEl("fcDistance");
  const fcTonnage          = safeEl("fcTonnage");
  const fcRate             = safeEl("fcRate");
  const fcTotal            = safeEl("fcTotal");
  const fcPerTon           = safeEl("fcPerTon");
  const bestBuyPrice       = safeEl("bestBuyPrice");
  const bestBuyWhere       = safeEl("bestBuyWhere");
  const bestSellPrice      = safeEl("bestSellPrice");
  const bestSellWhere      = safeEl("bestSellWhere");

  // Load data
  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();

  // remove GLOBAL material choice from dropdowns, and hide GLOBAL from locations
  pelletLabels.delete("GLOBAL");
  briquetteLabels.delete("GLOBAL");
  const locations = Object.keys(dataset).filter(loc => (loc || "").toUpperCase() !== "GLOBAL");

  // ====== Controls (kept) ======
  // Locations
  if (locationSelect) {
    locations.forEach(loc => {
      const opt = document.createElement("option");
      opt.value = loc;
      opt.textContent = loc;
      locationSelect.appendChild(opt);
    });
  }

  // Material dropdowns
  const fillSelect = (el, items) => {
    if (!el) return;
    el.innerHTML = "";
    items.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      el.appendChild(opt);
    });
  };

  fillSelect(materialSelect,  Array.from(pelletLabels));
  fillSelect(briquetteSelect, Array.from(briquetteLabels));

  // ====== Charts (improved options) ======
  const mkBounds = (vals) => {
    const arr = (vals || []).filter(v => typeof v === "number" && v > 0);
    if (!arr.length) return { min: 0, max: 1000 };
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    if (min === max) return { min: Math.floor(min * 0.95), max: Math.ceil(max * 1.05) || min + 100 };
    return { min: Math.floor(min * 0.95), max: Math.ceil(max * 1.05) };
  };

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
          callbacks: { label: ctx => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton` }
        }
      }
    }
  });

  const labels = ['Year', '6 Months', 'Month', 'Week'];
  const chart = ctx ? new Chart(ctx, {
    ...baseOpts(0, 1000),
    data: { labels, datasets: [{ label: '', data: [], borderColor: "#1C3D5A", backgroundColor: "rgba(29,61,90,0.08)", fill: true }] }
  }) : null;

  const briquetteChart = briquetteCtx ? new Chart(briquetteCtx, {
    ...baseOpts(0, 1000),
    data: { labels, datasets: [{ label: '', data: [], borderColor: "#FFA500", backgroundColor: "rgba(255,165,0,0.12)", fill: true }] }
  }) : null;

  // ====== Tables (kept) ======
  function renderTable(locationKey) {
    if (!materialTable || !dataset[locationKey]) return;
    const data = dataset[locationKey].materials.pellets;
    materialTable.innerHTML =
      `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const bars = (trend || []).map(val =>
          `<span style="display:inline-block;width:5px;height:${10 + (Number(val)||0) / 100}px;background:#52b788;margin:0 1px;"></span>`
        ).join('');
        return `<tr><td>${type}</td><td><strong>₹${fmtINR(price)}</strong></td><td>${bars}</td></tr>`;
      }).join('');
  }

  function renderBriquetteTable(locationKey) {
    if (!briquetteTable || !dataset[locationKey]) return;
    const data = dataset[locationKey].materials.briquettes;
    briquetteTable.innerHTML =
      `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const bars = (trend || []).map(val =>
          `<span style="display:inline-block;width:5px;height:${10 + (Number(val)||0) / 100}px;background:#6a4f2d;margin:0 1px;"></span>`
        ).join('');
        return `<tr><td>${type}</td><td><strong>₹${fmtINR(price)}</strong></td><td>${bars}</td></tr>`;
      }).join('');
  }

  // ====== Specs + Timestamps (kept & hardened) ======
  function updateSpecs(material, isPellet = true) {
    const specEl = isPellet ? pelletSpecsEl : briquetteSpecsEl;
    const stampEl = isPellet ? pelletTimestampEl : briqTimestampEl;
    if (!specEl && !stampEl) return;

    const globalInfo = sheetData.find(row =>
      (row.State?.trim().toUpperCase() === "GLOBAL") &&
      (row.Material?.trim() || "Standard") === (material || "Standard") &&
      (row.Type?.trim() || "").toLowerCase().includes(isPellet ? "pellet" : "briquette")
    );

    if (globalInfo && specEl) {
      specEl.innerHTML = `
        <p><strong>Ash:</strong> ${globalInfo.Ash || '--'}%</p>
        <p><strong>Moisture:</strong> ${globalInfo.Moisture || '--'}%</p>
        <p><strong>Kcal Value:</strong> ${globalInfo.Kcal || '--'}</p>
      `;
    }

    // Prefer "Last Updated", fallback to "Updated"
    const anyUpdated = (sheetData.find(r => r["Last Updated"])?.["Last Updated"]) ||
                       (sheetData.find(r => r.Updated)?.Updated) || null;
    if (stampEl && anyUpdated) stampEl.textContent = anyUpdated;
    if (lastUpdatedEl && anyUpdated) lastUpdatedEl.textContent = `Last updated: ${anyUpdated}`;
  }

  // Helper to find a raw row by location/type/material for status/confidence
  function findRawRow(locationKey, type, material) {
    const t = (type || "").toLowerCase();
    const m = (material || "Standard").trim();
    const rows = sheetData.filter(r =>
      (r.State?.trim() || "").toUpperCase() === (locationKey || "").toUpperCase() &&
      ((r.Type?.trim() || "").toLowerCase() === t)
    );
    return rows.find(r => (r.Material || "Standard") === m) || rows[0] || null;
  }

  // ====== Charts update (kept + improved) ======
  function updateChart(locationKey, type, chartObj, isPellet = true) {
    if (!chartObj || !dataset[locationKey]) return;

    const source = isPellet ? dataset[locationKey].materials.pellets
                            : dataset[locationKey].materials.briquettes;

    const trend = source[type]?.trend || [];
    const b = mkBounds(trend);

    chartObj.data.datasets[0].label = type;
    chartObj.data.datasets[0].data = trend;
    // adjust bounds
    chartObj.options.scales.y.suggestedMin = b.min;
    chartObj.options.scales.y.suggestedMax = b.max;
    chartObj.update();

    updateSpecs(type, isPellet);

    // Confidence badge & combined last-updated (optional UI)
    if (confidenceBadge || lastUpdatedEl) {
      const pelletMat = materialSelect?.value || [...Object.keys(dataset[locationKey].materials.pellets)][0];
      const briqMat   = briquetteSelect?.value || [...Object.keys(dataset[locationKey].materials.briquettes)][0];
      const pRow = findRawRow(locationKey, "pellet", pelletMat);
      const bRow = findRawRow(locationKey, "briquette", briqMat);
      const conf = confidenceFrom(pRow, bRow);

      if (confidenceBadge) {
        confidenceBadge.textContent = `Confidence: ${conf.label}`;
        confidenceBadge.className = `badge ${conf.cls}`;
      }

      const anyUpdated = (sheetData.find(r => r["Last Updated"])?.["Last Updated"]) ||
                         (sheetData.find(r => r.Updated)?.Updated) || "--";
      if (lastUpdatedEl) lastUpdatedEl.textContent = `Last updated: ${anyUpdated}`;
    }
  }

  // ====== Dropdowns react to location ======
  function updateMaterialDropdowns(locationKey) {
    if (!dataset[locationKey]) return;
    if (materialSelect) {
      materialSelect.innerHTML = "";
      Object.keys(dataset[locationKey].materials.pellets).forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        materialSelect.appendChild(opt);
      });
    }
    if (briquetteSelect) {
      briquetteSelect.innerHTML = "";
      Object.keys(dataset[locationKey].materials.briquettes).forEach(mat => {
        const opt = document.createElement("option");
        opt.value = mat;
        opt.textContent = mat;
        briquetteSelect.appendChild(opt);
      });
    }
  }

  function refreshAll() {
    const loc = locationSelect?.value || locations[0];

    updateMaterialDropdowns(loc);
    renderTable(loc);
    renderBriquetteTable(loc);

    const defaultPellet = materialSelect?.options?.[0]?.value;
    const defaultBriq   = briquetteSelect?.options?.[0]?.value;

    if (defaultPellet) updateChart(loc, materialSelect.value = defaultPellet, chart, true);
    if (defaultBriq)   updateChart(loc, briquetteSelect.value = defaultBriq, briquetteChart, false);

    // New lightweight add-ons
    computeBestDeals();
    setSeasonalBanner();
    wireFreightCalc();
  }

  // Wire events
  locationSelect?.addEventListener("change", refreshAll);
  materialSelect?.addEventListener("change", () => {
    const loc = locationSelect?.value || locations[0];
    updateChart(loc, materialSelect.value, chart, true);
  });
  briquetteSelect?.addEventListener("change", () => {
    const loc = locationSelect?.value || locations[0];
    updateChart(loc, briquetteSelect.value, briquetteChart, false);
  });

  // Set defaults
  if (locationSelect && locations.length) locationSelect.value = locations[0];
  if (materialSelect && pelletLabels.size)   materialSelect.value   = [...pelletLabels][0];
  if (briquetteSelect && briquetteLabels.size) briquetteSelect.value = [...briquetteLabels][0];

  // Initial render
  refreshAll();

  // ====== Best Deals (min/max across India; uses Week as price) ======
  function computeBestDeals() {
    if (!bestBuyPrice && !bestSellPrice) return;

    const pellets = sheetData.filter(r => (r.Type || "").toLowerCase() === "pellet" && toNum(r.Week) > 0);
    const briqs   = sheetData.filter(r => (r.Type || "").toLowerCase() === "briquette" && toNum(r.Week) > 0);

    const minPellet = pellets.reduce((a,b) => !a || toNum(b.Week) < toNum(a.Week) ? b : a, null);
    const maxPellet = pellets.reduce((a,b) => !a || toNum(b.Week) > toNum(a.Week) ? b : a, null);
    const minBriq   = briqs.reduce((a,b) => !a || toNum(b.Week) < toNum(a.Week) ? b : a, null);
    const maxBriq   = briqs.reduce((a,b) => !a || toNum(b.Week) > toNum(a.Week) ? b : a, null);

    const bestBuy  = [minPellet, minBriq].filter(Boolean).reduce((a,b)=> !a || toNum(b.Week) < toNum(a.Week) ? b : a, null);
    const bestSell = [maxPellet, maxBriq].filter(Boolean).reduce((a,b)=> !a || toNum(b.Week) > toNum(a.Week) ? b : a, null);

    if (bestBuyPrice)  bestBuyPrice.textContent  = fmtINR(bestBuy ? toNum(bestBuy.Week) : null);
    if (bestBuyWhere)  bestBuyWhere.textContent  = bestBuy ? (bestBuy.State || "—") : "—";
    if (bestSellPrice) bestSellPrice.textContent = fmtINR(bestSell ? toNum(bestSell.Week) : null);
    if (bestSellWhere) bestSellWhere.textContent = bestSell ? (bestSell.State || "—") : "—";
  }

  // ====== Seasonal Banner (simple, optional) ======
  function setSeasonalBanner() {
    if (!seasonalTextEl) return;
    const month = new Date().getMonth(); // 0=Jan
    const notes = {
      3: "Rabi harvest increases agri‑residue → prices may soften regionally.",
      4: "Transport tightness around holidays → freight can spike.",
      9: "Kharif harvest brings fresh residue → watch short‑term dips.",
    };
    seasonalTextEl.textContent = notes[month] || "Stable seasonality expected. Track freight & local availability.";
  }

  // ====== Freight Calculator (optional) ======
  function wireFreightCalc() {
    if (!fcDistance || !fcTonnage || !fcRate || (!fcTotal && !fcPerTon)) return;
    const calc = () => {
      const dist = Number(fcDistance.value || 0);
      const tons = Number(fcTonnage.value || 0);
      const rate = Number(fcRate.value || 0);
      const total = dist * rate * tons;   // ₹
      const perTon = dist * rate;         // ₹/ton
      if (fcTotal)  fcTotal.textContent  = fmtINR(total);
      if (fcPerTon) fcPerTon.textContent = fmtINR(perTon);
    };
    ["input", "change"].forEach(ev => {
      fcDistance.addEventListener(ev, calc);
      fcTonnage.addEventListener(ev, calc);
      fcRate.addEventListener(ev, calc);
    });
    calc();
  }
});