/**
 * VendorIQ Chart.js Manager
 * Renders dataset and database-driven dynamic charts with zero hardcoding.
 */
const ChartManager = {
  instances: {},

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  async renderSpendByCategory(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroyChart(canvasId);

    try {
      const data = await API.getChartSpendByCategory();
      const ctx = canvas.getContext('2d');
      this.instances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.labels,
          datasets: [{
            data: data.datasets[0].data,
            backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` $${ctx.raw.toLocaleString()}`
              }
            }
          },
          cutout: '65%'
        }
      });
    } catch (err) {
      console.error("Spend category chart error:", err);
    }
  },

  async renderMonthlyTrend(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroyChart(canvasId);

    try {
      const data = await API.getChartMonthlyTrend();
      const ctx = canvas.getContext('2d');
      this.instances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Monthly Order Spend ($)',
            data: data.datasets[0].data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => ` Spend: $${ctx.raw.toLocaleString()}`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: { callback: (val) => `$${val/1000}k` }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    } catch (err) {
      console.error("Monthly trend chart error:", err);
    }
  },

  async renderDeliveryStatus(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroyChart(canvasId);

    try {
      const data = await API.getChartDeliveryStatus();
      const ctx = canvas.getContext('2d');
      this.instances[canvasId] = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: data.labels,
          datasets: [{
            data: data.datasets[0].data,
            backgroundColor: ['#10b981', '#ef4444', '#3b82f6', '#94a3b8'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.label}: ${ctx.raw.toLocaleString()} orders`
              }
            }
          }
        }
      });
    } catch (err) {
      console.error("Delivery status chart error:", err);
    }
  },

  async renderVendorReliability(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroyChart(canvasId);

    try {
      const data = await API.getChartVendorReliability();
      const ctx = canvas.getContext('2d');
      this.instances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: data.datasets.map(ds => ({
            ...ds,
            borderRadius: 4,
            barPercentage: 0.7
          }))
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            tooltip: {
              callbacks: {
                label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} / 100`
              }
            }
          },
          scales: {
            y: {
              max: 100,
              beginAtZero: true,
              grid: { color: '#f1f5f9' },
              ticks: { stepSize: 20 }
            },
            x: {
              grid: { display: false }
            }
          }
        }
      });
    } catch (err) {
      console.error("Vendor reliability chart error:", err);
    }
  },

  async renderRiskDistribution(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroyChart(canvasId);

    try {
      const data = await API.getChartRiskDistribution();
      const ctx = canvas.getContext('2d');
      this.instances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.labels,
          datasets: [{
            data: data.datasets[0].data,
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          },
          cutout: '70%'
        }
      });
    } catch (err) {
      console.error("Risk distribution chart error:", err);
    }
  },

  async renderShippingModes(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.destroyChart(canvasId);

    try {
      const data = await API.getChartShippingModes();
      const ctx = canvas.getContext('2d');
      this.instances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.labels,
          datasets: [{
            data: data.datasets[0].data,
            backgroundColor: ['#6366f1', '#06b6d4', '#f97316', '#84cc16'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          },
          cutout: '65%'
        }
      });
    } catch (err) {
      console.error("Shipping modes chart error:", err);
    }
  }
};
