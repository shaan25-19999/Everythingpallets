// ✅ Connect to your Sheet.best API
const SHEET_API = 'https://api.sheetbest.com/sheets/ec0fea37-5ac0-45b5-a7c9-cda68fcb04bf';

async function fetchData() {
  const response = await fetch(SHEET_API);
  return await response.json();
}

function updateSpecs(data, material, type) {
  const globalRow = data.find(row =>
    row.State === 'GLOBAL' &&
    row.Material.toLowerCase() === material.toLowerCase() &&
    row.Type.toLowerCase() === type.toLowerCase()
  );

  if (globalRow) {
    document.getElementById(`${type}-ash`).textContent = globalRow.Ash ? `${globalRow.Ash}%` : '--';
    document.getElementById(`${type}-moisture`).textContent = globalRow.Moisture || '--';
    document.getElementById(`${type}-kcal`).textContent = globalRow.Kcal || '--';
  } else {
    document.getElementById(`${type}-ash`).textContent = '--';
    document.getElementById(`${type}-moisture`).textContent = '--';
    document.getElementById(`${type}-kcal`).textContent = '--';
  }
}

function updateLastUpdated(data) {
  const globalUpdateRow = data.find(row =>
    row.State === 'GLOBAL' &&
    row.Material.toLowerCase() === 'global' &&
    row.Type.toLowerCase() === 'global'
  );
  const lastUpdated = globalUpdateRow ? globalUpdateRow['Last Updated'] : '--';
  document.getElementById('last-updated').textContent = lastUpdated || '--';
  document.getElementById('last-updated-briquette').textContent = lastUpdated || '--';
}

function updateChart(chart, label, values) {
  chart.data.labels = ['Year', '6 Months', 'Month', 'Week'];
  chart.data.datasets[0].label = label;
  chart.data.datasets[0].data = values;
  chart.update();
}

function parsePriceData(data, material, type) {
  const row = data.find(r =>
    r.Material.toLowerCase() === material.toLowerCase() &&
    r.Type.toLowerCase() === type.toLowerCase()
  );

  if (!row) return [0, 0, 0, 0];
  return [
    parseInt(row.Year || 0),
    parseInt(row['6 Month'] || 0),
    parseInt(row.Month || 0),
    parseInt(row.Week || 0)
  ];
}

function setupDropdown(id, materials, chart, type, data) {
  const select = document.getElementById(id);
  select.innerHTML = materials.map(m => `<option value="${m}">${m}</option>`).join('');
  select.addEventListener('change', () => {
    const selectedMaterial = select.value;
    const prices = parsePriceData(data, selectedMaterial, type);
    updateChart(chart, selectedMaterial, prices);
    updateSpecs(data, selectedMaterial, type);
  });
  select.dispatchEvent(new Event('change'));
}

function setupChart(ctx) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Year', '6 Months', 'Month', 'Week'],
      datasets: [{
        label: '',
        data: [],
        fill: false,
        borderColor: '#3399ff',
        tension: 0.3
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: false
        }
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const data = await fetchData();

  const pelletMaterials = [...new Set(data.filter(d => d.Type.toLowerCase() === 'pellet').map(d => d.Material))];
  const briquetteMaterials = [...new Set(data.filter(d => d.Type.toLowerCase() === 'briquettes').map(d => d.Material))];

  const pelletChart = setupChart(document.getElementById('pelletChart').getContext('2d'));
  const briquetteChart = setupChart(document.getElementById('briquetteChart').getContext('2d'));

  setupDropdown('pelletTypeSelect', pelletMaterials, pelletChart, 'Pellet', data);
  setupDropdown('briquetteTypeSelect', briquetteMaterials, briquetteChart, 'Briquettes', data);

  updateLastUpdated(data);
});