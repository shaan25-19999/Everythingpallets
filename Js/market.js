// js/market.js
// Reads everything from your SheetBest sheet and powers the Market page

let sheetData = [];

const LAST_UPDATED_KEYS = ["Last Updated", "Last updated", "LastUpdated"];

const loadData = async () => {
  const res = await fetch("https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf");
  sheetData = await res.json();

  const structured = {};
  const pelletLabels = new Set();
  const briquetteLabels = new Set();

  for (const raw of sheetData) {
    const location = (raw.State || "").trim();
    const material = (raw.Material || "").trim();
    const type = (raw.Type || "").trim().toLowerCase();

    // parse numbers safely
    const toNum = v => {
      if (v === null || v === undefined || v === "") return NaN;
      const n = parseInt(String(v).replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n : NaN;
    };

    const trend = [
      toNum(raw.Year),
      toNum(raw["6 Month"]),
      toNum(raw.Month),
      toNum(raw.Week)
    ];

    if (!structured[location]) {
      structured[location] = { materials: { pellets: {}, briquettes: {} } };
    }

    const formatted = { 
      price: toNum(raw.Week), 
      trend: trend.map(v => (Number.isFinite(v) ? v : 0)) 
    };

    if (type.includes("pellet")) {
      structured[location].materials.pellets[material] = formatted;
      if (material) pelletLabels.add(material);
    } else if (type.includes("briquette")) {
      structured[location].materials.briquettes[material] = formatted;
      if (material) briquetteLabels.add(material);
    }
  }

  return { structured, pelletLabels, briquetteLabels };
};

document.addEventListener("DOMContentLoaded", async () => {
  const locationSelect = document.getElementById("locationSelect");
  const materialSelect = document.getElementById("materialSelect");
  const briquetteSelect = document.getElementById("briquetteSelect");
  const materialTable = document.getElementById("materialTable");
  const briquetteTable = document.getElementById("briquetteTable");

  const pelletTs = document.getElementById("pelletTimestamp");
  const briqTs = document.getElementById("briquetteTimestamp");

  const { structured: dataset, pelletLabels, briquetteLabels } = await loadData();

  // Build location list (skip GLOBAL)
  const locations = Object.keys(dataset).filter(loc => loc && loc.toUpperCase() !== "GLOBAL");
  locations.sort((a,b) => a.localeCompare(b));

  // fill location dropdown
  locationSelect.innerHTML = "";
  for (const loc of locations) {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  }

  // create charts
  const ctx = document.getElementById("priceChart").getContext("2d");
  const briquetteCtx = document.getElementById("briquetteChart").getContext("2d");

  const makeChart = (context) => new Chart(context, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => `₹${c.parsed.y.toLocaleString('en-IN')}` } }
      },
      scales: { y: { ticks: { callback: v => `₹${Number(v).toLocaleString('en-IN')}` } } }
    }
  });

  const chart = makeChart(ctx);
  const briquetteChart = makeChart(briquetteCtx);

  // ---------- helpers ----------
  const fmt = n => Number(n).toLocaleString('en-IN');

  const latestUpdated = (() => {
    // get max date across rows; accept multiple header spellings and formats
    const parseAnyDate = (s) => {
      if (!s) return null;
      const str = String(s).trim();
      // try dd/mm/yyyy
      const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (m) {
        const d = parseInt(m[1],10), mo = parseInt(m[2],10)-1, y = parseInt(m[3],10);
        const Y = y < 100 ? 2000 + y : y;
        const dt = new Date(Y, mo, d);
        return isNaN(dt) ? null : dt;
      }
      // fallback to Date()
      const dt = new Date(str);
      return isNaN(dt) ? null : dt;
    };

    let maxDt = null;
    for (const row of sheetData) {
      let val = null;
      for (const k of LAST_UPDATED_KEYS) {
        if (row[k] && String(row[k]).trim()) { val = row[k]; break; }
      }
      const dt = parseAnyDate(val);
      if (dt && (!maxDt || dt > maxDt)) maxDt = dt;
    }
    return maxDt ? maxDt.toLocaleDateString('en-IN') : "--";
  })();

  function renderTable(locationKey) {
    const data = dataset[locationKey]?.materials?.pellets || {};
    materialTable.innerHTML = `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const bars = trend.map(v => `<span style="display:inline-block;width:5px;height:${10 + (v||0)/100}px;background:#52b788;margin:0 1px;"></span>`).join('');
        return `<tr><td>${type}</td><td><strong>₹${fmt(price||0)}</strong></td><td>${bars}</td></tr>`;
      }).join('');
  }

  function renderBriquetteTable(locationKey) {
    const data = dataset[locationKey]?.materials?.briquettes || {};
    briquetteTable.innerHTML = `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const bars = trend.map(v => `<span style="display:inline-block;width:5px;height:${10 + (v||0)/100}px;background:#6a4f2d;margin:0 1px;"></span>`).join('');
        return `<tr><td>${type}</td><td><strong>₹${fmt(price||0)}</strong></td><td>${bars}</td></tr>`;
      }).join('');
  }

  function updateChart(locationKey, type, chartObj, isPellet = true) {
    const source = isPellet
      ? (dataset[locationKey]?.materials?.pellets || {})
      : (dataset[locationKey]?.materials?.briquettes || {});
    const series = source[type]?.trend || [];
    chartObj.data.datasets[0].label = type || '';
    chartObj.data.datasets[0].data = series;
    chartObj.update();

    // Specs from GLOBAL row for that material (if present)
    updateSpecs(type, isPellet);
  }

  function updateSpecs(material, isPellet = true) {
    const specContainerId = isPellet ? "pelletSpecs" : "briquetteSpecs";
    const tsEl = isPellet ? pelletTs : briqTs;

    const globalInfo = sheetData.find(row =>
      String(row.State || "").trim().toLowerCase() === "global" &&
      String(row.Material || "").trim() === material &&
      String(row.Type || "").toLowerCase().includes(isPellet ? "pellet" : "briquette")
    );

    if (globalInfo) {
      const container = document.getElementById(specContainerId);
      container.innerHTML = `
        <p><strong>Ash:</strong> ${globalInfo.Ash || '--'}%</p>
        <p><strong>Moisture:</strong> ${globalInfo.Moisture || '--'}%</p>
        <p><strong>Kcal Value:</strong> ${globalInfo.Kcal || '--'}</p>
      `;
    }

    // unified last updated
    if (tsEl) tsEl.textContent = latestUpdated;
  }

  function updateMaterialDropdowns(locationKey) {
    materialSelect.innerHTML = "";
    briquetteSelect.innerHTML = "";

    const pellets = Object.keys(dataset[locationKey]?.materials?.pellets || {});
    const briqs   = Object.keys(dataset[locationKey]?.materials?.briquettes || {});

    for (const m of pellets) {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      materialSelect.appendChild(opt);
    }
    for (const m of briqs) {
      const opt = document.createElement("option");
      opt.value = m; opt.textContent = m;
      briquetteSelect.appendChild(opt);
    }
  }

  // ---- Best Buy / Best Sell (auto, with optional override) ----
  function computeBestSignals(locationKey) {
    const locRows = sheetData.filter(r => (r.State || "").trim() === locationKey);

    const num = v => {
      const n = parseInt(String(v || "").replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n : null;
    };

    const pellets = locRows.filter(r => String(r.Type||"").toLowerCase().includes("pellet"))
      .map(r => ({ mat: r.Material, price: num(r.Week) }))
      .filter(x => x.price !== null);

    const briqs = locRows.filter(r => String(r.Type||"").toLowerCase().includes("briquette"))
      .map(r => ({ mat: r.Material, price: num(r.Week) }))
      .filter(x => x.price !== null);

    const best = (arr, dir) => {
      if (!arr.length) return null;
      return arr.reduce((acc, x) => (dir === 'min' ? (x.price < acc.price ? x : acc) : (x.price > acc.price ? x : acc)));
    };

    // optional overrides from sheet (columns are optional; if present & numeric they win)
    const overrideRow = sheetData.find(r => (r.State||"").trim() === locationKey && (r.Material||"").trim().toUpperCase() === "OVERRIDE");
    const getOverride = key => overrideRow ? num(overrideRow[key]) : null;

    const bestBuyPellet  = getOverride("Best Buy Pellet")  ?? best(pellets, 'min')?.price ?? null;
    const bestSellPellet = getOverride("Best Sell Pellet") ?? best(pellets, 'max')?.price ?? null;
    const bestBuyBriq    = getOverride("Best Buy Briquette")  ?? best(briqs, 'min')?.price ?? null;
    const bestSellBriq   = getOverride("Best Sell Briquette") ?? best(briqs, 'max')?.price ?? null;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val === null ? "--" : `₹${fmt(val)}`);
    };

    set("bestBuyPellet", bestBuyPellet);
    set("bestSellPellet", bestSellPellet);
    set("bestBuyBriquette", bestBuyBriq);
    set("bestSellBriquette", bestSellBriq);
  }

  function refreshAll() {
    const loc = locationSelect.value;
    if (!loc) return;

    updateMaterialDropdowns(loc);
    renderTable(loc);
    renderBriquetteTable(loc);
    computeBestSignals(loc);

    const defaultPellet = materialSelect.options[0]?.value;
    const defaultBriquette = briquetteSelect.options[0]?.value;

    if (defaultPellet) updateChart(loc, defaultPellet, chart, true);
    if (defaultBriquette) updateChart(loc, defaultBriquette, briquetteChart, false);
  }

  // Listeners
  locationSelect.addEventListener("change", refreshAll);
  materialSelect.addEventListener("change", () => updateChart(locationSelect.value, materialSelect.value, chart, true));
  briquetteSelect.addEventListener("change", () => updateChart(locationSelect.value, briquetteSelect.value, briquetteChart, false));

  // boot
  locationSelect.value = locations[0] || "";
  refreshAll();
});