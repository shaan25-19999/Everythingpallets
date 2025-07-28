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
  const location = document.getElementById("locationSelect").value.trim().toLowerCase();

  let pelletPrice = "--";
  let briquettePrice = "--";

  sheetData.forEach(row => {
    const state = row.State?.trim().toLowerCase();
    const type = row.Type?.trim().toLowerCase();
    const price = row.Price?.replace(/,/g, '').trim();

    if (state === location && type === "pellet") {
      pelletPrice = formatNumber(price);
    }
    if (state === location && type === "briquette") {
      briquettePrice = formatNumber(price);
    }
  });

  document.getElementById("pelletPrice").textContent = pelletPrice;
  document.getElementById("briquettePrice").textContent = briquettePrice;
}

// Load data initially
fetchData();