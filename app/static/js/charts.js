// Chart.js initialization for Community Connect Manager Analytics

function initAnalyticsCharts() {
  const trendCtx = document.getElementById('monthlyTrendChart');
  const catCtx = document.getElementById('categoryDistributionChart');
  const priorityCtx = document.getElementById('priorityDistributionChart');
  const statusCtx = document.getElementById('statusPipelineChart');

  if (!trendCtx) return;

  fetch('/api/analytics/charts')
    .then(res => res.json())
    .then(data => {
      // 1. Monthly Trend Chart
      if (trendCtx && data.monthly) {
        new Chart(trendCtx, {
          type: 'line',
          data: {
            labels: data.monthly.labels,
            datasets: [{
              label: 'Complaints Logged',
              data: data.monthly.data,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              fill: true,
              tension: 0.3,
              pointBackgroundColor: '#2563eb',
              pointRadius: 5
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { stepSize: 1 }
              }
            }
          }
        });
      }

      // 2. Category Distribution Doughnut
      if (catCtx && data.categories) {
        new Chart(catCtx, {
          type: 'doughnut',
          data: {
            labels: data.categories.labels,
            datasets: [{
              data: data.categories.data,
              backgroundColor: [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b'
              ],
              borderWidth: 2,
              borderColor: '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' }
            }
          }
        });
      }

      // 3. Priority Distribution
      if (priorityCtx && data.priorities) {
        new Chart(priorityCtx, {
          type: 'bar',
          data: {
            labels: data.priorities.labels,
            datasets: [{
              label: 'Complaints by Priority',
              data: data.priorities.data,
              backgroundColor: ['#dc2626', '#ea580c', '#0284c7', '#64748b'],
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }

      // 4. Status Pipeline
      if (statusCtx && data.statuses) {
        new Chart(statusCtx, {
          type: 'bar',
          data: {
            labels: data.statuses.labels,
            datasets: [{
              label: 'Complaint Status Count',
              data: data.statuses.data,
              backgroundColor: '#475569',
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    })
    .catch(err => console.error('Error loading analytics chart data:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  initAnalyticsCharts();
});
