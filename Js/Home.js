// Home page data + charts + insights (AVERAGE by default, no dropdown)
const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";

let sheetData = [];
let pelletChartInstance = null;
let briquetteChartInstance = null;

const fmtINR = (n) => isFinite(n) ? Number(n).toLocaleString("en-IN") : "--";
const toNum = (x) => {
  if (x == null) return NaN;
  const s = String(x).replace(/,/g, "").trim();
  const n = Number(s);
  return isFinite(n) ? n : NaN;
};

// Fetch & boot
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch(API_URL);
    sheetData = await res.json();

    // expose for any helper scripts (optional)
    window.sheetData = sheetData;

    // Stamp "last verified"
    const lastVerifiedEl = document.getElementById("lastVerified");
    if (lastVerifiedEl) {
      const now = new Date();
      lastVerifiedEl.textContent = now.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }

    // Start ticker
    startTicker();

    // Populate prices + charts for AVERAGE
    renderAveragePrices();
    drawCharts("AVERAGE");

    // Build Top 3 cheapest (Pellet)
    renderTopCheapestPellet();
  } catch (e) {
    console.error("Home: fetch error", e);
  }
});

function startTicker() {
  const ticker = document.getElementById("verifiedTicker");
  if (!ticker) return;
  const msgs = [
    "Tracking cluster-level moves",
    "Watching diesel & lane effects",
    "Verifying submissions",
    "Sourcing signals from multiple clusters"
  ];
  let i = 0;
  ticker.textContent = msgs[i];
  setInterval(() => { i = (i + 1) % msgs.length; ticker.textContent = msgs[i]; }, 2500);
}

function renderAveragePrices() {
  const pelletEl = document.getElementById("pelletPrice");
  const briqEl = document.getElementById("briquettePrice");

  // Prefer explicit AVERAGE rows; else compute weighted simple mean across states.
  const pelletAvgRow = sheetData.find(r => (r.State || "").trim().toUpperCase() === "AVERAGE" && (r.Type || "").toLowerCase() === "pellet");
  const briqAvgRow   = sheetData.find(r => (r.State || "").trim().toUpperCase() === "AVERAGE" && (r.Type || "").toLowerCase() === "briquette");

  let pelletPrice = toNum(pelletAvgRow?.Price);
  let briqPrice   = toNum(briqAvgRow?.Price);

  if (!isFinite(pelletPrice)) {
    const pellets = sheetData.filter(r => (r.Type || "").toLowerCase() === "pellet" && (r.State || "").trim().toUpperCase() !== "AVERAGE")
      .map(r => toNum(r.Price)).filter(Number.isFinite);
    pelletPrice = pellets.length ? Math.round(pellets.reduce((a,b)=>a+b,0) / pellets.length) : NaN;
  }
  if (!isFinite(briqPrice)) {
    const briqs = sheetData.filter(r => (r.Type || "").toLowerCase() === "briquette" && (r.State || "").trim().toUpperCase() !== "AVERAGE")
      .map(r => toNum(r.Price)).filter(Number.isFinite);
    briqPrice = briqs.length ? Math.round(briqs.reduce((a,b)=>a+b,0) / briqs.length) : NaN;
  }

  if (pelletEl) pelletEl.textContent = fmtINR(pelletPrice);
  if (briqEl) briqEl.textContent = fmtINR(briqPrice);
}

function drawCharts(location /* "AVERAGE" */) {
  const labels = ["Year", "6 Months", "Month", "Week"];

  // Helper to get a row by location + type
  const getRow = (type) => sheetData.find(r =>
    (r.State || "").trim().toUpperCase() === String(location).toUpperCase() &&
    (r.Type || "").trim().toLowerCase() === type
  );

  // Prefer explicit AVERAGE rows; fallback: median of states for each bucket
  const pelletRow = getRow("pellet");
  const briqRow   = getRow("briquette");

  const extractSeries = (row, type) => {
    if (row) {
      return [
        toNum(row.Year),
        toNum(row["6 Month"]) || toNum(row["6 Months"]) || toNum(row["6mo"]),
        toNum(row.Month),
        toNum(row.Week)
      ].map(v => (isFinite(v) ? v : 0));
    }
    // fallback across states if AVERAGE row missing
    const rows = sheetData.filter(r => (r.Type || "").trim().toLowerCase() === type && (r.State || "").trim().toUpperCase() !== "AVERAGE");
    const pick = (keyList) => {
      const vals = rows.map(r => {
        for (const k of keyList) {
          const v = toNum(r[k]);
          if (isFinite(v)) return v;
        }
        return NaN;
      }).filter(Number.isFinite);
      if (!vals.length) return 0;
      vals.sort((a,b)=>a-b);
      return vals[Math.floor(vals.length/2)]; // median
    };
    return [
      pick(["Year"]),
      pick(["6 Month","6 Months","6mo"]),
      pick(["Month"]),
      pick(["Week"])
    ];
  };

  const pelletValues = extractSeries(pelletRow, "pellet");
  const briqValues   = extractSeries(briqRow, "briquette");

  // Destroy old
  if (pelletChartInstance) pelletChartInstance.destroy();
  if (briquetteChartInstance) briquetteChartInstance.destroy();

  const bounds = (arr) => {
    const finite = arr.filter(Number.isFinite);
    if (!finite.length) return { min: 0, max: 100 };
    const min = Math.min(...finite), max = Math.max(...finite);
    return { min: Math.floor(min * 0.95), max: Math.ceil(max * 1.05) };
  };
  const pb = bounds(pelletValues), bb = bounds(briqValues);

  const baseOptions = (suggestedMin, suggestedMax) => ({
    type: "line",
    options: {
      responsive: true,
      maintainAspectRatio: false,
      elements: { line: { tension: 0.3, borderWidth: 2 }, point: { radius: 4 } },
      scales: {
        y: {
          suggestedMin, suggestedMax,
          ticks: { callback: v => `₹${Number(v).toLocaleString("en-IN")}` },
          grid: { color: "rgba(28,61,90,0.08)" }
        },
        x: { grid: { color: "rgba(28,61,90,0.06)" } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton` }
        }
      }
    }
  });

  pelletChartInstance = new Chart(document.getElementById("pelletChart"), {
    ...baseOptions(pb.min, pb.max),
    data: {
      labels,
      datasets: [{
        label: "Pellet Price",
        data: pelletValues,
        borderColor: "#1C3D5A",
        backgroundColor: "rgba(29,61,89,0.12)",
        fill: false
      }]
    }
  });

  briquetteChartInstance = new Chart(document.getElementById("briquetteChart"), {
    ...baseOptions(bb.min, bb.max),
    data: {
      labels,
      datasets: [{
        label: "Briquette Price",
        data: briqValues,
        borderColor: "#FFA500",
        backgroundColor: "rgba(255,165,0,0.12)",
        fill: false
      }]
    }
  });
}

function renderTopCheapestPellet() {
  const ul = document.getElementById("cheapestList");
  if (!ul) return;

  const pellets = sheetData
    .filter(r => (r.Type || "").toLowerCase().trim() === "pellet")
    .map(r => {
      const state = (r.State || "").trim();
      const price = toNum(r.Price);
      return { state, price };
    })
    .filter(x => x.state && x.state.toUpperCase() !== "AVERAGE" && isFinite(x.price));

  // Min price per state
  const perStateMin = pellets.reduce((acc, r) => {
    acc[r.state] = Math.min(acc[r.state] ?? Infinity, r.price);
    return acc;
  }, {});

  const top3 = Object.entries(perStateMin)
    .sort((a,b) => a[1] - b[1])
    .slice(0, 3);

  ul.innerHTML = top3.length
    ? top3.map(([state, price], i) => `
        <li>
          <span class="rank">${i + 1}</span>
          <span class="state">${state}</span>
          <span class="price">₹${price.toLocaleString("en-IN")}/ton</span>
        </li>
      `).join("")
    : `<li class="muted">Not enough data yet.</li>`;
}