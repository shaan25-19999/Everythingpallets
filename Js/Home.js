const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";
let sheetData = [];
let pelletChartInstance = null;
let briquetteChartInstance = null;

function formatNumber(num) {
  if (!num || isNaN(num)) return "--";
  return Number(num).toLocaleString("en-IN");
}

async function fetchData() {
  try {
    const response = await fetch(API_URL);
    sheetData = await response.json();
    populateLocationDropdown();
    updateData(); // default load
  } catch (error) {
    console.error("❌ Error fetching data:", error);
  }
}

function populateLocationDropdown() {
  const locationSelect = document.getElementById("locationSelect");
  const uniqueStates = [...new Set(sheetData.map(row => row.State?.trim()).filter(Boolean))];

  locationSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.disabled = true;
  defaultOption.selected = true;
  defaultOption.textContent = "Select a Location";
  locationSelect.appendChild(defaultOption);

  uniqueStates.forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    locationSelect.appendChild(option);
  });

  locationSelect.addEventListener("change", updateData);
}

function updateData() {
  const location = document.getElementById("locationSelect").value?.trim();
  let pelletPrice = "--";
  let briquettePrice = "--";

  for (const row of sheetData) {
    const state = row.State?.trim();
    const type = row.Type?.trim().toLowerCase();
    const price = row.Price?.toString().replace(/,/g, "");

    if (state === location && type === "pellet") {
      pelletPrice = formatNumber(price);
    } else if (state === location && type === "briquette") {
      briquettePrice = formatNumber(price);
    }
  }

  document.getElementById("pelletPrice").textContent = pelletPrice;
  document.getElementById("briquettePrice").textContent = briquettePrice;

  drawCharts(location);
}

function drawCharts(location) {
  const labels = ["Year", "6 Months", "Month", "Week"];

  const pelletRow = sheetData.find(row => row.State?.trim() === location && row.Type?.trim().toLowerCase() === "pellet");
  const briquetteRow = sheetData.find(row => row.State?.trim() === location && row.Type?.trim().toLowerCase() === "briquette");

  const parseValues = row => [
    parseInt(row?.Year || 0),
    parseInt(row?.6 Months || 0),
    parseInt(row?.["Month"] || row?.["6mo"] || 0),
    parseInt(row?.Week || 0)
  ];

  const pelletValues = parseValues(pelletRow);
  const briquetteValues = parseValues(briquetteRow);

  if (pelletChartInstance) pelletChartInstance.destroy();
  if (briquetteChartInstance) briquetteChartInstance.destroy();

  const getBounds = (values) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      suggestedMin: Math.floor(min * 0.95),
      suggestedMax: Math.ceil(max * 1.05)
    };
  };

  const pelletBounds = getBounds(pelletValues);
  const briquetteBounds = getBounds(briquetteValues);

  const getChartOptions = (suggestedMin, suggestedMax) => ({
    type: "line",
    options: {
      responsive: true,
      maintainAspectRatio: false,
      elements: {
        line: { tension: 0.3, borderWidth: 2 },
        point: { radius: 4, backgroundColor: "#FFA500" }
      },
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin,
          suggestedMax,
          ticks: {
            callback: value => `₹${value.toLocaleString("en-IN")}`
          }
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

  pelletChartInstance = new Chart(document.getElementById("pelletChart"), {
    ...getChartOptions(pelletBounds.suggestedMin, pelletBounds.suggestedMax),
    data: {
      labels,
      datasets: [{
        label: "Pellet Price",
        data: pelletValues,
        borderColor: "#1C3D5A",
        backgroundColor: "#DDEAF4"
      }]
    }
  });

  briquetteChartInstance = new Chart(document.getElementById("briquetteChart"), {
    ...getChartOptions(briquetteBounds.suggestedMin, briquetteBounds.suggestedMax),
    data: {
      labels,
      datasets: [{
        label: "Briquette Price",
        data: briquetteValues,
        borderColor: "#FFA500",
        backgroundColor: "#FFEFD5"
      }]
    }
  });
}

document.addEventListener("DOMContentLoaded", fetchData);