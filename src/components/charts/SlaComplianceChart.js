import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * SLA Compliance Chart
 * 
 * @param {Array} data - Array containing compliance data over time
 * @param {Array} labels - X-axis labels (typically time periods)
 * @param {Number} target - Target SLA compliance percentage
 * @param {String} title - Chart title
 * @param {Boolean} responsive - Whether the chart should be responsive
 * @param {Number} height - Chart height in pixels
 */
const SlaComplianceChart = ({
  data,
  labels,
  target = 95,
  title = 'SLA Compliance',
  responsive = true,
  height = 300
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // Clean up previous chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    // Create gradient for the bars
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.8)'); // Green at top
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)'); // Lighter green at bottom

    // Create the chart
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'SLA Compliance',
            data: data,
            backgroundColor: gradient,
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7
          }
        ]
      },
      options: {
        responsive: responsive,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Compliance: ${context.raw}%`;
              }
            }
          },
          title: {
            display: !!title,
            text: title,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
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
            beginAtZero: false,
            min: Math.max(0, Math.min(...data) - 10),  // Dynamic minimum based on data
            max: 100,
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
        // Add the target line plugin
        annotation: {
          annotations: {
            targetLine: {
              type: 'line',
              yMin: target,
              yMax: target,
              borderColor: 'rgba(255, 99, 132, 0.8)',
              borderWidth: 2,
              borderDash: [6, 4],
              label: {
                content: `Target: ${target}%`,
                enabled: true,
                position: 'start',
                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                font: {
                  size: 11
                }
              }
            }
          }
        }
      }
    });

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, labels, target, title, responsive, height]);

  return (
    <div style={{ height: `${height}px`, position: 'relative', width: '100%' }} className="sla-chart-container">
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default SlaComplianceChart;
