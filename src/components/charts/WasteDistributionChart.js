import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Waste Distribution Doughnut Chart with percentage labels
 * 
 * @param {Array} data - Array of data objects with label and value
 * @param {String} title - Chart title
 * @param {Boolean} responsive - Whether the chart should be responsive
 * @param {Number} height - Chart height in pixels
 */
const WasteDistributionChart = ({ 
  data, 
  title = 'Waste Distribution',
  responsive = true,
  height = 300
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  // Default color scheme
  const defaultColors = [
    '#10B981', // Green for recyclable
    '#4F46E5', // Indigo for general
    '#F59E0B', // Amber for organic
    '#EF4444', // Red for hazardous
    '#6B7280', // Gray for others
    '#8B5CF6', // Purple
    '#EC4899'  // Pink
  ];

  useEffect(() => {
    // Clean up previous chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');
    
    // Prepare data for the chart
    const values = data.map(item => item.value);
    const labels = data.map(item => item.label);
    const colors = data.map((_, index) => data[index].color || defaultColors[index % defaultColors.length]);
    
    // Calculate total for percentage
    const total = values.reduce((acc, val) => acc + val, 0);

    // Plugin to display percentage in the center
    const doughnutLabel = {
      id: 'doughnutLabel',
      afterDatasetsDraw(chart) {
        const { ctx, data } = chart;
        
        // Draw the percentage in the center
        ctx.save();
        const x = chart.getDatasetMeta(0).data[0].x;
        const y = chart.getDatasetMeta(0).data[0].y;
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#1F2937';
        ctx.fillText('Total', x, y - 15);
        
        ctx.font = 'bold 24px Arial';
        ctx.fillText(total, x, y + 10);
        
        ctx.restore();
      }
    };

    // Create the chart
    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 8
        }]
      },
      options: {
        responsive: responsive,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              usePointStyle: true,
              padding: 20,
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
                return `${context.label}: ${value} (${percentage}%)`;
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
        }
      },
      plugins: [doughnutLabel]
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

export default WasteDistributionChart;
