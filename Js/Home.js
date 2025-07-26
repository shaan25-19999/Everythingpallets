const API_URL = "https://api.sheetbest.com/sheets/f69b60fd-3167-4e76-a920-4cb278f05cc7";
let sheetData = [];

async function fetchData() {
  try {
    const response = await fetch(API_URL);
    sheetData = await response.json();
    updateData(); // Initial load
  } catch (error) {
    console.error("⚠️ Error fetching SheetBest data:", error);
    document.getElementById("pelletPrice").textContent = "--";
    document.getElementById("briquettePrice").textContent = "--";
  }
}

function updateData() {
  const location = document.getElementById("locationSelect").value.trim().toLowerCase();

  const matchedRow = sheetData.find(row =>
    row.State?.trim().toLowerCase() === location
  );

  const pelletElement = document.getElementById("pelletPrice");
  const briquetteElement = document.getElementById("briquettePrice");

  if (matchedRow) {
    pelletElement.textContent = formatNumber(matchedRow["Pellet Price"]);
    briquetteElement.textContent = formatNumber(matchedRow["Briquette Price"]);
  } else {
    pelletElement.textContent = "--";
    briquetteElement.textContent = "--";
  }
}

function formatNumber(value) {
  const num = parseInt(value?.toString().replace(/,/g, ""));
  return isNaN(num) ? "--" : num.toLocaleString("en-IN");
}

document.addEventListener("DOMContentLoaded", fetchData);