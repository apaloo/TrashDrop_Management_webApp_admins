import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  fetchDashboardMetrics,
  fetchPickupStatusChartData,
  fetchCollectorActivityChartData,
  fetchPickupVsBinsPieData,
  fetchDigitalBinsBreakdownBarData,
  fetchWasteDistributionChartData,
  fetchBagUtilizationTrendData,
  fetchDumpingReportsChartData,
  fetchDashboardAlerts,
  subscribeToDashboardUpdates
} from '../utils/dashboardService';

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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataWarnings, setDataWarnings] = useState([]);
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    activeCollectors: 0,
    slaCompliance: 0,
    totalTrend: '0%',
    pendingTrend: '0%',
    activeCollectorPercent: 0,
    slaComplianceTrend: '0%'
  });
  
  // Chart data state
  const [pickupStatusData, setPickupStatusData] = useState({
    labels: ['Completed', 'In Progress', 'Pending', 'Cancelled'],
    datasets: [
      {
        data: [0, 0, 0, 0],
        backgroundColor: [
          '#4CAF50', // green for completed
          '#2196F3', // blue for in progress
          '#FFC107', // yellow for pending
          '#dc3545', // red for cancelled
        ],
        borderWidth: 1,
      },
    ],
  });

  const [pickupVsBinsPieData, setPickupVsBinsPieData] = useState({
    labels: ['Pickup Requests', 'Digital Bins'],
    datasets: [
      {
        data: [0, 0],
        backgroundColor: ['#2196F3', '#10b981'],
        borderWidth: 1,
      },
    ],
  });

  const [binsBreakdownData, setBinsBreakdownData] = useState({
    labels: ['Active', 'Inactive', 'Expired'],
    datasets: [
      {
        label: 'Digital Bins',
        data: [0, 0, 0],
        backgroundColor: ['#10b981', '#9E9E9E', '#FF5722'],
        borderWidth: 1,
      },
    ],
  });

  const [barOfPieSelection, setBarOfPieSelection] = useState('pickup');
  
  const [collectorActivityData, setCollectorActivityData] = useState({
    labels: ['Active', 'Idle', 'On Break', 'Off Duty'],
    datasets: [
      {
        data: [0, 0, 0, 0],
        backgroundColor: [
          '#4CAF50', // green for active
          '#FFC107', // yellow for idle
          '#2196F3', // blue for on break
          '#9E9E9E', // grey for off duty
        ],
        borderWidth: 1,
      },
    ],
  });
  
  const [bagUtilizationData, setBagUtilizationData] = useState({
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    datasets: [
      {
        label: 'Bags Distributed',
        data: [0, 0, 0, 0, 0, 0],
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'Bags Collected',
        data: [0, 0, 0, 0, 0, 0],
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        tension: 0.3,
        fill: true,
      }
    ],
  });
  
  const [wasteDistributionData, setWasteDistributionData] = useState({
    labels: ['Recyclable', 'Organic', 'Hazardous', 'Electronic', 'Other'],
    datasets: [
      {
        label: 'Waste Distribution',
        data: [0, 0, 0, 0, 0],
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
  });
  
  // Dumping Reports - Bar chart data
  const [dumpingReportsData, setDumpingReportsData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Reports',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: '#FF5722',
        borderColor: '#E64A19',
        borderWidth: 1,
      },
    ],
  });
  
  const [alertsData, setAlertsData] = useState([]);
  
  // References for chart cleanup
  const gaugeChartRef = useRef(null);
  const gaugeChartInstance = useRef(null);

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
  
  // Load dashboard data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      setDataWarnings([]);
      try {
        // Fetch all dashboard data in parallel
        const [
          metricsData,
          pickupData,
          pieTotals,
          binsBreakdown,
          collectorData,
          wasteData,
          bagData,
          dumpingData,
          alerts
        ] = await Promise.all([
          fetchDashboardMetrics(),
          fetchPickupStatusChartData(),
          fetchPickupVsBinsPieData(),
          fetchDigitalBinsBreakdownBarData(),
          fetchCollectorActivityChartData(),
          fetchWasteDistributionChartData(),
          fetchBagUtilizationTrendData(),
          fetchDumpingReportsChartData(),
          fetchDashboardAlerts()
        ]);

        const warningMessages = [];

        const sumDataset = (chartData) => {
          const values = chartData?.datasets?.[0]?.data;
          if (!Array.isArray(values)) return 0;
          return values.reduce((acc, v) => acc + (Number(v) || 0), 0);
        };

        const kpiAllZero =
          (metricsData?.totalRequests || 0) === 0 &&
          (metricsData?.pendingRequests || 0) === 0 &&
          (metricsData?.activeCollectors || 0) === 0;

        const chartsAllZero =
          sumDataset(pickupData) === 0 &&
          sumDataset(collectorData) === 0 &&
          sumDataset(wasteData) === 0;

        if (kpiAllZero && chartsAllZero) {
          warningMessages.push(
            'Dashboard data is empty. This usually means your user has no SELECT access due to Row Level Security (RLS) policies, or you are connected to a different Supabase project/environment.'
          );
        }

        if (warningMessages.length > 0) {
          setDataWarnings(warningMessages);
        }
        
        // Update all state with real data
        setStats(metricsData);
        setPickupStatusData(pickupData);
        setPickupVsBinsPieData(pieTotals);
        setBinsBreakdownData(binsBreakdown);
        setCollectorActivityData(collectorData);
        setWasteDistributionData(wasteData);
        setBagUtilizationData(bagData);
        setDumpingReportsData(dumpingData);
        setAlertsData(alerts);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Subscribe to real-time dashboard updates
    const subscription = subscribeToDashboardUpdates((dashboardData) => {
      if (dashboardData.metrics) setStats(dashboardData.metrics);
      if (dashboardData.pickupStatusData) setPickupStatusData(dashboardData.pickupStatusData);
      if (dashboardData.collectorActivityData) setCollectorActivityData(dashboardData.collectorActivityData);
      if (dashboardData.wasteDistributionData) setWasteDistributionData(dashboardData.wasteDistributionData);
      if (dashboardData.bagUtilizationData) setBagUtilizationData(dashboardData.bagUtilizationData);
      if (dashboardData.alerts) setAlertsData(dashboardData.alerts);
      if (dashboardData.dumpingReportsData) setDumpingReportsData(dashboardData.dumpingReportsData);
    });
    
    return () => {
      // Clean up subscription when component unmounts
      subscription.unsubscribe();
    };
  }, []);
  
  // Function to update chart data with real values
  const updateChartData = (dashboardData) => {
    // Update pickup status chart
    if (dashboardData.pickupStatusDistribution) {
      setPickupStatusData(prevData => ({
        ...prevData,
        datasets: [{
          ...prevData.datasets[0],
          data: [
            dashboardData.pickupStatusDistribution.completed || 0,
            dashboardData.pickupStatusDistribution.inProgress || 0,
            dashboardData.pickupStatusDistribution.pending || 0,
            dashboardData.pickupStatusDistribution.cancelled || 0
          ]
        }]
      }));
    }
    
    // Update collector activity chart
    if (dashboardData.collectorActivityDistribution) {
      setCollectorActivityData(prevData => ({
        ...prevData,
        datasets: [{
          ...prevData.datasets[0],
          data: [
            dashboardData.collectorActivityDistribution.active || 0,
            dashboardData.collectorActivityDistribution.idle || 0,
            dashboardData.collectorActivityDistribution.onBreak || 0,
            dashboardData.collectorActivityDistribution.offDuty || 0
          ]
        }]
      }));
    }
    
    // Update dumping reports chart
    if (dashboardData.dumpingReportsByDay) {
      setDumpingReportsData(prevData => ({
        ...prevData,
        datasets: [{
          ...prevData.datasets[0],
          data: dashboardData.dumpingReportsByDay
        }]
      }));
    }
    
    // Update bag utilization chart
    if (dashboardData.bagUtilizationTrend) {
      bagUtilizationData.datasets[0].data = dashboardData.bagUtilizationTrend.distributed || [];
      bagUtilizationData.datasets[1].data = dashboardData.bagUtilizationTrend.collected || [];
    }
    
    // Update waste distribution chart
    if (dashboardData.wasteDistribution) {
      wasteDistributionData.datasets[0].data = [
        dashboardData.wasteDistribution.recyclable || 0,
        dashboardData.wasteDistribution.organic || 0,
        dashboardData.wasteDistribution.hazardous || 0,
        dashboardData.wasteDistribution.electronic || 0,
        dashboardData.wasteDistribution.other || 0
      ];
    }
  };
  
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

  const chartHasData = (chartData) => {
    const datasets = chartData?.datasets;
    if (!Array.isArray(datasets) || datasets.length === 0) return false;
    return datasets.some(ds => Array.isArray(ds?.data) && ds.data.some(v => (Number(v) || 0) > 0));
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-600">Welcome to TrashDrop Management Portal</p>
      </div>

      {!loading && dataWarnings.length > 0 && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm font-medium text-yellow-800">Dashboard Notice</p>
          <ul className="mt-2 space-y-1">
            {dataWarnings.map((w, idx) => (
              <li key={idx} className="text-sm text-yellow-800">{w}</li>
            ))}
          </ul>
        </div>
      )}
      
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
                <span className="ml-2 text-sm" style={{ color: '#4CAF50' }}>
                  {stats.totalTrend}
                  {stats.totalTrend === 'N/A' && (
                    <span className="relative ml-1 inline-flex items-center text-gray-400 cursor-pointer group">
                      <i className="fas fa-info-circle" aria-hidden="true"></i>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                        N/A means the previous 7-day comparison period had 0 items, so a percentage change cannot be computed.
                      </span>
                    </span>
                  )}
                </span>
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
                <span className="ml-2 text-sm" style={{ color: '#dc3545' }}>
                  {stats.pendingTrend}
                  {stats.pendingTrend === 'N/A' && (
                    <span className="relative ml-1 inline-flex items-center text-gray-400 cursor-pointer group">
                      <i className="fas fa-info-circle" aria-hidden="true"></i>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                        N/A means the previous 7-day comparison period had 0 items, so a percentage change cannot be computed.
                      </span>
                    </span>
                  )}
                </span>
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
                <span className="ml-2 text-sm" style={{ color: '#4CAF50' }}>
                  {stats.slaComplianceTrend}
                  {stats.slaComplianceTrend === 'N/A' && (
                    <span className="relative ml-1 inline-flex items-center text-gray-400 cursor-pointer group">
                      <i className="fas fa-info-circle" aria-hidden="true"></i>
                      <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden w-64 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                        N/A means the previous 7-day comparison period had 0 items, so a percentage change cannot be computed.
                      </span>
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pickup Requests / Digital Bins (Bar-of-Pie) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Pickup Requests Status</h3>
          <div className="h-80">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <div className="h-full flex flex-col">
                  <div className="text-xs text-gray-500 mb-2">Click a slice to change the breakdown</div>
                  <div className="flex-1 min-h-0">
                    <Pie
                      data={pickupVsBinsPieData}
                      options={{
                        ...chartOptions,
                        plugins: {
                          ...chartOptions.plugins,
                          legend: { position: 'bottom' },
                        },
                        onClick: (_event, elements) => {
                          const idx = elements?.[0]?.index;
                          if (idx === 0) setBarOfPieSelection('pickup');
                          if (idx === 1) setBarOfPieSelection('bins');
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="h-full flex flex-col">
                  <div className="text-xs text-gray-500 mb-2">
                    Breakdown: {barOfPieSelection === 'pickup' ? 'Pickup Requests' : 'Digital Bins'}
                  </div>
                  <div className="flex-1 min-h-0">
                    {barOfPieSelection === 'pickup' ? (
                      chartHasData(pickupStatusData) ? (
                        <Bar
                          data={pickupStatusData}
                          options={{
                            ...chartOptions,
                            indexAxis: 'y',
                            plugins: {
                              ...chartOptions.plugins,
                              legend: { display: false },
                            },
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <p className="text-sm text-gray-500">No pickup status data available.</p>
                            <p className="mt-1 text-xs text-gray-400">This is usually RLS blocking `pickup_requests`.</p>
                          </div>
                        </div>
                      )
                    ) : chartHasData(binsBreakdownData) ? (
                      <Bar
                        data={binsBreakdownData}
                        options={{
                          ...chartOptions,
                          indexAxis: 'y',
                          plugins: {
                            ...chartOptions.plugins,
                            legend: { display: false },
                          },
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">No digital bins data available.</p>
                          <p className="mt-1 text-xs text-gray-400">This is usually RLS blocking `digital_bins`.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Collector Activity (Pie Chart) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Collector Activity</h3>
          <div className="h-80 flex items-center justify-center">
            {loading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
            ) : chartHasData(collectorActivityData) ? (
              <Pie options={chartOptions} data={collectorActivityData} />
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500">No chart data available.</p>
                <p className="mt-1 text-xs text-gray-400">If you expect data, check dashboard views and RLS policies.</p>
              </div>
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
            ) : chartHasData(wasteDistributionData) ? (
              <Doughnut options={wasteChartOptions} data={wasteDistributionData} />
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-500">No chart data available.</p>
                <p className="mt-1 text-xs text-gray-400">If you expect data, check dashboard views and RLS policies.</p>
              </div>
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
              <div className="h-full flex flex-col">
                <div className="flex-1 min-h-0">
                  <Bar
                    options={{
                      ...chartOptions,
                      scales: {
                        x: {
                          ticks: {
                            display: true,
                            autoSkip: true,
                            maxTicksLimit: 12,
                            minRotation: 45,
                            maxRotation: 45,
                          },
                        },
                      },
                    }}
                    data={dumpingReportsData}
                  />
                </div>
                {!chartHasData(dumpingReportsData) && (
                  <div className="mt-2 text-xs text-gray-400">No dumping reports in the current 7-day window.</div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Bag Utilization Trend (Line Chart) */}
        <div className="bg-white rounded-lg shadow-sm border-0 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Bag Utilization Trend</h3>
          <div className="h-80">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : chartHasData(bagUtilizationData) ? (
              <Line options={chartOptions} data={bagUtilizationData} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm text-gray-500">No chart data available.</p>
                  <p className="mt-1 text-xs text-gray-400">If you expect data, check dashboard views and RLS policies.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Alerts & Activity Section */}
      <div className="bg-white rounded-lg shadow-sm border-0 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Alerts & Activity</h3>
          <button
            className="text-sm text-primary hover:underline"
            onClick={() => navigate('/request-pickup/alerts')}
          >
            View All
          </button>
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
        ) : alertsData.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {alertsData.map((alert) => {
              // Determine icon and colors based on alert type
              let icon = 'info-circle';
              let iconColor = '#2196F3';
              let bgColor = 'rgba(33, 150, 243, 0.1)';
              let statusText = 'Info';
              
              switch(alert.type.toLowerCase()) {
                case 'critical':
                  icon = 'exclamation-triangle';
                  iconColor = '#dc3545';
                  bgColor = 'rgba(220, 53, 69, 0.1)';
                  statusText = 'Critical';
                  break;
                case 'success':
                  icon = 'check-circle';
                  iconColor = '#4CAF50';
                  bgColor = 'rgba(76, 175, 80, 0.1)';
                  statusText = 'Success';
                  break;
                case 'warning':
                  icon = 'exclamation-circle';
                  iconColor = '#FFC107';
                  bgColor = 'rgba(255, 193, 7, 0.1)';
                  statusText = 'Warning';
                  break;
                case 'new':
                  icon = 'plus-circle';
                  iconColor = '#2196F3';
                  bgColor = 'rgba(33, 150, 243, 0.1)';
                  statusText = 'New';
                  break;
                case 'report':
                  icon = 'map-marker-alt';
                  iconColor = '#9C27B0';
                  bgColor = 'rgba(156, 39, 176, 0.1)';
                  statusText = 'Report';
                  break;
                default:
                  icon = 'info-circle';
                  iconColor = '#2196F3';
                  bgColor = 'rgba(33, 150, 243, 0.1)';
                  statusText = 'Info';
              }
              
              return (
                <li key={alert.id} className={`py-3 flex items-center hover:bg-gray-50 transition-colors rounded-md px-2 ${!alert.read ? 'bg-blue-50' : ''}`}>
                  <div className="rounded-full p-2 mr-3" style={{ backgroundColor: bgColor }}>
                    <i className={`fas fa-${icon}`} style={{ color: iconColor }}></i>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                      <span 
                        className="text-xs font-medium px-2 py-1 rounded-full capitalize" 
                        style={{ backgroundColor: bgColor, color: iconColor }}
                      >
                        {statusText}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {alert.created_at} - {alert.creator ? `by ${alert.creator}` : 'System'}
                    </p>
                    {alert.description && (
                      <p className="text-xs text-gray-600 mt-1">{alert.description}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="text-center py-6">
            <i className="far fa-bell-slash text-gray-300 text-3xl mb-2"></i>
            <p className="text-gray-500">No recent alerts</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
