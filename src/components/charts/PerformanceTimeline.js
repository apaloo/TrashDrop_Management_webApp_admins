import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Performance Timeline Chart with interactive tooltips
 * 
 * @param {Object} data - The data to display in the chart
 * @param {Array} data.labels - X-axis labels (dates/times)
 * @param {Array} data.values - Y-axis values (performance metrics)
 * @param {String} title - Chart title
 * @param {Boolean} responsive - Whether the chart should be responsive
 * @param {Object} options - Additional Chart.js options
 */
const PerformanceTimeline = ({ 
  data, 
  title = 'Performance Timeline',
  responsive = true,
  height = 300,
  options = {} 
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // Clean up previous chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');

    // Create gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(66, 153, 225, 0.2)');
    gradient.addColorStop(1, 'rgba(66, 153, 225, 0.0)');

    // Create the chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: title,
          data: data.values,
          borderColor: '#4299e1',
          borderWidth: 2,
          tension: 0.4,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#4299e1',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          backgroundColor: gradient,
        }]
      },
      options: {
        responsive: responsive,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            cornerRadius: 4,
            displayColors: false,
          },
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              font: {
                size: 11
              },
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        ...options
      }
    });

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, title, options, height, responsive]);

  return (
    <div style={{ height: `${height}px`, position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default PerformanceTimeline;
