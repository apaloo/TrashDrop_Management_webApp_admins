import React, { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Doughnut, Line, Bar, Pie } from 'react-chartjs-2';
import { supabase } from '../utils/supabase';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Gauge chart code - creates an animated needle gauge
const createGaugeChart = (ctx, percentage) => {
  if (!ctx) return null;
  
  const needle = {
    animation: true,
    animationDuration: 1200,
    currentValue: 0
  };
  
  const gaugeChart = new ChartJS(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [percentage, 100 - percentage],
        backgroundColor: [
          '#4CAF50',
          '#ECEFF1'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      rotation: -90,
      circumference: 180,
      cutout: '75%',
      plugins: {
        tooltip: { enabled: false },
        legend: { display: false }
      },
      animation: {
        onComplete: (animation) => {
          const needleValue = percentage;
          needle.animation = false;
          needle.currentValue = needleValue;
          gaugeChart.update();
        },
        onProgress: (animation) => {
          if (needle.animation) {
            const currentValue = animation.currentStep / animation.numSteps * percentage;
            needle.currentValue = currentValue;
            gaugeChart.update();
          }
        }
      }
    },
    plugins: [{
      id: 'needlePlugin',
      afterDatasetsDraw: (chart) => {
        const { ctx, data, chartArea, config } = chart;
        const dataset = data.datasets[0];
        if (!dataset) return;
        
        const angle = Math.PI + (needle.currentValue / 100 * Math.PI);
        const cx = chartArea.width / 2 + chartArea.left;
        const cy = chartArea.bottom;
        
        const needleLength = chartArea.height * 0.35;
        const needleRadius = 5;
        const needleBaseWidth = 10;
        
        // Draw the needle
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-needleBaseWidth, 0);
        ctx.lineTo(0, needleLength);
        ctx.lineTo(needleBaseWidth, 0);
        ctx.fillStyle = '#464A4F';
        ctx.fill();
        
        // Draw needle center circle
        ctx.beginPath();
        ctx.arc(0, 0, needleRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#464A4F';
        ctx.fill();
        
        ctx.restore();
        
        // Draw the percentage text
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#464A4F';
        ctx.fillText(`${Math.round(needle.currentValue)}%`, cx, cy - needleLength / 3);
        ctx.restore();
      }
    }]
  });
  
  return gaugeChart;
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    activeCollectors: 0,
    slaCompliance: 0,
    totalTrend: '+5%',
    pendingTrend: '-2%',
    activeCollectorPercent: 67,
    slaComplianceTrend: '+3%'
  });
  
  // References for chart cleanup
  const gaugeChartRef = useRef(null);
  const gaugeChartInstance = useRef(null);

  // Pickup Requests Status - Doughnut chart data
  const pickupStatusData = {
    labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
    datasets: [
      {
        data: [65, 20, 10, 5],
        backgroundColor: [
          '#4CAF50', // green for completed
          '#2196F3', // blue for in progress
          '#FFC107', // yellow for pending
          '#dc3545', // red for cancelled
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Collector Activity - Pie chart data
  const collectorActivityData = {
    labels: ['Active', 'Idle', 'On Break', 'Off Duty'],
    datasets: [
      {
        data: [67, 15, 10, 8],
        backgroundColor: [
          '#4CAF50', // green for active
          '#FFC107', // yellow for idle
          '#2196F3', // blue for on break
          '#9E9E9E', // grey for off duty
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Dumping Reports - Bar chart data
  const dumpingReportsData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Reports',
        data: [12, 19, 8, 15, 10, 5, 3],
        backgroundColor: '#FF5722',
        borderColor: '#E64A19',
        borderWidth: 1,
      },
    ],
  };
  
  // Bag Utilization Trend - Line chart data
  const bagUtilizationData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    datasets: [
      {
        label: 'Bags Distributed',
        data: [120, 145, 170, 190, 210, 235],
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Bags Collected',
        data: [95, 125, 150, 175, 190, 215],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        tension: 0.3,
        fill: true,
      }
    ],
  };
  
  // Waste Distribution Chart with direct percentage labels
  const wasteDistributionData = {
    labels: ['Recyclable', 'Organic', 'Hazardous', 'Electronic', 'Other'],
    datasets: [
      {
        label: 'Waste Distribution',
        data: [42, 28, 10, 15, 5],
        backgroundColor: [
          'rgba(76, 175, 80, 0.7)', // green for recyclable
          'rgba(255, 193, 7, 0.7)', // yellow for organic
          'rgba(220, 53, 69, 0.7)', // red for hazardous
          'rgba(33, 150, 243, 0.7)', // blue for electronic
          'rgba(158, 158, 158, 0.7)', // grey for other
        ],
        borderColor: [
          '#4CAF50',
          '#FFC107',
          '#dc3545',
          '#2196F3',
          '#9E9E9E',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart options with plugins for direct percentage labels
  const wasteChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    }
  };
  
  // Load dashboard data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // In a real application, this would be fetched from Supabase
        // For now, using mock data
        
        // Simulating API call
        setTimeout(() => {
          setStats({
            totalRequests: 150,
            pendingRequests: 20,
            activeCollectors: 10,
            slaCompliance: 95,
            totalTrend: '+5%',
            pendingTrend: '-2%',
            activeCollectorPercent: 67,
            slaComplianceTrend: '+3%'
          });
          setLoading(false);
        }, 800);
        
        // Example of how you would fetch from Supabase in a real application:
        // const { data, error } = await supabase
        //   .from('dashboard_stats')
        //   .select('*')
        //   .single();
        // 
        // if (error) throw error;
        // setStats(data);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, []);
  
  // Initialize gauge chart after component mounts and cleanup on unmount
  useEffect(() => {
    if (!loading && gaugeChartRef.current) {
      // Initialize gauge chart
      gaugeChartInstance.current = createGaugeChart(
        gaugeChartRef.current.getContext('2d'),
        stats.activeCollectorPercent
      );
    }
    
    // Handle window resize for responsive charts
    const handleResize = () => {
      if (gaugeChartInstance.current) {
        gaugeChartInstance.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      
      // Destroy chart instances to prevent memory leaks
      if (gaugeChartInstance.current) {
        gaugeChartInstance.current.destroy();
      }
    };
  }, [loading, stats.activeCollectorPercent]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Welcome to TrashDrop Management Portal</p>
      </div>
      
      {/* KPI Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Requests */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 flex items-center">
          <div className="p-3 rounded-full bg-green-100 mr-4">
            <i className="fas fa-truck-loading text-green-600 text-2xl" style={{ color: '#4CAF50' }}></i>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Total Requests</p>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
            ) : (
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold text-gray-800">{stats.totalRequests}</h3>
                <span className="ml-2 text-sm" style={{ color: '#4CAF50' }}>{stats.totalTrend}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Pending Requests */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 flex items-center">
          <div className="p-3 rounded-full bg-yellow-100 mr-4">
            <i className="fas fa-clock text-yellow-600 text-2xl" style={{ color: '#FFC107' }}></i>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Pending Requests</p>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
            ) : (
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold text-gray-800">{stats.pendingRequests}</h3>
                <span className="ml-2 text-sm" style={{ color: '#dc3545' }}>{stats.pendingTrend}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Active Collectors */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 flex items-center">
          <div className="p-3 rounded-full bg-blue-100 mr-4">
            <i className="fas fa-users text-blue-600 text-2xl" style={{ color: '#2196F3' }}></i>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Active Collectors</p>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
            ) : (
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold text-gray-800">{stats.activeCollectors}</h3>
                <span className="ml-2 text-sm text-gray-600">{stats.activeCollectorPercent}%</span>
              </div>
            )}
          </div>
        </div>
        
        {/* SLA Compliance */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 flex items-center">
          <div className="p-3 rounded-full bg-purple-100 mr-4">
            <i className="fas fa-clipboard-check text-purple-600 text-2xl" style={{ color: '#9C27B0' }}></i>
          </div>
          <div>
            <p className="text-gray-600 text-sm">SLA Compliance</p>
            {loading ? (
              <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
            ) : (
              <div className="flex items-baseline">
                <h3 className="text-2xl font-bold text-gray-800">{stats.slaCompliance}%</h3>
                <span className="ml-2 text-sm" style={{ color: '#4CAF50' }}>{stats.slaComplianceTrend}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pickup Requests Status (Doughnut Chart) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Pickup Requests Status</h3>
          <div className="h-80 flex items-center justify-center">
            {loading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
            ) : (
              <Doughnut options={chartOptions} data={pickupStatusData} />
            )}
          </div>
        </div>
        
        {/* Collector Activity (Pie Chart) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Collector Activity</h3>
          <div className="h-80 flex items-center justify-center">
            {loading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
            ) : (
              <Pie options={chartOptions} data={collectorActivityData} />
            )}
          </div>
        </div>
        
        {/* Active Fleet Gauge */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Fleet Percentage</h3>
          <div className="h-80 flex items-center justify-center relative">
            {loading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
            ) : (
              <canvas ref={gaugeChartRef} />
            )}
          </div>
        </div>
        
        {/* Waste Distribution (Doughnut Chart with direct labels) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Waste Distribution</h3>
          <div className="h-80 flex items-center justify-center">
            {loading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
            ) : (
              <Doughnut options={wasteChartOptions} data={wasteDistributionData} />
            )}
          </div>
        </div>
        
        {/* Dumping Reports (Bar Chart) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Dumping Reports</h3>
          <div className="h-80">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <Bar options={chartOptions} data={dumpingReportsData} />
            )}
          </div>
        </div>
        
        {/* Bag Utilization Trend (Line Chart) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6 col-span-1 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Bag Utilization Trend</h3>
          <div className="h-80">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <Line options={chartOptions} data={bagUtilizationData} />
            )}
          </div>
        </div>
      </div>
      
      {/* Alerts & Activity Section */}
      <div className="bg-white rounded-lg shadow-sm border-0 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Alerts & Activity</h3>
          <button className="text-sm text-primary hover:underline">View All</button>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center p-2">
                <div className="rounded-full bg-gray-200 h-10 w-10 mr-3"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            <li className="py-3 flex items-center hover:bg-gray-50 transition-colors rounded-md px-2">
              <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)' }}>
                <i className="fas fa-exclamation-triangle" style={{ color: '#dc3545' }}></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900">Critical: SLA breach risk for request #12378</p>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(220, 53, 69, 0.1)', color: '#dc3545' }}>Critical</span>
                </div>
                <p className="text-xs text-gray-500">Now - Requires immediate attention</p>
              </div>
            </li>
            <li className="py-3 flex items-center hover:bg-gray-50 transition-colors rounded-md px-2">
              <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
                <i className="fas fa-check-circle" style={{ color: '#4CAF50' }}></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900">Pickup request #12345 completed</p>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}>Success</span>
                </div>
                <p className="text-xs text-gray-500">10 min ago - by John Doe</p>
              </div>
            </li>
            <li className="py-3 flex items-center hover:bg-gray-50 transition-colors rounded-md px-2">
              <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
                <i className="fas fa-plus-circle" style={{ color: '#2196F3' }}></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900">New pickup request #12350 received</p>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#2196F3' }}>New</span>
                </div>
                <p className="text-xs text-gray-500">30 min ago - from 123 Main St</p>
              </div>
            </li>
            <li className="py-3 flex items-center hover:bg-gray-50 transition-colors rounded-md px-2">
              <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)' }}>
                <i className="fas fa-exclamation-circle" style={{ color: '#FFC107' }}></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900">Collector #113 approaching idle time limit</p>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', color: '#FFC107' }}>Warning</span>
                </div>
                <p className="text-xs text-gray-500">45 min ago - Michael Williams</p>
              </div>
            </li>
            <li className="py-3 flex items-center hover:bg-gray-50 transition-colors rounded-md px-2">
              <div className="rounded-full p-2 mr-3" style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)' }}>
                <i className="fas fa-map-marker-alt" style={{ color: '#9C27B0' }}></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="text-sm font-medium text-gray-900">Illegal dumping report #5678 submitted</p>
                  <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)', color: '#9C27B0' }}>Report</span>
                </div>
                <p className="text-xs text-gray-500">2 hours ago - by Jane Smith</p>
              </div>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
