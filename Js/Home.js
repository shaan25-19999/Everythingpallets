const prices = {
      average: {
        pellet: 7500,
        briquette: 6200,
        pelletTrend: [7300, 7400, 7500, 7550],
        briquetteTrend: [6000, 6100, 6200, 6250]
      },
      ncr: {
        pellet: 7700,
        briquette: 6300,
        pelletTrend: [7500, 7600, 7700, 7750],
        briquetteTrend: [6100, 6200, 6300, 6350]
      },
      punjab: {
        pellet: 7600,
        briquette: 6250,
        pelletTrend: [7400, 7500, 7600, 7650],
        briquetteTrend: [6050, 6150, 6250, 6300]
      },
      haryana: {
        pellet: 7400,
        briquette: 6100,
        pelletTrend: [7200, 7300, 7400, 7450],
        briquetteTrend: [5900, 6000, 6100, 6150]
      },
      rajasthan: {
        pellet: 7550,
        briquette: 6150,
        pelletTrend: [7350, 7450, 7550, 7600],
        briquetteTrend: [5950, 6050, 6150, 6200]
      }
    };

    const pelletCtx = document.getElementById('pelletChart').getContext('2d');
    const briquetteCtx = document.getElementById('briquetteChart').getContext('2d');

    let pelletChart = new Chart(pelletCtx, {
      type: 'line',
      data: {
        labels: ['YEAR', '6 MONTHS', 'MONTH', 'WEEK'],
        datasets: [{
          label: 'Pellet Price (₹/ton)',
          data: prices.average.pelletTrend,
          borderColor: 'green',
          fill: false
        }]
      }
    });

    let briquetteChart = new Chart(briquetteCtx, {
      type: 'line',
      data: {
        labels: ['YEAR', '6 MONTHS', 'MONTH', 'WEEK'],
        datasets: [{
          label: 'Briquette Price (₹/ton)',
          data: prices.average.briquetteTrend,
          borderColor: 'orange',
          fill: false
        }]
      }
    });

    function updateData() {
      const location = document.getElementById('locationSelect').value;
      const data = prices[location];

      document.getElementById('pelletPrice').textContent = data.pellet;
      document.getElementById('briquettePrice').textContent = data.briquette;

      pelletChart.data.datasets[0].data = data.pelletTrend;
      briquetteChart.data.datasets[0].data = data.briquetteTrend;

      pelletChart.update();
      briquetteChart.update();
    }
