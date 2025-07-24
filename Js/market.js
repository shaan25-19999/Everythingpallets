// ✅ Fetch CSV from GitHub and parse it
const fetchCSV = async () => {
  const res = await fetch("https://raw.githubusercontent.com/shaan25-19999/Everythingpallets/main/Assets/Marketprice%20sheet%20.csv");
  const text = await res.text();
  return parseCSV(text);
};

// ✅ Convert CSV to structured data
function parseCSV(data) {
  const rows = data.trim().split('\n').map(row => row.split(','));
  const headers = rows[0].map(h => h.trim());
  const content = rows.slice(1);

  const structured = {};

  for (const row of content) {
    const [
      location, material, type, price,
      week, month, sixMonth, year
    ] = row.map(cell => cell.trim());

    if (!structured[location]) {
      structured[location] = {
        materials: { pellets: {}, briquettes: {} }
      };
    }

    const trend = [parseInt(year), parseInt(sixMonth), parseInt(month), parseInt(week)];
    const formatted = {
      price: parseInt(price),
      trend: trend
    };

    if (type.toLowerCase() === "pellet") {
      structured[location].materials.pellets[material] = formatted;
    } else {
      structured[location].materials.briquettes[material] = formatted;
    }
  }

  return structured;
}
document.addEventListener("DOMContentLoaded", async () => {
  const locationSelect = document.getElementById("locationSelect");
  const materialSelect = document.getElementById("materialSelect");
  const briquetteSelect = document.getElementById("briquetteSelect");
  const materialTable = document.getElementById("materialTable");
  const briquetteTable = document.getElementById("briquetteTable");
  const chartTitle = document.getElementById("chartTitle");
  const briquetteChartTitle = document.getElementById("briquetteChartTitle");
  const ctx = document.getElementById("priceChart").getContext("2d");
  const briquetteCtx = document.getElementById("briquetteChart").getContext("2d");

  const dataset = await fetchCSV();
  const locations = Object.keys(dataset);
  const pelletLabels = new Set();
  const briquetteLabels = new Set();

  // Extract material names
  locations.forEach(loc => {
    Object.keys(dataset[loc].materials.pellets).forEach(m => pelletLabels.add(m));
    Object.keys(dataset[loc].materials.briquettes).forEach(b => briquetteLabels.add(b));
  });

  // Populate dropdowns
  locations.forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    locationSelect.appendChild(opt);
  });

  pelletLabels.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = mat;
    opt.textContent = mat;
    materialSelect.appendChild(opt);
  });

  briquetteLabels.forEach(mat => {
    const opt = document.createElement("option");
    opt.value = mat;
    opt.textContent = mat;
    briquetteSelect.appendChild(opt);
  });
    // ✅ Chart.js: Pellet Chart
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `₹${ctx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: val => `₹${val.toLocaleString()}`
          }
        }
      }
    }
  });

  // ✅ Chart.js: Briquette Chart
  const briquetteChart = new Chart(briquetteCtx, {
    type: 'line',
    data: { labels: ['Year', '6 Months', 'Month', 'Week'], datasets: [{ label: '', data: [] }] },
    options: {
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => `₹${ctx.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: val => `₹${val.toLocaleString()}`
          }
        }
      }
    }
  });

  function renderTable(locationKey) {
    const data = dataset[locationKey].materials.pellets;
    materialTable.innerHTML = `<tr><th>Pellet Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const trendHTML = trend.map(val => `<span style="display:inline-block;width:5px;height:${10 + val / 100}px;background:#52b788;margin:0 1px;"></span>`).join('');
        return `<tr><td>${type}</td><td><strong>₹${price.toLocaleString()}</strong></td><td>${trendHTML}</td></tr>`;
      }).join('');
  }

  function renderBriquetteTable(locationKey) {
    const data = dataset[locationKey].materials.briquettes;
    briquetteTable.innerHTML = `<tr><th>Briquette Type</th><th>Price (₹/ton)</th><th>Last 4 Trend</th></tr>` +
      Object.entries(data).map(([type, { price, trend }]) => {
        const trendHTML = trend.map(val => `<span style="display:inline-block;width:5px;height:${10 + val / 100}px;background:#6a4f2d;margin:0 1px;"></span>`).join('');
        return `<tr><td>${type}</td><td><strong>₹${price.toLocaleString()}</strong></td><td>${trendHTML}</td></tr>`;
      }).join('');
  }

  function updateChart(locationKey, type, chartObj, isPellet = true) {
    const source = isPellet ? dataset[locationKey].materials.pellets : dataset[locationKey].materials.briquettes;
    const trend = source[type]?.trend || [];
    chartObj.data.datasets[0].label = type;
    chartObj.data.datasets[0].data = trend;
    chartObj.update();
  }

  // ✅ Event listeners
  function refreshAll() {
    const loc = locationSelect.value;
    renderTable(loc);
    renderBriquetteTable(loc);
    updateChart(loc, materialSelect.value, chart, true);
    updateChart(loc, briquetteSelect.value, briquetteChart, false);
  }

  locationSelect.addEventListener("change", refreshAll);
  materialSelect.addEventListener("change", () => updateChart(locationSelect.value, materialSelect.value, chart, true));
  briquetteSelect.addEventListener("change", () => updateChart(locationSelect.value, briquetteSelect.value, briquetteChart, false));

  // ✅ Set defaults and render
  locationSelect.value = locations[0];
  materialSelect.value = [...pelletLabels][0];
  briquetteSelect.value = [...briquetteLabels][0];
  refreshAll();
});