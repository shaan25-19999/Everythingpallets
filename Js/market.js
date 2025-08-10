/* ===========================
   Peltra Market Command Center
   =========================== */

const MARKET_JSON = "data/Market-price.json";
const NEWS_JSON = "data/News.json";

let rawData = [];         // full market rows
let states = [];          // unique state list
let currentState = "AVERAGE";
let currentMaterial = "Pellet"; // or "Briquette"

let pelletChart, briquetteChart;

/* ---------- DOM ---------- */
const el = (id) => document.getElementById(id);

const stateSelect       = el("stateSelect");
const exPriceEl         = el("exPrice");
const landedPriceEl     = el("landedPrice");
const lastDealEl        = el("lastDeal");
const confValEl         = el("confVal");
const confBarEl         = el("confBar");
const lastUpdatedEl     = el("lastUpdated");

const bestBuyStateEl    = el("bestBuyState");
const bestBuyPriceEl    = el("bestBuyPrice");
const bestSellStateEl   = el("bestSellState");
const bestSellPriceEl   = el("bestSellPrice");
const ctaBestBuy        = el("ctaBestBuy");
const ctaBestSell       = el("ctaBestSell");

// Freight form
const freightForm       = el("freightForm");
const distanceKmEl      = el("distanceKm");
const tonnageEl         = el("tonnage");
const ratePerKmEl       = el("ratePerKm");

// Charts
const pelletChartCanvas    = el("pelletChart");
const briquetteChartCanvas = el("briquetteChart");

// Policy/news feed
const policyFeed = el("policyFeed");

// Modals
const rateLockBtn  = el("rateLockBtn");
const listStockBtn = el("listStockBtn");
const rateLockModal  = el("rateLockModal");
const listStockModal = el("listStockModal");

/* ---------- Utils ---------- */
const fmtINR = (n) => isFinite(n) ? Number(n).toLocaleString("en-IN") : "--";
const toNum  = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/[, ]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : NaN;
};
const norm = (s) => (s || "").toString().trim().toUpperCase();

/* Robust getters for potentially different column names */
function getField(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  }
  return undefined;
}

/* ---------- Data Load ---------- */
async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

async function init() {
  try {
    [rawData, newsData] = await Promise.all([
      loadJSON(MARKET_JSON),
      loadJSON(NEWS_JSON).catch(() => [])
    ]);
  } catch (err) {
    console.error("Load error:", err);
    return;
  }

  // Build state list (unique, sorted, keep AVERAGE on top if present)
  const set = new Set(
    rawData
      .map(r => norm(getField(r, "State", "Location", "Region")))
      .filter(Boolean)
  );
  states = Array.from(set).sort();
  if (states.includes("AVERAGE")) {
    states = ["AVERAGE", ...states.filter(s => s !== "AVERAGE")];
  }

  // Populate state select
  stateSelect.innerHTML = "";
  states.forEach(st => {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = st;
    stateSelect.appendChild(opt);
  });
  if (states.includes("AVERAGE")) {
    stateSelect.value = "AVERAGE";
    currentState = "AVERAGE";
  } else {
    stateSelect.selectedIndex = 0;
    currentState = stateSelect.value;
  }

  // Material segmented control
  document.querySelectorAll(".segmented .seg").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".segmented .seg").forEach(b => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      currentMaterial = btn.dataset.material || "Pellet";
      renderAll();
    });
  });

  // Change events
  stateSelect.addEventListener("change", () => {
    currentState = stateSelect.value;
    renderAll();
  });

  // Freight calc
  freightForm.addEventListener("submit", (e) => {
    e.preventDefault();
    computeLanded();
  });

  // CTAs
  ctaBestBuy.addEventListener("click", () => openModal(rateLockModal));
  ctaBestSell.addEventListener("click", () => openModal(listStockModal));
  rateLockBtn.addEventListener("click", () => openModal(rateLockModal));
  listStockBtn.addEventListener("click", () => openModal(listStockModal));
  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      closeModal(e.target.closest(".modal"));
    });
  });

  // Modal forms → for now just log; wire to API/WhatsApp later
  document.getElementById("rateLockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      company: document.getElementById("rlCompany").value.trim(),
      qtyTons: Number(document.getElementById("rlQty").value),
      location: document.getElementById("rlLoc").value.trim(),
      material: currentMaterial,
      state: currentState
    };
    console.log("RateLock Request:", payload);
    alert("Thanks! We’ll call you back shortly.");
    closeModal(rateLockModal);
    e.target.reset();
  });

  document.getElementById("listStockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const payload = {
      factory: document.getElementById("lsFactory").value.trim(),
      material: document.getElementById("lsMaterial").value,
      qtyTons: Number(document.getElementById("lsQty").value),
      location: document.getElementById("lsLoc").value.trim()
    };
    console.log("List Stock:", payload);
    alert("Thanks! We’ll get in touch to verify and list your stock.");
    closeModal(listStockModal);
    e.target.reset();
  });

  // Initial render
  renderAll();

  // Policy/news feed
  renderNews(newsData || []);
}

/* ---------- Rendering Pipeline ---------- */
function renderAll() {
  const nowRow = pickRow(currentState, currentMaterial);
  renderSummary(nowRow);
  renderBestCards(currentMaterial);
  renderCharts(currentState); // both charts (Pellet & Briquette) for current state
}

/* Get first matching row for state+material */
function pickRow(state, material) {
  const s = norm(state);
  const m = norm(material);
  return rawData.find(r =>
    norm(getField(r, "State", "Location", "Region")) === s &&
    norm(getField(r, "Type", "Material")) === m
  );
}

/* Get all rows for material to compute best buy/sell */
function rowsForMaterial(material) {
  const m = norm(material);
  return rawData.filter(r => norm(getField(r, "Type", "Material")) === m);
}

/* Summary (Ex yard, last deal, confidence, updated) */
function renderSummary(row) {
  const exPrice = toNum(getField(row || {}, "Price", "ExPrice", "Ex_Yard"));
  exPriceEl.textContent = fmtINR(exPrice);

  const lastDeal = toNum(getField(row || {}, "LastDeal", "Last_Deal", "Last"));
  lastDealEl.textContent = isFinite(lastDeal) ? `Last deal: ₹${fmtINR(lastDeal)}/ton` : "Last deal: --";

  const conf = toNum(getField(row || {}, "Confidence", "ConfidencePct", "Confidence_%"));
  const confPct = isFinite(conf) ? Math.max(0, Math.min(100, conf)) : 50;
  confValEl.textContent = `${confPct}%`;
  confBarEl.style.width = `${confPct}%`;

  const updatedAt = getField(row || {}, "UpdatedAt", "Timestamp", "Updated", "Date");
  lastUpdatedEl.textContent = `Last updated: ${updatedAt || "--"}`;

  // reset landed estimate until user computes with freight
  landedPriceEl.textContent = "--";
}

/* Best Buy / Best Sell cards */
function renderBestCards(material) {
  const rows = rowsForMaterial(material)
    .map(r => ({
      state: norm(getField(r, "State", "Location", "Region")),
      price: toNum(getField(r, "Price", "ExPrice", "Ex_Yard"))
    }))
    .filter(x => x.state && isFinite(x.price));

  if (!rows.length) {
    bestBuyStateEl.textContent = bestSellStateEl.textContent = "--";
    bestBuyPriceEl.textContent = bestSellPriceEl.textContent = "--";
    return;
  }
  const bestBuy = rows.reduce((min, x) => (x.price < min.price ? x : min), rows[0]);
  const bestSell = rows.reduce((max, x) => (x.price > max.price ? x : max), rows[0]);

  bestBuyStateEl.textContent  = titleState(bestBuy.state);
  bestBuyPriceEl.textContent  = fmtINR(bestBuy.price);
  bestSellStateEl.textContent = titleState(bestSell.state);
  bestSellPriceEl.textContent = fmtINR(bestSell.price);
}

function titleState(s) {
  return s === "AVERAGE" ? "Average" : s[0] + s.slice(1).toLowerCase();
}

/* Freight calculator → landed per ton = exPrice + (distance*rate)/tonnage */
function computeLanded() {
  const row = pickRow(currentState, currentMaterial);
  const exPrice = toNum(getField(row || {}, "Price", "ExPrice", "Ex_Yard"));

  const km   = toNum(distanceKmEl.value);
  const tons = toNum(tonnageEl.value);
  const rate = toNum(ratePerKmEl.value); // ₹ per km (truck)

  if (!isFinite(exPrice) || !isFinite(km) || !isFinite(tons) || tons <= 0 || !isFinite(rate)) {
    landedPriceEl.textContent = "--";
    return;
  }
  const freightPerTon = (km * rate) / tons; // ₹/ton
  const landed = exPrice + freightPerTon;
  landedPriceEl.textContent = fmtINR(Math.round(landed));
}

/* Charts for current state: left = Pellet, right = Briquette */
function renderCharts(state) {
  const pelletRow    = pickRow(state, "Pellet");
  const briquetteRow = pickRow(state, "Briquette");

  const labels = ["Year", "6 Months", "Month", "Week"];

  const extractSeries = (row) => {
    if (!row) return [0,0,0,0];
    const year = toNum(getField(row, "Year", "Y"));
    const six  = toNum(getField(row, "6 Month", "6_Month", "SixMonth", "Six_Month", "6mo", "SixMo"));
    const mon  = toNum(getField(row, "Month", "M"));
    const wk   = toNum(getField(row, "Week", "W"));
    return [year, six, mon, wk].map(v => (isFinite(v) ? v : 0));
  };

  const pelletVals    = extractSeries(pelletRow);
  const briquetteVals = extractSeries(briquetteRow);

  const bounds = (vals) => {
    const arr = vals.filter(v => isFinite(v));
    if (!arr.length) return { min: 0, max: 10000 };
    const min = Math.min(...arr);
    const max = Math.max(...arr);
    return {
      min: Math.floor(min * 0.95),
      max: Math.ceil(max * 1.05)
    };
  };

  // Destroy old charts if any
  if (pelletChart) pelletChart.destroy();
  if (briquetteChart) briquetteChart.destroy();

  pelletChart = new Chart(pelletChartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Pellet (₹/ton)",
        data: pelletVals,
        borderColor: "#1C3D5A",
        backgroundColor: "rgba(28,61,90,0.08)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          suggestedMin: bounds(pelletVals).min,
          suggestedMax: bounds(pelletVals).max,
          ticks: { callback: (v) => `₹${fmtINR(v)}` }
        }
      },
      plugins: { legend: { display: false } }
    }
  });

  briquetteChart = new Chart(briquetteChartCanvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Briquette (₹/ton)",
        data: briquetteVals,
        borderColor: "#FFA500",
        backgroundColor: "rgba(255,165,0,0.12)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          suggestedMin: bounds(briquetteVals).min,
          suggestedMax: bounds(briquetteVals).max,
          ticks: { callback: (v) => `₹${fmtINR(v)}` }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

/* ---------- Policy / News feed ---------- */
function renderNews(items) {
  if (!Array.isArray(items) || !items.length) {
    policyFeed.innerHTML = "<p>No recent updates.</p>";
    return;
  }
  const top = items.slice(0, 3);
  policyFeed.innerHTML = top.map(it => `
    <article class="news-card">
      <div class="news-tag">${escapeHTML(it.tag || "Update")}</div>
      <h4 class="news-title">${escapeHTML(it.title || "")}</h4>
      <div class="news-meta">${escapeHTML(it.date || "")}</div>
      <p class="news-summary">${escapeHTML(it.summary || "")}</p>
      <a class="news-link" href="${it.link || "#"}" target="_blank" rel="noopener">Read →</a>
    </article>
  `).join("");
}

function escapeHTML(s) {
  return (s || "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/* ---------- Modals ---------- */
function openModal(node) {
  if (!node) return;
  node.hidden = false;
  document.body.style.overflow = "hidden";
  node.addEventListener("click", backdropClose);
}
function closeModal(node) {
  if (!node) return;
  node.hidden = true;
  document.body.style.overflow = "";
  node.removeEventListener("click", backdropClose);
}
function backdropClose(e) {
  if (e.target.classList.contains("modal")) {
    closeModal(e.target);
  }
}

/* ---------- Kickoff ---------- */
let newsData = [];
init();