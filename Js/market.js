// ===== CONFIG =====
const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";

// ===== STATE =====
let rows = [];
let rowsByLocation = {};
let pelletTypes = new Set();
let briqTypes = new Set();

let pelletChart, briqChart;

// ===== HELPERS =====
const fmtIN = (n) => (isFinite(+n) ? Number(n).toLocaleString("en-IN") : "--");
const nowStamp = () => new Date().toLocaleString("en-IN");

// Robust column getter (handles minor header variations)
const get = (obj, key) => {
  if (!obj) return undefined;
  const keys = Object.keys(obj);
  const found = keys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
  return found ? obj[found] : undefined;
};

// time-series values (Year, 6 Month(s), Month, Week)
function extractSeries(row) {
  const Y  = parseInt(get(row, "Year"))   || 0;
  const M6 = parseInt(get(row, "6 Month")) || parseInt(get(row, "6 Months")) || parseInt(get(row, "6mo")) || 0;
  const M  = parseInt(get(row, "Month"))  || 0;
  const W  = parseInt(get(row, "Week"))   || 0;
  return { Y, M6, M, W };
}

// naive confidence (more filled fields => higher confidence)
function confidenceFor(rows) {
  if (!rows || !rows.length) return 0;
  let filled = 0, total = 0;
  rows.forEach(r => {
    const s = extractSeries(r);
    [s.Y, s.M6, s.M, s.W].forEach(v => { total++; if (v > 0) filled++; });
  });
  return Math.round((filled / Math.max(total,1)) * 100);
}

// simple 7-day micro forecast (weighted blend of M and W deltas)
function microForecast(activeRows) {
  if (!activeRows || !activeRows.length) return "Forecast unavailable.";
  const pts = activeRows.map(r => {
    const s = extractSeries(r);
    // approximate next week = week + 30%*(month-week)
    const nextW = Math.round(s.W + 0.3 * (s.M - s.W));
    return { type: get(r, "Type"), next: nextW, curr: s.W };
  });
  const pellet = pts.find(p => (p.type || "").toLowerCase().includes("pellet"));
  const briq   = pts.find(p => (p.type || "").toLowerCase().includes("briq"));
  const pelletTxt = pellet ? `Pellet next week ~ ₹${fmtIN(pellet.next)}/t (${pellet.next >= pellet.curr ? "↑" : "↓"})` : "";
  const briqTxt   = briq   ? `Briquette next week ~ ₹${fmtIN(briq.next)}/t (${briq.next >= briq.curr ? "↑" : "↓"})` : "";
  return [pelletTxt, briqTxt].filter(Boolean).join(" • ");
}

// seasonal note (very simple signal by month)
function seasonalNote(state) {
  const m = new Date().getMonth(); // 0-11
  const riceStates = ["punjab","haryana","up","uttar pradesh","bihar","wb","west bengal"];
  const isRiceRegion = riceStates.some(s => (state||"").toLowerCase().includes(s));
  if (isRiceRegion && (m >= 9 && m <= 11)) return "Rice harvest drives husk supply; pellet prices may soften.";
  if (m >= 3 && m <= 5) return "Pre‑monsoon logistics tightness can nudge freight up.";
  return "Normal seasonal conditions.";
}

// ===== RENDER =====
function fillSelect(selectEl, values) {
  selectEl.innerHTML = "";
  values.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  });
}

function buildTables(loc) {
  const matT = document.getElementById("materialTable");
  const briT = document.getElementById("briquetteTable");
  matT.innerHTML = "";
  briT.innerHTML = "";

  const hdr = `
    <thead><tr>
      <th>Type</th><th>Week</th><th>Month</th><th>6 Months</th><th>Year</th>
    </tr></thead><tbody>`;

  const rowsHere = rowsByLocation[loc] || [];
  const pellets = rowsHere.filter(r => (get(r,"Type")||"").toLowerCase().includes("pellet"));
  const briqs   = rowsHere.filter(r => (get(r,"Type")||"").toLowerCase().includes("briq"));

  const trs = (arr) => arr.map(r => {
    const s = extractSeries(r);
    return `<tr>
      <td>${get(r,"Type")||"--"}</td>
      <td>₹${fmtIN(s.W)}</td>
      <td>₹${fmtIN(s.M)}</td>
      <td>₹${fmtIN(s.M6)}</td>
      <td>₹${fmtIN(s.Y)}</td>
    </tr>`;
  }).join("");

  matT.innerHTML = hdr + trs(pellets) + "</tbody>";
  briT.innerHTML = hdr + trs(briqs) + "</tbody>";
}

function renderSnapshot(loc) {
  const here = rowsByLocation[loc] || [];
  const pel = here.filter(r => (get(r,"Type")||"").toLowerCase().includes("pellet"));
  const bri = here.filter(r => (get(r,"Type")||"").toLowerCase().includes("briq"));

  // Averages
  const avg = (arr, pick) => {
    const vals = arr.map(pick).filter(v => isFinite(+v));
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
    };
  const pAvg = avg(pel, r => extractSeries(r).W);
  const bAvg = avg(bri, r => extractSeries(r).W);

  // "Last deal" = using Week column as proxy
  const pLast = Math.max(...pel.map(r => extractSeries(r).W).filter(v=>v>0), 0);
  const bLast = Math.max(...bri.map(r => extractSeries(r).W).filter(v=>v>0), 0);

  document.getElementById("kpiPelletAvg").textContent = fmtIN(pAvg);
  document.getElementById("kpiPelletLast").textContent = `Last deal: ₹${fmtIN(pLast)}/t`;
  document.getElementById("kpiBriqAvg").textContent = fmtIN(bAvg);
  document.getElementById("kpiBriqLast").textContent = `Last deal: ₹${fmtIN(bLast)}/t`;
  document.getElementById("lastUpdated").textContent = `Updated: ${nowStamp()}`;

  // Confidence
  const conf = confidenceFor(here);
  const bar = document.getElementById("confidenceBar");
  const txt = document.getElementById("confidenceText");
  bar.style.width = `${conf}%`;
  bar.dataset.level = conf >= 70 ? "high" : conf >= 40 ? "mid" : "low";
  txt.textContent = `${conf}%`;

  // Signals: Best Buy / Best Sell (relative vs national avg)
  const signals = document.getElementById("bestSignals");
  signals.innerHTML = "";
  const natPelAvg = Math.round(avg(rows.filter(r => (get(r,"Type")||"").toLowerCase().includes("pellet")), r=>extractSeries(r).W));
  const natBriAvg = Math.round(avg(rows.filter(r => (get(r,"Type")||"").toLowerCase().includes("briq")),   r=>extractSeries(r).W));
  const delta = (v, base) => (isFinite(+v) && isFinite(+base)) ? Math.round(((v-base)/base)*100) : 0;
  const pelDelta = delta(pAvg, natPelAvg);
  const briDelta = delta(bAvg, natBriAvg);

  const liPel = document.createElement("li");
  liPel.textContent = pelDelta < 0 ? `Best Buy: Pellet here is ${Math.abs(pelDelta)}% below national avg.` :
                                   `Best Sell: Pellet here is ${pelDelta}% above national avg.`;
  const liBri = document.createElement("li");
  liBri.textContent = briDelta < 0 ? `Best Buy: Briquette here is ${Math.abs(briDelta)}% below national avg.` :
                                    `Best Sell: Briquette here is ${briDelta}% above national avg.`;
  signals.append(liPel, liBri);

  // Forecast & seasonal notes
  document.getElementById("forecastNote").textContent = microForecast(here);
  document.getElementById("seasonalNote").textContent = seasonalNote(loc);
}

function buildSelectors(loc) {
  const here = rowsByLocation[loc] || [];
  const mSel = document.getElementById("materialSelect");
  const bSel = document.getElementById("briquetteSelect");

  const mVals = [...new Set(here.filter(r => (get(r,"Type")||"").toLowerCase().includes("pellet"))
                      .map(r => get(r,"Type")).filter(Boolean))];
  const bVals = [...new Set(here.filter(r => (get(r,"Type")||"").toLowerCase().includes("briq"))
                      .map(r => get(r,"Type")).filter(Boolean))];

  fillSelect(mSel, mVals);
  fillSelect(bSel, bVals);
}

function drawCharts(loc) {
  const labels = ["Year","6 Months","Month","Week"];
  const ctxP = document.getElementById("priceChart").getContext("2d");
  const ctxB = document.getElementById("briquetteChart").getContext("2d");

  const pType = document.getElementById("materialSelect").value;
  const bType = document.getElementById("briquetteSelect").value;

  const pRow = (rowsByLocation[loc] || []).find(r => get(r,"Type") === pType);
  const bRow = (rowsByLocation[loc] || []).find(r => get(r,"Type") === bType);

  const pS = extractSeries(pRow || {});
  const bS = extractSeries(bRow || {});

  const pData = [pS.Y, pS.M6, pS.M, pS.W];
  const bData = [bS.Y, bS.M6, bS.M, bS.W];

  if (pelletChart) pelletChart.destroy();
  if (briqChart) briqChart.destroy();

  const baseOptions = (min, max) => ({
    responsive: true,
    maintainAspectRatio: false,
    elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 3 } },
    scales: {
      y: {
        suggestedMin: Math.floor(min * 0.95),
        suggestedMax: Math.ceil(max * 1.05),
        ticks: { callback: v => `₹${Number(v).toLocaleString("en-IN")}` }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton` } }
    }
  });

  const minP = Math.min(...pData.filter(v=>v>0), 0);
  const maxP = Math.max(...pData, 0);
  const minB = Math.min(...bData.filter(v=>v>0), 0);
  const maxB = Math.max(...bData, 0);

  pelletChart = new Chart(ctxP, {
    type: "line",
    data: { labels, datasets: [{ label: "Pellet", data: pData, borderColor: "#1C3D5A", backgroundColor: "#DDEAF4" }] },
    options: baseOptions(minP, maxP)
  });

  briqChart = new Chart(ctxB, {
    type: "line",
    data: { labels, datasets: [{ label: "Briquette", data: bData, borderColor: "#FFA500", backgroundColor: "#FFEFD5" }] },
    options: baseOptions(minB, maxB)
  });

  document.getElementById("pelletTimestamp").textContent = nowStamp();
  document.getElementById("briquetteTimestamp").textContent = nowStamp();

  document.getElementById("chartTitle").textContent = `Pellet Price Trend — ${pType || "—"}`;
  document.getElementById("briquetteChartTitle").textContent = `Briquette Price Trend — ${bType || "—"}`;
}

// ===== FREIGHT / LANDED COST =====
const FREIGHT_RATE_PER_TKM = 3.5; // ₹ per ton per km (industry avg placeholder)

function calcLanded(loc) {
  const here = rowsByLocation[loc] || [];
  const pAvg = Math.round(here
    .filter(r => (get(r,"Type")||"").toLowerCase().includes("pellet"))
    .map(r => extractSeries(r).W).filter(v=>v>0)
    .reduce((a,b)=>a+b,0) / Math.max(1, here.filter(r => (get(r,"Type")||"").toLowerCase().includes("pellet")).length));

  const bAvg = Math.round(here
    .filter(r => (get(r,"Type")||"").toLowerCase().includes("briq"))
    .map(r => extractSeries(r).W).filter(v=>v>0)
    .reduce((a,b)=>a+b,0) / Math.max(1, here.filter(r => (get(r,"Type")||"").toLowerCase().includes("briq")).length));

  return { pelletAvg: isFinite(pAvg)?pAvg:0, briqAvg: isFinite(bAvg)?bAvg:0 };
}

function bindFreight(loc) {
  const form = document.getElementById("freightForm");
  const out = document.getElementById("freightResult");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const km = parseFloat(document.getElementById("freightDistance").value);
    const tons = parseFloat(document.getElementById("freightTons").value);
    const kind = document.getElementById("freightFuelKind").value;

    if (!isFinite(km) || !isFinite(tons) || km <= 0 || tons <= 0) {
      out.textContent = "Please enter valid distance and quantity.";
      return;
    }

    const { pelletAvg, briqAvg } = calcLanded(loc);
    const base = kind === "pellet" ? pelletAvg : briqAvg;
    if (!base) {
      out.textContent = "Base price unavailable for this location.";
      return;
    }

    const freight = Math.round(km * tons * FREIGHT_RATE_PER_TKM);
    const landedPerTon = Math.round(base + (freight / tons));

    out.innerHTML = `
      Base: ₹${fmtIN(base)}/t • Freight: ₹${fmtIN(freight)} •
      <strong>Landed ≈ ₹${fmtIN(landedPerTon)}/t</strong>`;
  });
}

// ===== MAIN FLOW =====
async function init() {
  const res = await fetch(API_URL);
  rows = await res.json();

  // Index by location (State)
  rowsByLocation = {};
  rows.forEach(r => {
    const st = (get(r,"State") || "AVERAGE").trim();
    rowsByLocation[st] = rowsByLocation[st] || [];
    rowsByLocation[st].push(r);
    const t = (get(r,"Type") || "").toLowerCase();
    if (t.includes("pellet")) pelletTypes.add(get(r,"Type"));
    if (t.includes("briq"))   briqTypes.add(get(r,"Type"));
  });

  // Build location list (AVERAGE first if present)
  const locations = Object.keys(rowsByLocation).sort((a,b) => a.localeCompare(b));
  const idxAverage = locations.indexOf("AVERAGE");
  if (idxAverage > 0) { locations.splice(idxAverage,1); locations.unshift("AVERAGE"); }

  // Populate selects
  const locSel = document.getElementById("locationSelect");
  fillSelect(locSel, locations);

  // Set defaults
  const defaultLoc = "AVERAGE";
  locSel.value = locations.includes(defaultLoc) ? defaultLoc : locations[0];

  buildSelectors(locSel.value);
  buildTables(locSel.value);
  renderSnapshot(locSel.value);
  drawCharts(locSel.value);
  bindFreight(locSel.value);

  // events
  locSel.addEventListener("change", () => {
    buildSelectors(locSel.value);
    buildTables(locSel.value);
    renderSnapshot(locSel.value);
    drawCharts(locSel.value);
    // rebind freight with new location baseline
    document.getElementById("freightForm").replaceWith(document.getElementById("freightForm").cloneNode(true));
    bindFreight(locSel.value);
  });
  document.getElementById("materialSelect").addEventListener("change", () => drawCharts(locSel.value));
  document.getElementById("briquetteSelect").addEventListener("change", () => drawCharts(locSel.value));
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("Market init error", err);
    alert("Failed to load market data. Please retry.");
  });
});