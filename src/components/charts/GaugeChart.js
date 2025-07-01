import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Gauge Chart with dynamic needle animation
 * 
 * @param {Number} value - The current value to display (between 0-100)
 * @param {String} title - Chart title
 * @param {String} label - Label for the value
 * @param {Boolean} responsive - Whether the chart should be responsive
 * @param {Number} height - Chart height in pixels
 * @param {Object} options - Additional configuration options
 */
const GaugeChart = ({
  value,
  title = 'Active Fleet',
  label = '%',
  responsive = true,
  height = 220,
  options = {}
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const needleValue = Math.min(Math.max(value, 0), 100); // Ensure value is between 0-100

  useEffect(() => {
    // Clean up previous chart instance
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = chartRef.current.getContext('2d');

    // Colors for the gauge segments
    const redColor = 'rgba(239, 68, 68, 0.8)'; // Low (0-30)
    const yellowColor = 'rgba(245, 158, 11, 0.8)'; // Medium (30-70)
    const greenColor = 'rgba(16, 185, 129, 0.8)'; // High (70-100)

    // Define needle properties
    const needlePlugin = {
      id: 'gaugeNeedle',
      afterDatasetDraw(chart) {
        const { width, height } = chart;
        const dataTotal = chart.config.data.datasets[0].data.reduce((a, b) => a + b, 0);
        const angle = Math.PI + (1 * Math.PI * needleValue) / dataTotal;
        const ctx = chart.ctx;
        const cw = chart.canvas.offsetWidth;
        const ch = chart.canvas.offsetHeight;
        const cx = cw / 2;
        const cy = ch - 5; // Position at bottom of chart

        // Draw needle
        const needleLength = ch * 0.85;
        const needleRadius = 10;
        const needleColor = '#1F2937';

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Needle arrow body
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(needleLength, 0);
        ctx.lineTo(0, 2);
        ctx.fillStyle = needleColor;
        ctx.fill();

        // Needle circle
        ctx.beginPath();
        ctx.arc(0, 0, needleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = needleColor;
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Draw value text in center
        ctx.save();
        ctx.translate(cx, cy - needleRadius - 30);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1F2937';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`${needleValue}${label}`, 0, 0);
        ctx.restore();
      }
    };

    // Create the chart
    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Low', 'Medium', 'High'],
        datasets: [{
          data: [30, 40, 30], // Segments (0-30, 30-70, 70-100)
          backgroundColor: [redColor, yellowColor, greenColor],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: responsive,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          },
          title: {
            display: !!title,
            text: title,
            position: 'bottom',
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 20,
              bottom: 0
            }
          }
        },
        layout: {
          padding: {
            top: 0,
            right: 0,
            bottom: 30, // Make room for the needle
            left: 0
          }
        },
        ...options
      },
      plugins: [needlePlugin]
    });

    // Cleanup function
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [needleValue, title, label, responsive, height, options]);

  return (
    <div style={{ height: `${height}px`, position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default GaugeChart;
