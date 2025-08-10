// Home.js — material-aware homepage
// Uses the same sheet as Market to get per-material prices & trends
const API_URL = "https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf";

let sheetData = [];
let dataset = {}; // { [location]: { materials: { pellets: { [material]: {price,trend}}, briquettes:{...} } } }
let pelletChartInstance = null;
let briquetteChartInstance = null;

// DOM refs
let locationSelect, pelletMaterialSelect, briquetteMaterialSelect;

function inr(n) {
  if (n == null || isNaN(n)) return "--";
  return Number(n).toLocaleString("en-IN");
}

async function loadData() {
  const res = await fetch(API_URL);
  sheetData = await res.json();

  dataset = {};
  for (const row of sheetData) {
    const location = row.State?.trim();
    const material = row.Material?.trim();
    const typeRaw = row.Type?.trim()?.toLowerCase();
    if (!location || !material || !typeRaw) continue;

    // Build {price, trend}
    const price = parseInt(String(row.Week || "").replace(/,/g, "")) || null;
    const trend = [
      parseInt(row.Year) || 0,
      parseInt(row["6 Month"]) || 0,
      parseInt(row.Month) || 0,
      parseInt(row.Week) || 0
    ];

    if (!dataset[location]) {
      dataset[location] = { materials: { pellets: {}, briquettes: {} } };
    }

    if (typeRaw.includes("pellet")) {
      dataset[location].materials.pellets[material] = { price, trend };
    } else {
      dataset[location].materials.briquettes[material] = { price, trend };
    }
  }
}

function populateLocationDropdown() {
  // Exclude "GLOBAL"
  const locations = Object.keys(dataset).filter(l => l && l.toUpperCase() !== "GLOBAL").sort();
  locationSelect.innerHTML = locations.map(l => `<option value="${l}">${l}</option>`).join("");
  if (locations.length) locationSelect.value = locations[0];
}

function populateMaterialDropdowns(loc) {
  const pellets = Object.keys(dataset[loc]?.materials?.pellets || {}).sort();
  const briqs   = Object.keys(dataset[loc]?.materials?.briquettes || {}).sort();

  pelletMaterialSelect.innerHTML = pellets.map(m => `<option value="${m}">${m}</option>`).join("");
  briquetteMaterialSelect.innerHTML = briqs.map(m => `<option value="${m}">${m}</option>`).join("");

  if (pellets.length) pelletMaterialSelect.value = pellets[0];
  if (briqs.length)   briquetteMaterialSelect.value = briqs[0];
}

function setTopPrices(loc, pelletMat, briqMat) {
  const pelletObj = dataset[loc]?.materials?.pellets?.[pelletMat];
  const briqObj   = dataset[loc]?.materials?.briquettes?.[briqMat];

  // Price shown = latest (Week) value
  document.getElementById("pelletPrice").textContent    = inr(pelletObj?.price);
  document.getElementById("briquettePrice").textContent = inr(briqObj?.price);
}

function destroyCharts() {
  if (pelletChartInstance) { pelletChartInstance.destroy(); pelletChartInstance = null; }
  if (briquetteChartInstance) { briquetteChartInstance.destroy(); briquetteChartInstance = null; }
}

function makeLineChart(canvasId, label, values, borderColor) {
  const labels = ["Year", "6 Months", "Month", "Week"];
  const min = Math.min(...values);
  const max = Math.max(...values);

  return new Chart(document.getElementById(canvasId), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data: values,
        borderColor,
        backgroundColor: "rgba(0,0,0,0)", // transparent fill
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `₹${ctx.parsed.y.toLocaleString("en-IN")}/ton`
          }
        }
      },
      scales: {
        y: {
          suggestedMin: Math.floor(min * 0.95),
          suggestedMax: Math.ceil(max * 1.05),
          ticks: {
            callback: v => `₹${Number(v).toLocaleString("en-IN")}`
          }
        }
      }
    }
  });
}

function refreshCharts(loc, pelletMat, briqMat) {
  const pelletTrend = dataset[loc]?.materials?.pellets?.[pelletMat]?.trend || [0,0,0,0];
  const briqTrend   = dataset[loc]?.materials?.briquettes?.[briqMat]?.trend || [0,0,0,0];

  destroyCharts();
  pelletChartInstance   = makeLineChart("pelletChart",   `${pelletMat} (Pellet)`,    pelletTrend, "#1C3D5A");
  briquetteChartInstance= makeLineChart("briquetteChart",`${briqMat} (Briquette)`,   briqTrend,   "#FFA500");
}

function applySelections() {
  const loc = locationSelect.value;
  // ensure materials are selected (could be empty after a location change)
  if (!pelletMaterialSelect.value) {
    const first = pelletMaterialSelect.querySelector("option")?.value;
    if (first) pelletMaterialSelect.value = first;
  }
  if (!briquetteMaterialSelect.value) {
    const first = briquetteMaterialSelect.querySelector("option")?.value;
    if (first) briquetteMaterialSelect.value = first;
  }

  const pelletMat = pelletMaterialSelect.value;
  const briqMat   = briquetteMaterialSelect.value;

  setTopPrices(loc, pelletMat, briqMat);
  refreshCharts(loc, pelletMat, briqMat);
}

async function init() {
  locationSelect = document.getElementById("locationSelect");
  pelletMaterialSelect = document.getElementById("pelletMaterialSelect");
  briquetteMaterialSelect = document.getElementById("briquetteMaterialSelect");

  await loadData();
  populateLocationDropdown();

  const currentLoc = locationSelect.value;
  populateMaterialDropdowns(currentLoc);
  applySelections();

  // events
  locationSelect.addEventListener("change", () => {
    populateMaterialDropdowns(locationSelect.value);
    applySelections();
  });
  pelletMaterialSelect.addEventListener("change", applySelections);
  briquetteMaterialSelect.addEventListener("change", applySelections);
}

document.addEventListener("DOMContentLoaded", init);