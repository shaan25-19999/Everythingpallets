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
    updateData(); // Default load
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

function drawCharts(selectedLocation) {
  // Extract time series values
  const pelletTrend = sheetData.filter(row => row.Type?.toLowerCase() === "pellet" && row.State === selectedLocation)[0];
  const briquetteTrend = sheetData.filter(row => row.Type?.toLowerCase() === "briquette" && row.State === selectedLocation)[0];

  const labels = ["Week", "Month", "6 Months", "Year"];
  const pelletValues = [
    parseInt(pelletTrend?.Week) || 0,
    parseInt(pelletTrend?.Month) || 0,
    parseInt(pelletTrend?.["6mo"]) || 0,
    parseInt(pelletTrend?.Year) || 0
  ];

  const briquetteValues = [
    parseInt(briquetteTrend?.Week) || 0,
    parseInt(briquetteTrend?.Month) || 0,
    parseInt(briquetteTrend?.["6mo"]) || 0,
    parseInt(briquetteTrend?.Year) || 0
  ];

  if (pelletChartInstance) pelletChartInstance.destroy();
  if (briquetteChartInstance) briquetteChartInstance.destroy();

  const chartOptions = {
    type: 'line',
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
          ticks: {
            callback: (val) => `₹${val.toLocaleString("en-IN")}`
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
  };

  // Pellet Chart
  pelletChartInstance = new Chart(document.getElementById("pelletChart"), {
    ...chartOptions,
    data: {
      labels: labels,
      datasets: [{
        label: "Pellet Price",
        data: pelletValues,
        borderColor: "#FFA500",
        backgroundColor: "#FFA500"
      }]
    }
  });

  // Briquette Chart
  briquetteChartInstance = new Chart(document.getElementById("briquetteChart"), {
    ...chartOptions,
    data: {
      labels: labels,
      datasets: [{
        label: "Briquette Price",
        data: briquetteValues,
        borderColor: "#FFA500",
        backgroundColor: "#FFA500"
      }]
    }
  });
}

document.addEventListener("DOMContentLoaded", fetchData);