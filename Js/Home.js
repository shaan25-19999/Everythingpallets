const API_URL = "https://api.sheetbest.com/sheets/f69b60fd-3167-4e76-a920-4cb278f05cc7";

let sheetData = [];

function formatNumber(num) {
  if (!num || isNaN(num)) return "--";
  return Number(num).toLocaleString("en-IN");
}

async function fetchData() {
  try {
    const response = await fetch(API_URL);
    sheetData = await response.json();
    updateData();
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function updateData() {
  const location = document.getElementById("locationSelect").value.trim();

  const matchedRow = sheetData.find(row =>
    row.State?.trim() === location
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

// Initial load
fetchData();