// =========================
// CONFIG
// =========================
// Use your Google Sheet (SheetBest) endpoint for the market data.
// If it's same as Home, you can reuse it. Otherwise replace below:
const MARKET_API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";

// Expected columns (case-insensitive safe):
// State, District (optional), Cluster (optional), Type ("Pellet"/"Briquette"),
// Material (optional), Price, Week, Month, "6 Month" or "6mo", Year,
// LastDeal (optional), UpdatedAt (optional), Supplier, Rating (optional),
// CertURL (optional), CertDate (optional).

let rows = [];
let charts = { pellet: null, briq: null };

const $ = (id) => document.getElementById(id);

const toNum = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/[,₹\s]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};
const fmt = (n) => Number(n).toLocaleString("en-IN");

// Try to read value from alternative header names
const col = (r, ...names) => {
  for (const name of names) {
    if (r[name] !== undefined && r[name] !== "") return r[name];
  }
  return undefined;
};

async function load() {
  try {
    const res = await fetch(MARKET_API_URL);
    rows = await res.json();

    buildLocationSelect();
    buildMaterialSelects();
    bindFreightCalc();
    computeIndex();
    computeAlerts();

    // Defaults
    const defaultState = findAvailableDefault("AVERAGE");
    $("locationSelect").value = defaultState;
    updateAll(defaultState);

    // Events
    $("locationSelect").addEventListener("change", () => {
      updateAll($("locationSelect").value);
    });
    $("materialSelect").addEventListener("change", () => {
      updatePelletChart($("locationSelect").value);
    });
    $("briquetteSelect").addEventListener("change", () => {
      updateBriquetteChart($("locationSelect").value);
    });

    // Optional sections
    buildSuppliers();
    buildCertificates();

  } catch (e) {
    console.error("Market load failed:", e);
  }
}

function findAvailableDefault(preferred) {
  const states = Array.from(
    new Set(rows.map(r => (r.State || "").trim()).filter(Boolean))
  );
  if (states.includes(preferred)) return preferred;
  return states[0] || "AVERAGE";
}

function buildLocationSelect() {
  const sel = $("locationSelect");
  sel.innerHTML = "";
  const states = Array.from(
    new Set(rows.map(r => (r.State || "").trim()).filter(Boolean))
  ).sort((a,b) => a.localeCompare(b));
  states.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });
}

function buildMaterialSelects() {
  const pelletMats = Array.from(
    new Set(rows.filter(r => String(r.Type).toLowerCase() === "pellet")
      .map(r => (r.Material || "Pellet").trim()))
  ).sort();

  const briqMats = Array.from(
    new Set(rows.filter(r => String(r.Type).toLowerCase() === "briquette")
      .map(r => (r.Material || "Briquette").trim()))
  ).sort();

  const ms = $("materialSelect");
  ms.innerHTML = "";
  pelletMats.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    ms.appendChild(opt);
  });

  const bs = $("briquetteSelect");
  bs.innerHTML = "";
  briqMats.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    bs.appendChild(opt);
  });
}

function updateAll(state) {
  updateLiveKpis(state);
  buildTables(state);
  updatePelletChart(state);
  updateBriquetteChart(state);
}

function selectRows(state, type) {
  return rows.filter(r =>
    String(r.State || "").trim() === state &&
    String(r.Type || "").toLowerCase() === type
  );
}

function latestNumbers(row) {
  // Returns timeline in order: Year, 6mo, Month, Week
  const yr = toNum(col(row, "Year", "year"));
  const six = toNum(col(row, "6 Month", "6month", "6mo", "SixMonth"));
  const mon = toNum(col(row, "Month", "month"));
  const wk = toNum(col(row, "Week", "week"));
  return [yr, six, mon, wk];
}

function updateLiveKpis(state) {
  const pelletRow = selectRows(state, "pellet")[0];
  const briqRow   = selectRows(state, "briquette")[0];

  const pelletPrice = pelletRow ? toNum(col(pelletRow, "Price")) : 0;
  const briqPrice   = briqRow   ? toNum(col(briqRow, "Price"))   : 0;

  $("pelletPriceLive").textContent    = pelletPrice ? fmt(pelletPrice) : "--";
  $("briquettePriceLive").textContent = briqPrice   ? fmt(briqPrice)   : "--";

  $("pelletLastDeal").textContent    = pelletRow ? fmt(toNum(col(pelletRow, "LastDeal", "Last Deal"))) : "--";
  $("briquetteLastDeal").textContent = briqRow   ? fmt(toNum(col(briqRow, "LastDeal", "Last Deal")))   : "--";

  // Trend vs last month
  const [ , , monP, wkP ] = pelletRow ? latestNumbers(pelletRow) : [0,0,0,0];
  const [ , , monB, wkB ] = briqRow   ? latestNumbers(briqRow)   : [0,0,0,0];

  setTrend("pelletTrend", wkP, monP);
  setTrend("briquetteTrend", wkB, monB);

  // Confidence = coverage % (rows in state vs total materials*2)
  const materialsCount = new Set(rows.map(r => `${r.State}-${r.Type}`)).size;
  const stateCount = rows.filter(r => String(r.State).trim() === state).length;
  const conf = Math.max(10, Math.min(100, Math.round((stateCount / Math.max(1, materialsCount)) * 100)));
  $("confidenceText").textContent = `${conf}%`;
  $("confidenceFill").style.width = `${conf}%`;
  $("lastUpdated").textContent = pelletRow?.UpdatedAt || briqRow?.UpdatedAt || new Date().toLocaleDateString("en-IN");

}

function setTrend(id, now, prev) {
  const el = $(id);
  const diff = now - prev;
  if (!now || !prev) {
    el.textContent = "—";
    el.className = "trend neutral";
    return;
  }
  const pct = (diff / prev) * 100;
  el.textContent = `${diff > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
  el.className = `trend ${diff > 0 ? "up" : "down"}`;
}

function buildTables(state) {
  // Pellet table
  const pelletRows = rows.filter(r =>
    String(r.State || "").trim() === state &&
    String(r.Type || "").toLowerCase() === "pellet"
  );

  const briqRows = rows.filter(r =>
    String(r.State || "").trim() === state &&
    String(r.Type || "").toLowerCase() === "briquette"
  );

  const build = (data) => {
    if (!data.length) return "<tr><td>No data</td></tr>";
    const headers = ["Material", "Price", "Week", "Month", "6 Month", "Year"];
    const th = `<tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr>`;
    const trs = data.map(r => {
      const material = (r.Material || (r.Type || "")).toString();
      const [yr, six, mon, wk] = latestNumbers(r);
      const price = toNum(r.Price) || wk || mon || six || yr || 0;
      return `<tr>
        <td>${material}</td>
        <td>₹${fmt(price)}</td>
        <td>${wk ? `₹${fmt(wk)}` : "—"}</td>
        <td>${mon ? `₹${fmt(mon)}` : "—"}</td>
        <td>${six ? `₹${fmt(six)}` : "—"}</td>
        <td>${yr ? `₹${fmt(yr)}` : "—"}</td>
      </tr>`;
    }).join("");
    return th + trs;
  };

  $("materialTable").innerHTML = build(pelletRows);
  $("briquetteTable").innerHTML = build(briqRows);
}

function updatePelletChart(state) {
  const mat = $("materialSelect").value;
  const row = rows.find(r =>
    String(r.State || "").trim() === state &&
    String(r.Type || "").toLowerCase() === "pellet" &&
    String(r.Material || "Pellet").trim() === mat
  );
  drawLineChart("priceChart", "pellet", row, "pelletTimestamp", "pelletForecast");
}

function updateBriquetteChart(state) {
  const mat = $("briquetteSelect").value;
  const row = rows.find(r =>
    String(r.State || "").trim() === state &&
    String(r.Type || "").toLowerCase() === "briquette" &&
    String(r.Material || "Briquette").trim() === mat
  );
  drawLineChart("briquetteChart", "briq", row, "briquetteTimestamp", "briquetteForecast");
}

function drawLineChart(canvasId, key, row, tsId, fcId) {
  if (charts[key]) charts[key].destroy();

  const labels = ["Year", "6 Months", "Month", "Week"];
  const [yr, six, mon, wk] = row ? latestNumbers(row) : [0,0,0,0];
  const data = [yr, six, mon, wk];

  const ctx = $(canvasId).getContext("2d");
  charts[key] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "₹/ton",
        data,
        borderColor: key === "pellet" ? "#1C3D5A" : "#FFA500",
        backgroundColor: "transparent",
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: v => `₹${Number(v).toLocaleString("en-IN")}`
          }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  // Timestamp
  $(tsId).textContent = row?.UpdatedAt || new Date().toLocaleDateString("en-IN");

  // 7‑day forecast (simple slope from Month->Week)
  const slope = (wk && mon) ? (wk - mon) / 30 : 0;
  const day7 = wk ? Math.round(wk + slope * 7) : 0;
  $(fcId).textContent = day7 ? `₹${fmt(day7)}` : "—";
}

function computeIndex() {
  // Peltra Biomass Index = weighted avg of current Week (or Price) across all rows
  const values = rows.map(r => {
    const [ , , mon, wk] = latestNumbers(r);
    return wk || toNum(r.Price) || mon || 0;
  }).filter(v => v > 0);

  if (!values.length) return;
  const avg = Math.round(values.reduce((a,b) => a+b, 0) / values.length);
  $("peltraIndex").textContent = fmt(avg);

  // Delta vs previous (Month)
  const months = rows.map(r => {
    const [ , , mon ] = latestNumbers(r);
    return mon || 0;
  }).filter(v => v > 0);

  if (!months.length) {
    $("peltraIndexDelta").textContent = "—";
    $("peltraIndexDelta").className = "trend neutral";
    return;
  }
  const mAvg = Math.round(months.reduce((a,b)=>a+b,0) / months.length);
  const diff = avg - mAvg;
  const pct = mAvg ? (diff / mAvg) * 100 : 0;
  $("peltraIndexDelta").textContent = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
  $("peltraIndexDelta").className = `trend ${diff >= 0 ? "up" : "down"}`;
}

function computeAlerts() {
  // Best Buy = min pellet Week/Price; Best Sell = max briquette Week/Price
  const pellets = rows.filter(r => String(r.Type).toLowerCase() === "pellet")
    .map(r => ({ state: (r.State||"").trim(), price: currentPrice(r) }))
    .filter(x => x.state && x.price > 0);
  const briqs = rows.filter(r => String(r.Type).toLowerCase() === "briquette")
    .map(r => ({ state: (r.State||"").trim(), price: currentPrice(r) }))
    .filter(x => x.state && x.price > 0);

  if (pellets.length) {
    const bestBuy = pellets.reduce((a,b)=> a.price < b.price ? a : b);
    $("bestBuyPrice").textContent = fmt(bestBuy.price);
    $("bestBuyState").textContent = bestBuy.state;
  }
  if (briqs.length) {
    const bestSell = briqs.reduce((a,b)=> a.price > b.price ? a : b);
    $("bestSellPrice").textContent = fmt(bestSell.price);
    $("bestSellState").textContent = bestSell.state;
  }

  $("ctaBestBuy").addEventListener("click", () => alert("Rate lock request sent to Peltra."));
  $("ctaBestSell").addEventListener("click", () => alert("Sell request sent to Peltra."));
}

function currentPrice(r) {
  const [ , , mon, wk ] = latestNumbers(r);
  return toNum(r.Price) || wk || mon || 0;
}

function bindFreightCalc() {
  $("fcCalc").addEventListener("click", () => {
    const km = toNum($("fcDistance").value);
    const tons = toNum($("fcTonnage").value);
    const rate = toNum($("fcRate").value);
    if (!km || !tons || !rate) {
      $("fcResult").textContent = "0";
      return;
    }
    // Simple: truck runs per km * rate (assumes full-truck cost spread by load)
    const total = Math.round(km * rate);
    $("fcResult").textContent = fmt(total);
  });
}

function buildSuppliers() {
  // If your sheet has Supplier / State / Rating columns, show a table
  const suppliers = rows
    .map(r => ({
      supplier: (r.Supplier || "").trim(),
      state: (r.State || "").trim(),
      rating: (r.Rating || "").toString().trim()
    }))
    .filter(s => s.supplier && s.state);

  if (!suppliers.length) return;

  const table = $("supplierTable");
  table.innerHTML = `
    <tr><th>Supplier</th><th>State</th><th>Credibility</th></tr>
    ${suppliers.slice(0, 50).map(s => `
      <tr>
        <td>${s.supplier}</td>
        <td>${s.state}</td>
        <td>${s.rating || "—"}</td>
      </tr>
    `).join("")}
  `;
  $("supplierSection").hidden = false;
}

function buildCertificates() {
  // If your sheet has CertURL / CertDate / State / Type / Material, list recent certs
  const certs = rows
    .map(r => ({
      url: (r.CertURL || r.Certificate || "").trim(),
      date: (r.CertDate || "").trim(),
      state: (r.State || "").trim(),
      type: (r.Type || "").trim(),
      material: (r.Material || "").trim()
    }))
    .filter(c => c.url);

  if (!certs.length) return;

  const table = $("certTable");
  table.innerHTML = `
    <tr><th>Date</th><th>State</th><th>Type</th><th>Material</th><th>Certificate</th></tr>
    ${certs.slice(0, 50).map(c => `
      <tr>
        <td>${c.date || "—"}</td>
        <td>${c.state || "—"}</td>
        <td>${c.type || "—"}</td>
        <td>${c.material || "—"}</td>
        <td><a href="${c.url}" target="_blank" rel="noopener">View</a></td>
      </tr>
    `).join("")}
  `;
  $("certSection").hidden = false;
}

document.addEventListener("DOMContentLoaded", load);