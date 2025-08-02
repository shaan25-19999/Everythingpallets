const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";
let sheetData = [];

function formatNumber(num) {
  if (!num || isNaN(num)) return "--";
  return Number(num).toLocaleString("en-IN");
}

async function fetchData() {
  console.log("✅ JS file linked and fetchData running...");
  try {
    const response = await fetch(API_URL);
    sheetData = await response.json();
    console.log("✅ Sheet data fetched:", sheetData);
    populateLocationDropdown();
    updateData(); // Load default location
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

  console.log(`📍 Updated prices for ${location}: Pellet = ₹${pelletPrice}, Briquette = ₹${briquettePrice}`);
}

document.addEventListener("DOMContentLoaded", fetchData);