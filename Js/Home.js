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

  const pelletElement = document.getElementById("pelletPrice");
  const briquetteElement = document.getElementById("briquettePrice");

  let pelletPrice = "--";
  let briquettePrice = "--";

  sheetData.forEach(row => {
    if (row.State && row.Type && row.Price) {
      const stateMatch = row.State.trim().toLowerCase() === location;
      const type = row.Type.trim().toLowerCase();

      if (stateMatch && type === "pellet") {
        pelletPrice = formatNumber(row.Price);
      } else if (stateMatch && type === "briquette") {
        briquettePrice = formatNumber(row.Price);
      }
    }
  });

  pelletElement.textContent = pelletPrice;
  briquetteElement.textContent = briquettePrice;
}

// Initial fetch on load
fetchData();