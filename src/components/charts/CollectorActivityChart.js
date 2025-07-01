import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Collector Activity Pie Chart with status breakdown
 * 
 * @param {Array} data - Array of data objects with label, value, and color (optional)
 * @param {String} title - Chart title
 * @param {Boolean} responsive - Whether the chart should be responsive
 * @param {Number} height - Chart height in pixels
 */
const CollectorActivityChart = ({ 
  data, 
  title = 'Collector Status',
  responsive = true,
  height = 250
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  // Default color scheme for collector statuses
  const defaultColors = {
    'Active': '#10B981',  // Green for active
    'Idle': '#F59E0B',    // Amber for idle
    'Offline': '#9CA3AF', // Gray for offline
    'Maintenance': '#3B82F6', // Blue for maintenance
    'Training': '#8B5CF6'  // Purple for training
  };

  useEffect(() => {
    // Clean up previous chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    // Prepare data for the chart
    const values = data.map(item => item.value);
    const labels = data.map(item => item.label);
    const colors = data.map(item => item.color || defaultColors[item.label] || '#6B7280');
    
    // Calculate total for percentage
    const total = values.reduce((acc, val) => acc + val, 0);

    // Create the chart
    chartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 10
        }]
      },
      options: {
        responsive: responsive,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12
              },
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map(function(label, i) {
                    const meta = chart.getDatasetMeta(0);
                    const ds = data.datasets[0];
                    const percent = Math.round((ds.data[i] / total) * 100) + '%';
                    
                    return {
                      text: `${label}: ${percent}`,
                      fillStyle: ds.backgroundColor[i],
                      strokeStyle: ds.borderColor,
                      lineWidth: ds.borderWidth,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const value = context.raw;
                const percentage = Math.round((value / total) * 100);
                return `${context.label}: ${value} collectors (${percentage}%)`;
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
          },
          // Custom plugin to display total collectors in the center
          datalabels: {
            formatter: (value, ctx) => {
              return `${value}`;
            },
            color: '#fff',
            font: {
              weight: 'bold',
              size: 11
            },
            display: function(context) {
              const value = context.dataset.data[context.dataIndex];
              return value > 5; // Only show for segments that are large enough
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
  }, [data, title, responsive, height]);

  return (
    <div style={{ height: `${height}px`, position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default CollectorActivityChart;
