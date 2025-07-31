const API_URL = "https://api.sheetbest.com/sheets/5ac0ae3c-c8d3-4f90-a9af-18198287e688";
let sheetData = [];

function formatNumber(num) {
  if (!num || isNaN(num)) return "--";
  return Number(num).toLocaleString("en-IN");
}

async function fetchData() {
  try {
    const response = await fetch(API_URL);
    sheetData = await response.json();
    populateLocationDropdown();
    updateData(); // Load data for default location
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function populateLocationDropdown() {
  const locationSelect = document.getElementById("locationSelect");
  const uniqueStates = [...new Set(sheetData.map(row => row.State?.trim()).filter(Boolean))];

  // Clear existing
  locationSelect.innerHTML = "";

  uniqueStates.forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    locationSelect.appendChild(option);
  });
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
}

document.getElementById("locationSelect").addEventListener("change", updateData);

// Auto run
fetchData();




<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>EverythingPallets</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="style/home.css">
</head>
<body>

  <!-- ✅ HEADER WITH LOGO AND TITLE -->
  <header class="site-header">
    <div class="logo-header">
      <img src="assets/Logo.png" alt="EverythingPallets Logo" class="site-logo" />
      <h1 class="home-title">HOME</h1>
      <p class="site-tagline">For your every biomass and green energy need</p>
    </div>
  </header>

  <!-- ✅ NAVIGATION -->
  <nav>
    <div class="nav-links">
      <a href="index.html">Home</a>
      <a href="market.html">Market Prices</a>
      <a href="news.html">News</a>
      <a href="contact.html">Contact</a>
    </div>
  </nav>

  <!-- ✅ MAIN CONTENT -->
  <main>
    <h2>Live Market Price Update for India</h2>

    <div>
      <label for="locationSelect"><strong>Select Location:</strong></label><br/>
      <select id="locationSelect" onchange="updateData()">
        <option value="Average">Average</option>
        <option value="Haryana">Haryana</option>
        <option value="Uttar Pradesh">Uttar Pradesh</option>
        <option value="Punjab">Punjab</option>
        <option value="Rajasthan">Rajasthan</option>
      </select>
    </div>

    <div class="price-section">
      <div class="price-box">
        <strong>Pellet Price:</strong><br/>
        ₹<span id="pelletPrice">--</span>/ton
      </div>
      <div class="price-box">
        <strong>Briquette Price:</strong><br/>
        ₹<span id="briquettePrice">--</span>/ton
      </div>
    </div>

    <div class="graph-container">
      <div class="chart-box">
        <canvas id="pelletChart"></canvas>
      </div>
      <div class="chart-box">
        <canvas id="briquetteChart"></canvas>
      </div>
    </div>

    <div class="cta">
      <h3>Contact us for fair market rates and quality supply support</h3>
      <button onclick="alert('Callback requested')">Request Callback</button>
    </div>
  </main>

  <!-- ✅ FOOTER -->
  <footer>
    <p>&copy; 2025 EverythingPallets. All rights reserved.</p>
  </footer>

</body>
</html>