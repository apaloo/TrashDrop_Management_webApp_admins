import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';

// ─── Animated Counter Hook ────────────────────────────────────────────────────
const useCountUp = (end, duration = 2000, startOnView = true) => {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef(null);

  const start = useCallback(() => setStarted(true), []);

  useEffect(() => {
    if (!startOnView || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { start(); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [start, startOnView]);

  useEffect(() => {
    if (!started) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [started, end, duration]);

  return { count, ref };
};

// ─── Sample dump cluster data (Accra, Ghana) ─────────────────────────────────
const DUMP_CLUSTERS = [
  { id: 1, lat: 5.6037, lng: -0.1870, reports: 47, waste: 'Mixed Waste', risk: 'High', lastReport: '2 hours ago' },
  { id: 2, lat: 5.6350, lng: -0.1650, reports: 23, waste: 'Plastic', risk: 'Medium', lastReport: '5 hours ago' },
  { id: 3, lat: 5.5700, lng: -0.2100, reports: 61, waste: 'Hazardous', risk: 'Critical', lastReport: '30 min ago' },
  { id: 4, lat: 5.5950, lng: -0.2300, reports: 15, waste: 'Organic', risk: 'Low', lastReport: '1 day ago' },
  { id: 5, lat: 5.6500, lng: -0.1300, reports: 34, waste: 'E-Waste', risk: 'High', lastReport: '3 hours ago' },
  { id: 6, lat: 5.5500, lng: -0.1900, reports: 28, waste: 'Construction', risk: 'Medium', lastReport: '8 hours ago' },
  { id: 7, lat: 5.6200, lng: -0.2500, reports: 52, waste: 'Mixed Waste', risk: 'High', lastReport: '1 hour ago' },
  { id: 8, lat: 5.5800, lng: -0.1400, reports: 9, waste: 'Plastic', risk: 'Low', lastReport: '2 days ago' },
  { id: 9, lat: 5.6100, lng: -0.2000, reports: 38, waste: 'Organic', risk: 'Medium', lastReport: '4 hours ago' },
  { id: 10, lat: 5.6400, lng: -0.2200, reports: 19, waste: 'Hazardous', risk: 'High', lastReport: '6 hours ago' },
];

const RISK_COLORS = {
  Critical: '#dc2626',
  High: '#ea580c',
  Medium: '#eab308',
  Low: '#22c55e',
};

// ─── Map auto-fit component ───────────────────────────────────────────────────
const MapAutoFit = ({ clusters }) => {
  const map = useMap();
  useEffect(() => {
    if (clusters.length === 0) return;
    const bounds = L.latLngBounds(clusters.map(c => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, clusters]);
  return null;
};

// ─── Navbar ───────────────────────────────────────────────────────────────────
const HomeNavbar = ({ isAuthenticated }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[1500] transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3 group">
            <img src="/logo.svg" alt="TrashDrop" className="h-10 w-10 md:h-12 md:w-12 transition-transform group-hover:scale-105" />
            <span className={`text-xl md:text-2xl font-bold transition-colors ${scrolled ? 'text-gray-900' : 'text-white'}`}>
              Trash<span className="text-green-500">Drop</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#map" className={`text-sm font-medium transition-colors hover:text-green-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
              Live Map
            </a>
            <a href="#insights" className={`text-sm font-medium transition-colors hover:text-green-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
              Insights
            </a>
            <a href="#pathways" className={`text-sm font-medium transition-colors hover:text-green-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
              Get Involved
            </a>
            <a href="#pricing" className={`text-sm font-medium transition-colors hover:text-green-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
              Pricing
            </a>
            <a href="#impact" className={`text-sm font-medium transition-colors hover:text-green-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
              Impact
            </a>
            <a href="#partners" className={`text-sm font-medium transition-colors hover:text-green-500 ${scrolled ? 'text-gray-700' : 'text-white/90'}`}>
              Partners
            </a>
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {isAuthenticated ? (
              <Link to="/dashboard" className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-600/25 hover:shadow-green-600/40">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${scrolled ? 'text-gray-700 hover:text-green-600' : 'text-white hover:text-green-300'}`}>
                  Sign In
                </Link>
                <Link to="/signup" className="px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-600/25 hover:shadow-green-600/40">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-lg">
            <i className={`fas ${mobileOpen ? 'fa-times' : 'fa-bars'} text-lg ${scrolled ? 'text-gray-700' : 'text-white'}`}></i>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white rounded-xl shadow-2xl mt-2 p-4 space-y-3 border border-gray-100 animate-fadeIn">
            <a href="#map" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium">Live Map</a>
            <a href="#insights" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium">Insights</a>
            <a href="#pathways" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium">Get Involved</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium">Pricing</a>
            <a href="#impact" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium">Impact</a>
            <a href="#partners" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium">Partners</a>
            <hr className="border-gray-200" />
            {isAuthenticated ? (
              <Link to="/dashboard" className="block px-4 py-2.5 bg-green-600 text-white text-center rounded-lg text-sm font-semibold">Go to Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="block px-4 py-2.5 text-gray-700 hover:bg-green-50 rounded-lg text-sm font-medium text-center">Sign In</Link>
                <Link to="/signup" className="block px-4 py-2.5 bg-green-600 text-white text-center rounded-lg text-sm font-semibold">Get Started</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

const HERO_STATS = [
  {
    title: 'Active Reports',
    value: '1,247',
    change: '+12% this month',
    icon: 'fa-exclamation-circle',
    iconBg: 'bg-red-500/20',
    iconColor: 'text-red-400',
  },
  {
    title: 'Cleanups Done',
    value: '892',
    change: '+8% this month',
    icon: 'fa-check-circle',
    iconBg: 'bg-green-500/20',
    iconColor: 'text-green-400',
  },
  {
    title: 'Active Communities',
    value: '156',
    change: '+24% this quarter',
    icon: 'fa-users',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-300',
  },
];

const StatsCard = ({ title, value, change, icon, iconBg, iconColor, className = '' }) => (
  <div
    className={`bg-slate-900/70 border border-white/10 backdrop-blur-[12px] rounded-2xl p-5 shadow-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-green-600/30 ${className}`}
  >
    <div className="flex items-center space-x-3 mb-4">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center`}>
        <i className={`fas ${icon} ${iconColor}`}></i>
      </div>
      <span className="text-white/70 text-sm font-medium tracking-wide">{title}</span>
    </div>
    <p className="text-3xl font-bold text-white">{value}</p>
    <p className="text-xs text-green-300 mt-2">{change}</p>
  </div>
);

// ─── Hero Section ─────────────────────────────────────────────────────────────
const HeroSection = ({ isAuthenticated }) => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen sm:min-h-[90vh] flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="/images/gradient-background.jpg"
          alt="Emerald gradient backdrop"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-emerald-900/60 to-black/50"></div>
      </div>

      {/* Animated grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
        backgroundSize: '40px 40px',
      }}></div>

      {/* Floating accent circles */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

      {/* Watermark text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <p
          className="text-white/5 text-4xl sm:text-6xl lg:text-7xl tracking-[0.4em] text-center leading-tight px-4"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          COLLECTING WASTE MADE EASY
        </p>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12 sm:pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column - text */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-semibold mb-6 tracking-wide">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
              REAL-TIME ENVIRONMENTAL INTELLIGENCE
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-white leading-tight mb-4 sm:mb-6">
              Track. Report.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                Eliminate
              </span>{' '}
              Illegal Dumping.
            </h1>

            <p className="text-base sm:text-lg xl:text-xl text-gray-300 mb-8 sm:mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              TrashDrop empowers communities, cities, and environmental agencies to detect, report, and eliminate
              illegal waste dumping using real-time mapping and data intelligence.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start flex-wrap">
              <a
                href="#map"
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-green-500 text-white font-semibold rounded-xl hover:bg-green-600 transition-all shadow-xl shadow-green-500/30 hover:shadow-green-500/50 hover:-translate-y-0.5"
              >
                <i className="fas fa-map-marked-alt mr-3 text-green-200 group-hover:text-white transition-colors"></i>
                View Illegal Dump Map
              </a>
              <button
                onClick={() => {
                  if (isAuthenticated) {
                    navigate('/illegal-dumping/reports');
                  } else {
                    navigate('/signup');
                  }
                }}
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-yellow-400 text-emerald-900 font-semibold rounded-xl border border-yellow-300/60 hover:bg-yellow-300 transition-all hover:-translate-y-0.5 shadow-lg shadow-yellow-500/30"
              >
                <i className="fas fa-exclamation-triangle mr-3 text-emerald-900"></i>
                Report Illegal Dump
              </button>
              <a
                href="#partners"
                className="group inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 text-green-400 font-semibold rounded-xl border border-green-500/30 hover:bg-green-500/10 transition-all hover:-translate-y-0.5"
              >
                <i className="fas fa-handshake mr-3"></i>
                Partner with Us
              </a>
            </div>
          </div>

          {/* Right column - floating stat cards */}
          <div className="hidden lg:block relative">
            <div className="relative h-[420px]">
              <StatsCard {...HERO_STATS[0]} className="absolute top-0 right-0 w-64" />
              <StatsCard {...HERO_STATS[1]} className="absolute top-36 left-0 w-64" />
              <StatsCard {...HERO_STATS[2]} className="absolute bottom-0 right-10 w-64" />
            </div>
          </div>
        </div>

        {/* Mobile / tablet stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 lg:hidden">
          {HERO_STATS.map((stat) => (
            <StatsCard key={stat.title} {...stat} />
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <a href="#map" className="text-white/50 hover:text-white/80 transition-colors">
          <i className="fas fa-chevron-down text-2xl"></i>
        </a>
      </div>
    </section>
  );
};

// ─── Public Map Preview ───────────────────────────────────────────────────────
const MapPreviewSection = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handleRestrictedAction = () => {
    if (!isAuthenticated) {
      setShowLoginPrompt(true);
      setTimeout(() => setShowLoginPrompt(false), 4000);
    } else {
      navigate('/illegal-dumping/map');
    }
  };

  return (
    <section id="map" className="relative bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full mb-4 tracking-wide">
            PUBLIC PREVIEW
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Illegal Dumping <span className="text-green-600">Live Map</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore reported illegal dumping hotspots across the Greater Accra Region. Zoom in to see cluster details.
          </p>
        </div>

        {/* Map container */}
        <div className="relative rounded-[32px] overflow-hidden shadow-2xl border border-gray-200 bg-gray-900">
          <div className="h-[65vh] sm:h-[70vh] lg:h-[80vh]">
            <MapContainer
              center={[5.6037, -0.1870]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapAutoFit clusters={DUMP_CLUSTERS} />
              {DUMP_CLUSTERS.map((cluster) => (
                <CircleMarker
                  key={cluster.id}
                  center={[cluster.lat, cluster.lng]}
                  radius={Math.max(10, Math.sqrt(cluster.reports) * 4)}
                  pathOptions={{
                    fillColor: RISK_COLORS[cluster.risk] || '#eab308',
                    color: RISK_COLORS[cluster.risk] || '#eab308',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.35,
                  }}
                >
                  <Popup>
                    <div className="text-sm min-w-[180px]">
                      <p className="font-bold text-gray-800 mb-1">{cluster.reports} Reports</p>
                      <p className="text-gray-600"><strong>Waste:</strong> {cluster.waste}</p>
                      <p className="text-gray-600"><strong>Risk:</strong> <span style={{ color: RISK_COLORS[cluster.risk] }}>{cluster.risk}</span></p>
                      <p className="text-gray-500 text-xs mt-1">Last report: {cluster.lastReport}</p>
                      <button
                        onClick={handleRestrictedAction}
                        className="mt-2 w-full px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                      >
                        {isAuthenticated ? 'View Full Details' : 'Login for Details'}
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Map overlay legend */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200 z-[1100]">
            <p className="text-xs font-semibold text-gray-700 mb-2">Risk Level</p>
            <div className="space-y-1.5">
              {Object.entries(RISK_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Full map CTA overlay */}
          <div className="absolute top-4 right-4 z-[1100]">
            <button
              onClick={handleRestrictedAction}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow-lg hover:bg-green-700 transition-all flex items-center space-x-2"
            >
              <i className="fas fa-expand-arrows-alt"></i>
              <span>Full Analytics Map</span>
            </button>
          </div>

          {/* Login prompt toast */}
          {showLoginPrompt && (
            <div className="absolute top-16 right-4 z-[1100] bg-white rounded-xl shadow-2xl p-4 border border-gray-200 max-w-xs animate-slideIn">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-lock text-green-600 text-sm"></i>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Login Required</p>
                  <p className="text-xs text-gray-500 mt-0.5">Please login or create an account to access full TrashDrop analytics.</p>
                  <div className="flex space-x-2 mt-2">
                    <Link to="/login" className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700">Sign In</Link>
                    <Link to="/signup" className="px-3 py-1 border border-green-600 text-green-600 text-xs rounded-md hover:bg-green-50">Sign Up</Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map stats bar */}
        <div className="relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 lg:mt-12">
            {[
              { label: 'Total Reports', value: '326', icon: 'fa-file-alt', color: 'text-blue-600 bg-blue-100' },
              { label: 'Hotspot Zones', value: '10', icon: 'fa-map-pin', color: 'text-red-600 bg-red-100' },
              { label: 'Cleanup Rate', value: '71%', icon: 'fa-broom', color: 'text-green-600 bg-green-100' },
              { label: 'Avg Response', value: '4.2h', icon: 'fa-clock', color: 'text-purple-600 bg-purple-100' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center space-x-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <i className={`fas ${stat.icon} text-base`}></i>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Dashboard Preview (Locked Mode) ─────────────────────────────────────────
const DashboardPreviewSection = ({ isAuthenticated }) => {
  const navigate = useNavigate();

  const handleUnlock = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  const widgets = [
    { title: 'Reports Today', value: '24', change: '+6', icon: 'fa-file-alt', color: 'from-blue-500 to-blue-600' },
    { title: 'Total Waste Identified', value: '1.2K tons', change: '+180', icon: 'fa-weight-hanging', color: 'from-orange-500 to-orange-600' },
    { title: 'Cleanup Progress', value: '71%', change: '+5%', icon: 'fa-tasks', color: 'from-green-500 to-green-600' },
    { title: 'Recycling vs Landfill', value: '51%', change: '+3%', icon: 'fa-recycle', color: 'from-teal-500 to-teal-600' },
  ];

  return (
    <section id="insights" className="py-20 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full mb-4 tracking-wide">
            CITY WASTE INSIGHTS
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Data-Driven <span className="text-green-600">Decision Making</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real-time dashboards and analytics to monitor waste management operations across all zones.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {widgets.map((w) => (
            <div key={w.title} className="bg-white rounded-xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${w.color} flex items-center justify-center shadow-lg`}>
                  <i className={`fas ${w.icon} text-white`}></i>
                </div>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {w.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{w.value}</p>
              <p className="text-sm text-gray-500 mt-1">{w.title}</p>
            </div>
          ))}
        </div>

        {/* Charts preview (blurred / locked) */}
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
          <div className="grid md:grid-cols-3 gap-0 bg-gray-50">
            {/* Fake chart areas */}
            {[
              { title: 'Monthly Waste Reports', type: 'bar' },
              { title: 'Waste Type Breakdown', type: 'pie' },
              { title: 'Cleanup Efficiency Trend', type: 'line' },
            ].map((chart) => (
              <div key={chart.title} className="p-6 border-r border-gray-200 last:border-r-0">
                <p className="text-sm font-semibold text-gray-700 mb-3">{chart.title}</p>
                <div className="h-40 bg-gradient-to-t from-gray-100 to-gray-50 rounded-lg flex items-end justify-center space-x-2 p-4">
                  {chart.type === 'bar' && (
                    <>
                      {[60, 80, 45, 90, 70, 55, 85].map((h, i) => (
                        <div key={i} className="w-6 rounded-t-md bg-gradient-to-t from-green-500 to-green-400 opacity-60" style={{ height: `${h}%` }}></div>
                      ))}
                    </>
                  )}
                  {chart.type === 'pie' && (
                    <div className="w-28 h-28 rounded-full border-8 border-green-400 border-t-orange-400 border-r-blue-400 opacity-60"></div>
                  )}
                  {chart.type === 'line' && (
                    <svg viewBox="0 0 200 80" className="w-full h-full opacity-60">
                      <polyline fill="none" stroke="#22c55e" strokeWidth="3" points="0,60 30,45 60,50 90,30 120,35 150,20 180,25 200,15" />
                      <polyline fill="none" stroke="#22c55e" strokeWidth="1" strokeDasharray="4" points="0,60 200,15" opacity="0.3" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Lock overlay */}
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-lock text-green-600 text-2xl"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Full Dashboard Access</h3>
              <p className="text-sm text-gray-500 mb-4 max-w-sm">Sign in to access detailed analytics, real-time charts, and custom reports.</p>
              <button
                onClick={handleUnlock}
                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/25"
              >
                {isAuthenticated ? 'Open Dashboard' : 'Sign In to Unlock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Participation Pathways ───────────────────────────────────────────────────
const PathwaysSection = () => {
  const pathways = [
    {
      title: 'Citizens & Communities',
      icon: 'fa-users',
      color: 'from-green-500 to-emerald-600',
      features: [
        'Report illegal dumping in real-time',
        'Track environmental impact in your area',
        'Participate in community cleanup events',
        'Earn recognition for contributions',
      ],
      cta: 'Join as Community Reporter',
      link: '/signup',
    },
    {
      title: 'Municipal Authorities (MMDA)',
      icon: 'fa-landmark',
      color: 'from-blue-500 to-indigo-600',
      features: [
        'Monitor illegal dumping hotspots',
        'Assign and dispatch cleanup teams',
        'Track enforcement actions and outcomes',
        'Generate compliance reports',
      ],
      cta: 'Register as Environmental Officer',
      link: '/signup',
      popular: true,
    },
    {
      title: 'Waste Management Operators',
      icon: 'fa-truck-loading',
      color: 'from-orange-500 to-amber-600',
      features: [
        'Manage bins and collection points',
        'Optimize waste collection routes',
        'Track operational performance KPIs',
        'Real-time fleet and schedule management',
      ],
      cta: 'Register as Waste Operator',
      link: '/signup',
    },
  ];

  return (
    <section id="pathways" className="py-20 bg-gray-50 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-green-100 rounded-full opacity-30 -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100 rounded-full opacity-30 translate-y-1/2 -translate-x-1/2 blur-3xl"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block px-4 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full mb-4 tracking-wide">
            GET INVOLVED
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Choose Your <span className="text-green-600">Pathway</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Whether you're a citizen, government official, or waste operator, TrashDrop has tools designed specifically for you.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {pathways.map((p) => (
            <div key={p.title} className={`relative bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-2xl transition-all hover:-translate-y-1 ${p.popular ? 'ring-2 ring-green-500' : ''}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-green-600 text-white text-xs font-bold rounded-full shadow-lg">
                  MOST POPULAR
                </div>
              )}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center shadow-lg mb-6`}>
                <i className={`fas ${p.icon} text-white text-xl`}></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">{p.title}</h3>
              <ul className="space-y-3 mb-8">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start text-sm text-gray-600">
                    <i className="fas fa-check-circle text-green-500 mr-2 mt-0.5 flex-shrink-0"></i>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={p.link}
                className={`block text-center px-6 py-3 font-semibold rounded-xl transition-all ${
                  p.popular
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-600/25'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Single Impact Stat Card (hook-safe) ──────────────────────────────────────
const ImpactStatCard = ({ label, value, suffix, icon, color }) => {
  const { count, ref } = useCountUp(value, 2500);
  return (
    <div ref={ref} className="text-center group">
      <div className={`w-16 h-16 mx-auto rounded-2xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
        <i className={`fas ${icon} text-xl`}></i>
      </div>
      <p className="text-4xl sm:text-5xl font-extrabold mb-2">
        {count.toLocaleString()}{suffix && <span className="text-green-400 text-2xl">{suffix}</span>}
      </p>
      <p className="text-sm text-gray-400 font-medium">{label}</p>
    </div>
  );
};

// ─── Environmental Impact Section ─────────────────────────────────────────────
const IMPACT_STATS = [
  { label: 'Illegal Dumps Reported', value: 12470, suffix: '+', icon: 'fa-flag', color: 'text-red-600 bg-red-100' },
  { label: 'Tonnes Waste Removed', value: 3850, suffix: '+', icon: 'fa-dumpster', color: 'text-green-600 bg-green-100' },
  { label: 'Carbon Emissions Prevented', value: 940, suffix: 't CO₂', icon: 'fa-leaf', color: 'text-emerald-600 bg-emerald-100' },
  { label: 'Active Communities', value: 156, suffix: '', icon: 'fa-users', color: 'text-blue-600 bg-blue-100' },
];

const ImpactSection = () => (
  <section id="impact" className="py-20 bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 text-white relative overflow-hidden">
    <div className="absolute inset-0 opacity-5" style={{
      backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)`,
      backgroundSize: '32px 32px',
    }}></div>

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <span className="inline-block px-4 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full mb-4 tracking-wide border border-green-500/20">
          ENVIRONMENTAL IMPACT
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">
          Making a <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">Real Difference</span>
        </h2>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto">
          Every report, every cleanup, every community action adds up to meaningful environmental change.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {IMPACT_STATS.map((stat) => (
          <ImpactStatCard key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  </section>
);

// ─── How It Works Section (inspired by tracking flyer) ───────────────────────
const HowItWorksSection = () => (
  <section className="py-12 sm:py-20 bg-gradient-to-b from-blue-50 via-white to-green-50 relative overflow-hidden">
    {/* Decorative dots */}
    <div className="absolute top-8 right-8 grid grid-cols-5 gap-2 opacity-20">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="w-2 h-2 rounded-full bg-green-500"></div>
      ))}
    </div>
    <div className="absolute bottom-8 left-8 grid grid-cols-5 gap-2 opacity-20">
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="w-2 h-2 rounded-full bg-blue-400"></div>
      ))}
    </div>

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center mb-16">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 mb-3 sm:mb-4 leading-tight">
          What happens to your waste<br />after it leaves your home?
        </h2>
        <div className="inline-block mt-4">
          <div className="bg-green-600 text-white px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-base sm:text-lg font-semibold shadow-lg shadow-green-600/30">
            With TrashDrop, you don't have to guess.
          </div>
        </div>
      </div>

      {/* Tracking Flow - 3 Steps */}
      <div className="grid md:grid-cols-3 gap-6 sm:gap-8 lg:gap-12 mb-12 sm:mb-16">
        {/* Step 1 - QR Tagged Bag */}
        <div className="relative group">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-1 text-center h-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-blue-100 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <i className="fas fa-qrcode text-2xl sm:text-3xl text-blue-600"></i>
            </div>
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center shadow-lg">1</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">QR-Tagged Bag</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Every bag is tagged with a unique QR code, creating a digital identity for your waste from the moment it leaves your doorstep.</p>
          </div>
          {/* Arrow connector (hidden on mobile) */}
          <div className="hidden md:flex absolute top-1/2 -right-6 lg:-right-8 w-10 items-center z-10">
            <div className="w-full border-t-2 border-dashed border-green-400"></div>
            <i className="fas fa-chevron-right text-green-500 -ml-1"></i>
          </div>
        </div>

        {/* Step 2 - Tracked Pickup */}
        <div className="relative group">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-1 text-center h-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-green-100 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <i className="fas fa-truck text-2xl sm:text-3xl text-green-600"></i>
            </div>
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center shadow-lg">2</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">Tracked Pickup</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Our verified collectors scan and pick up your waste. Track the real-time location and status of your bag on the TrashDrop app.</p>
          </div>
          {/* Arrow connector (hidden on mobile) */}
          <div className="hidden md:flex absolute top-1/2 -right-6 lg:-right-8 w-10 items-center z-10">
            <div className="w-full border-t-2 border-dashed border-green-400"></div>
            <i className="fas fa-chevron-right text-green-500 -ml-1"></i>
          </div>
        </div>

        {/* Step 3 - Verified Landfill */}
        <div className="relative group">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all hover:-translate-y-1 text-center h-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
              <i className="fas fa-map-marked-alt text-2xl sm:text-3xl text-emerald-600"></i>
            </div>
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-600 text-white text-xs sm:text-sm font-bold flex items-center justify-center shadow-lg">3</div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3">Verified Landfill</h3>
            <p className="text-sm text-gray-600 leading-relaxed">Waste arrives at a legally mapped, verified disposal site. You get confirmation that your waste was properly handled.</p>
          </div>
        </div>
      </div>

      {/* Key Promises */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8 lg:p-10 max-w-4xl mx-auto">
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="fas fa-check text-green-600 text-sm"></i>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed">
              <strong className="text-gray-900">Every bag is tagged with a QR code</strong>, tracked from your doorstep to verified disposal sites.
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="fas fa-check text-green-600 text-sm"></i>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed">
              <strong className="text-gray-900">Our collectors are verified</strong>, and waste can only be disposed at legally mapped landfills.
            </p>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="fas fa-check text-green-600 text-sm"></i>
            </div>
            <p className="text-gray-700 text-lg leading-relaxed">
              <strong className="text-gray-900">No shortcuts. No dumping. No guesswork.</strong>
            </p>
          </div>
        </div>
        <div className="text-center mt-10 pt-8 border-t border-gray-100">
          <p className="text-2xl font-bold text-gray-900 mb-1">
            TrashDrop — <span className="text-green-600">Waste you can track.</span>
          </p>
          <p className="text-lg text-gray-500 font-medium">From doorstep to landfill.</p>
        </div>
      </div>
    </div>
  </section>
);

// ─── How It Works Section (Two Services) ────────────────────────────────────
const DigitalBinSection = () => (
  <section id="services" className="relative overflow-hidden bg-[#f5f2eb]">
    {/* Paper texture overlay */}
    <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='t'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23t)' opacity='0.035'/%3E%3C/svg%3E")`,
    }}></div>

    {/* Background decorative elements */}
    <div className="absolute -top-20 -right-20 w-[500px] h-[500px] rounded-full bg-[#1b6e35]/5 blur-3xl pointer-events-none"></div>
    <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full bg-[#b4e043]/5 blur-3xl pointer-events-none"></div>
    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
      backgroundImage: `linear-gradient(#1b6e35 1px, transparent 1px), linear-gradient(90deg, #1b6e35 1px, transparent 1px)`,
      backgroundSize: '48px 48px',
    }}></div>

    <style>{`
      @keyframes fadeSlide {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes cardReveal1 {
        from { opacity: 0; transform: translateY(28px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes cardReveal2 {
        from { opacity: 0; transform: translateY(28px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .animate-fadeSlide { animation: fadeSlide 0.8s ease 0.2s forwards; }
      .animate-cardReveal1 { animation: cardReveal1 0.9s cubic-bezier(0.22,1,0.36,1) 0.65s forwards; }
      .animate-cardReveal2 { animation: cardReveal2 0.9s cubic-bezier(0.22,1,0.36,1) 0.85s forwards; }
    `}</style>

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      {/* Header */}
      <div className="flex items-center justify-end mb-6">
        <span className="text-[10px] sm:text-[10.5px] font-bold tracking-[3px] sm:tracking-[3.5px] text-[#6b7565] uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>
          How it works
        </span>
      </div>

      {/* Hero Headline */}
      <h2 className="text-3xl sm:text-4xl lg:text-[clamp(44px,5.5vw,68px)] leading-[0.95] text-[#111a13] tracking-[-1.5px] mb-4 opacity-0 animate-fadeSlide" style={{ fontFamily: "'DM Serif Display', serif" }}>
        Two ways to <em className="text-[#1b6e35] not-italic font-serif italic">drop</em> your waste.<br className="hidden sm:block" />
        <span className="sm:ml-0">Zero excuses.</span>
      </h2>

      <p className="text-sm sm:text-[15px] text-[#6b7565] max-w-2xl leading-relaxed mb-10 lg:mb-14 opacity-0 animate-fadeSlide" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300, animationDelay: '0.45s' }}>
        TrashDrop offers two flexible services built for how you actually live — whether you prefer a planned system or spontaneous on-demand pickup.
      </p>

      {/* Services Grid */}
      <div className="grid md:grid-cols-2 gap-4 lg:gap-6">
        {/* SERVICE 1: QR BAG SYSTEM */}
        <div className="relative rounded-[18px] p-6 sm:p-8 lg:p-11 bg-[#111a13] overflow-hidden group hover:shadow-2xl transition-shadow duration-500 opacity-0 animate-cardReveal1">
          {/* Inner glow */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#b4e043]/10 blur-3xl pointer-events-none"></div>
          {/* Large number */}
          <span className="absolute top-4 right-7 text-[100px] leading-none font-serif italic text-white/[0.06] pointer-events-none" style={{ fontFamily: "'DM Serif Display', serif" }}>01</span>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#b4e043]/[0.15] border border-[#b4e043]/[0.3] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#b4e043]"></span>
            <span className="text-[10px] font-bold tracking-[3px] text-[#b4e043] uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>Service One</span>
          </div>

          {/* Title */}
          <h3 className="text-2xl sm:text-[clamp(28px,3.2vw,40px)] text-white leading-[1.05] tracking-[-0.5px] mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
            The QR<br /><em className="text-[#b4e043] italic">Bag System</em>
          </h3>
          <p className="text-[11px] font-semibold tracking-[2px] text-[#b4e043] uppercase mb-5" style={{ fontFamily: "'Syne', sans-serif" }}>Buy · Scan · Collect</p>

          {/* Divider */}
          <div className="w-10 h-[2px] bg-[#b4e043] rounded-full mb-5"></div>

          {/* Steps */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-[#b4e043]/[0.18] border border-[#b4e043]/[0.35] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#b4e043]" style={{ fontFamily: "'Syne', sans-serif" }}>1</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#b4e043] mb-[3px] tracking-[0.5px]" style={{ fontFamily: "'Syne', sans-serif" }}>Purchase Official Bags</p>
                <p className="text-sm text-white/60 leading-[1.65]" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>Buy TrashDrop bags from any authorised vendor near you.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-[#b4e043]/[0.18] border border-[#b4e043]/[0.35] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#b4e043]" style={{ fontFamily: "'Syne', sans-serif" }}>2</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#b4e043] mb-[3px] tracking-[0.5px]" style={{ fontFamily: "'Syne', sans-serif" }}>Scan the QR Code</p>
                <p className="text-sm text-white/60 leading-[1.65]" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>Each bundle has a unique batch QR code. Scan to activate and link to your account.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-[#b4e043]/[0.18] border border-[#b4e043]/[0.35] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[#b4e043]" style={{ fontFamily: "'Syne', sans-serif" }}>3</span>
              </div>
              <div>
                <p className="text-xs font-bold text-[#b4e043] mb-[3px] tracking-[0.5px]" style={{ fontFamily: "'Syne', sans-serif" }}>Request Free Collection</p>
                <p className="text-sm text-white/60 leading-[1.65]" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>When your bag is full, tap to request pickup — collection is completely free.</p>
              </div>
            </div>
          </div>

          {/* Highlight */}
          <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-[#b4e043] text-[#111a13] rounded-lg text-xs font-bold tracking-[1px]" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span>✦</span>
            Collection is FREE
          </div>
        </div>

        {/* SERVICE 2: DIGITAL BIN */}
        <div className="relative rounded-[18px] p-6 sm:p-8 lg:p-11 bg-[#1b6e35] overflow-hidden group hover:shadow-2xl transition-shadow duration-500 opacity-0 animate-cardReveal2">
          {/* Inner glow */}
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
          {/* Large number */}
          <span className="absolute top-4 right-7 text-[100px] leading-none font-serif italic text-white/[0.06] pointer-events-none" style={{ fontFamily: "'DM Serif Display', serif" }}>02</span>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.15] border border-white/[0.3] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            <span className="text-[10px] font-bold tracking-[3px] text-white uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>Service Two</span>
          </div>

          {/* Title */}
          <h3 className="text-2xl sm:text-[clamp(28px,3.2vw,40px)] text-white leading-[1.05] tracking-[-0.5px] mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
            The Digital<br /><em className="text-white/90 italic">Bin Service</em>
          </h3>
          <p className="text-[11px] font-semibold tracking-[2px] text-white/60 uppercase mb-5" style={{ fontFamily: "'Syne', sans-serif" }}>Request · Quote · Track</p>

          {/* Divider */}
          <div className="w-10 h-[2px] bg-white/40 rounded-full mb-5"></div>

          {/* Steps */}
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-white/[0.18] border border-white/[0.3] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>1</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white/90 mb-[3px] tracking-[0.5px]" style={{ fontFamily: "'Syne', sans-serif" }}>Request On-Demand Pickup</p>
                <p className="text-sm text-white/70 leading-[1.65]" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>Open the app and submit a Request Bin Pickup (No Bag) anytime, anywhere.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-white/[0.18] border border-white/[0.3] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>2</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white/90 mb-[3px] tracking-[0.5px]" style={{ fontFamily: "'Syne', sans-serif" }}>Instant GPS Price Quote</p>
                <p className="text-sm text-white/70 leading-[1.65]" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>Receive a transparent, GPS-based price quote instantly — no surprises.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-white/[0.18] border border-white/[0.3] flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-white" style={{ fontFamily: "'Syne', sans-serif" }}>3</span>
              </div>
              <div>
                <p className="text-xs font-bold text-white/90 mb-[3px] tracking-[0.5px]" style={{ fontFamily: "'Syne', sans-serif" }}>Real-Time Collector Tracking</p>
                <p className="text-sm text-white/70 leading-[1.65]" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>Your request is matched to a nearby collector. Track arrival live on the map.</p>
              </div>
            </div>
          </div>

          {/* Highlight */}
          <div className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-white/20 border border-white/30 text-white rounded-lg text-xs font-bold tracking-[1px]" style={{ fontFamily: "'Syne', sans-serif" }}>
            <span>📍</span>
            Live GPS Tracking
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-[18px] sm:pt-[22px] pb-[22px] border-t border-[#1b6e35]/[0.12] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <span className="text-sm font-bold tracking-[1.5px] text-[#1b6e35] uppercase" style={{ fontFamily: "'Syne', sans-serif" }}>TRASHDROPS.COM</span>
          <span className="w-1 h-1 rounded-full bg-[#1b6e35]/[0.25]"></span>
          <span className="text-xs text-[#6b7565] italic" style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 300 }}>Smarter waste. Cleaner cities.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Accra', 'Kumasi', 'Takoradi', 'Tamale'].map((city) => (
            <span key={city} className="px-2.5 py-1 text-[10px] font-semibold tracking-[1.5px] text-[#6b7565] uppercase border border-[#1b6e35]/[0.2] rounded" style={{ fontFamily: "'Syne', sans-serif" }}>
              {city}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ─── Report Illegal Dumping Section (recreated from flyer) ──────────────────
const ReportDumpingSection = ({ isAuthenticated }) => {
  const navigate = useNavigate();

  return (
    <section className="py-12 sm:py-20 bg-gradient-to-b from-green-50 via-white to-blue-50 relative overflow-hidden">
      {/* Decorative dots */}
      <div className="absolute top-10 right-10 grid grid-cols-5 gap-2 opacity-15">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full bg-green-400"></div>
        ))}
      </div>
      {/* City skyline hint */}
      <div className="absolute top-0 left-0 right-0 h-32 opacity-[0.03]" style={{
        background: 'linear-gradient(to bottom, rgba(34,197,94,0.3), transparent)',
      }}></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side — content */}
          <div className="order-2 lg:order-1">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 mb-3 leading-tight">
              See illegal dumping?
            </h2>

            <div className="inline-block mb-6">
              <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-bold shadow-lg shadow-green-600/30">
                REPORT IT IN SECONDS!
              </div>
            </div>

            <p className="text-base sm:text-lg text-gray-600 mb-6 sm:mb-8 leading-relaxed max-w-lg">
              Join the Trash Walk &amp; keep your community clean. Spot illegal dumping anywhere? Report it instantly through the TrashDrop app.
            </p>

            {/* Feature checklist */}
            <div className="space-y-3 sm:space-y-4 mb-8 sm:mb-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-green-600 text-sm"></i>
                </div>
                <p className="text-base sm:text-lg font-semibold text-gray-800">Snap a pic</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-green-600 text-sm"></i>
                </div>
                <p className="text-base sm:text-lg font-semibold text-gray-800">Get location auto-filled</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-check text-green-600 text-sm"></i>
                </div>
                <p className="text-base sm:text-lg font-semibold text-gray-800">Report with one tap</p>
              </div>
            </div>

            {/* CTA pill + tagline */}
            <div className="inline-block mb-4">
              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-full text-base sm:text-lg font-bold shadow-lg shadow-red-500/30">
                STOP DUMPING. TAKE A TRASH WALK.
              </div>
            </div>
            <p className="text-gray-600 max-w-md leading-relaxed">
              Report illegal dumping easily in the TrashDrop app and help keep your community clean.
            </p>

            {/* Action button */}
            <div className="mt-8">
              <button
                onClick={() => isAuthenticated ? navigate('/illegal-dumping/reports') : navigate('/signup')}
                className="inline-flex items-center px-6 sm:px-8 py-3 sm:py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/25 hover:shadow-green-600/40 hover:-translate-y-0.5"
              >
                <i className="fas fa-exclamation-triangle mr-3 text-yellow-300"></i>
                {isAuthenticated ? 'Report Illegal Dump' : 'Sign Up to Report'}
              </button>
            </div>
          </div>

          {/* Right side — phone mockup */}
          <div className="order-1 lg:order-2 flex justify-center">
            <div className="relative">
              {/* Phone frame */}
              <div className="w-56 sm:w-64 lg:w-72 bg-white rounded-[2.5rem] shadow-2xl border-4 border-gray-800 overflow-hidden relative">
                {/* Status bar */}
                <div className="bg-gray-800 text-white text-[10px] flex items-center justify-between px-6 pt-3 pb-1">
                  <span>9:41</span>
                  <div className="flex items-center gap-1">
                    <i className="fas fa-signal text-[8px]"></i>
                    <i className="fas fa-wifi text-[8px]"></i>
                    <i className="fas fa-battery-full text-[8px]"></i>
                  </div>
                </div>
                {/* App header */}
                <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-arrow-left text-sm"></i>
                    <span className="font-semibold text-sm">TrashDrop</span>
                  </div>
                  <i className="fas fa-bell text-sm"></i>
                </div>
                {/* Screen content */}
                <div className="p-4 sm:p-5 bg-gray-50 min-h-[280px] sm:min-h-[320px]">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Report Illegal</h3>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-5">Dumping</h3>

                  {/* Photo placeholder */}
                  <div className="bg-gray-200 rounded-xl h-20 sm:h-24 flex items-center justify-center mb-3 sm:mb-4 border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <i className="fas fa-camera text-xl sm:text-2xl text-gray-400 mb-1"></i>
                      <p className="text-xs text-gray-400">Tap to add photo</p>
                    </div>
                  </div>

                  {/* Form fields */}
                  <div className="space-y-3">
                    <div className="flex items-center bg-white rounded-lg px-3 py-2.5 shadow-sm border border-gray-200">
                      <i className="fas fa-check-circle text-green-500 mr-2 text-sm"></i>
                      <span className="text-sm text-gray-600">Street Name</span>
                    </div>
                    <div className="flex items-center bg-white rounded-lg px-3 py-2.5 shadow-sm border border-gray-200">
                      <i className="fas fa-check-circle text-green-500 mr-2 text-sm"></i>
                      <span className="text-sm text-gray-600">City</span>
                    </div>
                  </div>

                  {/* Report button */}
                  <button className="w-full mt-4 sm:mt-5 bg-green-600 text-white font-bold py-2.5 sm:py-3 rounded-xl shadow-md text-sm">
                    Report It
                  </button>
                </div>
                {/* Home indicator */}
                <div className="bg-white py-2 flex justify-center">
                  <div className="w-28 h-1 bg-gray-300 rounded-full"></div>
                </div>
              </div>

              {/* Floating location pin */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-lg">
                  <i className="fas fa-map-marker-alt text-white"></i>
                </div>
              </div>

              {/* Floating alert badge */}
              <div className="absolute top-1/3 -right-6 w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-xl animate-pulse">
                <i className="fas fa-exclamation text-white text-lg"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Pricing Guide Section (2025 Pricing Flyer) ───────────────────────────────
const PricingGuideSection = () => (
  <section id="pricing" className="bg-[#0a0a0a] overflow-hidden">
    {/* Hero */}
    <div className="relative min-h-[420px] lg:h-[480px] overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-700 via-gray-600 to-gray-800"></div>

      {/* Trash bags image - right side */}
      <div className="absolute right-0 top-0 bottom-0 w-full lg:w-[65%] overflow-hidden">
        <img
          src="/images/pricing-bags.jpg"
          alt="TrashDrop bags"
          className="w-full h-full object-cover object-center opacity-90"
          style={{ mixBlendMode: 'multiply' }}
        />
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent"></div>
      </div>

      {/* Badge */}
      <div className="absolute top-4 lg:top-6 right-4 lg:right-6 bg-[#c8f135] text-[#111] font-bold text-[10px] lg:text-[11px] tracking-[0.12em] px-3 py-1.5 rounded-[2px] z-10">
        2025 PRICING GUIDE
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col justify-center h-full px-6 sm:px-8 lg:px-12 py-12 lg:py-0">
        <h1 className="text-[48px] sm:text-[56px] lg:text-[72px] leading-[0.95] text-white tracking-[0.01em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
          SMART WASTE.<br />
          <span className="text-[#c8f135]">FAIR PRICE.</span>
        </h1>
        <p className="mt-4 text-[13px] lg:text-[14px] text-white/[0.75] leading-[1.6] max-w-md">
          QR-tagged bags · on-demand pickup · no hidden fees<br />
          Prices from ₵115/batch · Free collection on all plans
        </p>
      </div>
    </div>

    {/* Collection is Free Banner */}
    <div className="bg-[#c8f135] text-[#111] text-center font-bold text-[13px] tracking-[0.14em] py-3 uppercase">
      + COLLECTION IS FREE ON EVERY BAG IN THE BATCH
    </div>

    {/* Bag Pricing Section */}
    <div className="px-4 sm:px-6 lg:px-12 pt-8 lg:pt-11 pb-6 lg:pb-8">
      {/* Section Label */}
      <div className="flex items-center gap-3 mb-4 lg:mb-5">
        <div className="w-9 h-0.5 bg-[#c8f135]"></div>
        <span className="text-[10px] lg:text-[11px] font-bold tracking-[0.18em] text-white/[0.55] uppercase">BAG PRICING — PER BATCH OF 5 BAGS</span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 lg:gap-6 mb-5 lg:mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#4d9de0]"></span>
          <span className="text-[12px] lg:text-[13px] text-white/70">Blue — Recyclable</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#555]"></span>
          <span className="text-[12px] lg:text-[13px] text-white/70">Black — General</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#c8f135]"></span>
          <span className="text-[12px] lg:text-[13px] text-white/70">Green — Organic</span>
        </div>
      </div>

      {/* Price Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-4">
        {/* Recyclable Card */}
        <div className="rounded-[8px] p-6 border border-white/[0.08] bg-[#1a2a3a]">
          <h2 className="text-[32px] tracking-[0.04em] mb-1 text-[#4d9de0]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Recyclable</h2>
          <p className="text-[12px] text-white/50 leading-[1.5] mb-2">Plastics, paper, metals.<br/>Collector earns from material resale.</p>
          <span className="inline-block text-[9px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-[2px] bg-[#4d9de0]/20 text-[#4d9de0] uppercase mb-4">LOWEST PRICE - BEST VALUE</span>

          <div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#4d9de0]/25 text-[#4d9de0]">Small</span>
                <span className="text-[11px] text-white/45">90L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵115</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#4d9de0]/25 text-[#4d9de0]">Medium</span>
                <span className="text-[11px] text-white/45">120L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵140</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#4d9de0]/25 text-[#4d9de0]">Large</span>
                <span className="text-[11px] text-white/45">240L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵170</span>
            </div>
          </div>
        </div>

        {/* General Card */}
        <div className="rounded-[8px] p-6 border border-white/[0.08] bg-[#2a2016]">
          <h2 className="text-[32px] tracking-[0.04em] mb-1 text-[#f0a830]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>General</h2>
          <p className="text-[12px] text-white/50 leading-[1.5] mb-2">Everyday mixed waste.<br/>Standard collection, no sorting required.</p>
          <span className="inline-block text-[9px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-[2px] bg-[#f0a830]/20 text-[#f0a830] uppercase mb-4">MOST FLEXIBLE</span>

          <div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#f0a830]/25 text-[#f0a830]">Small</span>
                <span className="text-[11px] text-white/45">90L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵140</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#f0a830]/25 text-[#f0a830]">Medium</span>
                <span className="text-[11px] text-white/45">120L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵165</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#f0a830]/25 text-[#f0a830]">Large</span>
                <span className="text-[11px] text-white/45">240L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵195</span>
            </div>
          </div>
        </div>

        {/* Organic Card */}
        <div className="rounded-[8px] p-6 border border-white/[0.08] bg-[#1a2a16]">
          <h2 className="text-[32px] tracking-[0.04em] mb-1 text-[#c8f135]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>Organic</h2>
          <p className="text-[12px] text-white/50 leading-[1.5] mb-2">Food scraps, garden waste.<br/>Composting-ready handling.</p>
          <span className="inline-block text-[9px] font-bold tracking-[0.12em] px-2.5 py-1 rounded-[2px] bg-[#c8f135]/20 text-[#c8f135] uppercase mb-4">ECO-PREMIUM</span>

          <div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#c8f135]/25 text-[#b0d020]">Small</span>
                <span className="text-[11px] text-white/45">90L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵160</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#c8f135]/25 text-[#b0d020]">Medium</span>
                <span className="text-[11px] text-white/45">120L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵195</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-[2px] bg-[#c8f135]/25 text-[#b0d020]">Large</span>
                <span className="text-[11px] text-white/45">240L</span>
              </div>
              <span className="text-[28px] text-white tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>₵225</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Monthly Subscription Section */}
    <div className="px-4 sm:px-6 lg:px-12 pb-8 lg:pb-11">
      {/* Section Label */}
      <div className="flex items-center gap-3 mb-4 lg:mb-6">
        <div className="w-9 h-0.5 bg-[#c8f135]"></div>
        <span className="text-[10px] lg:text-[11px] font-bold tracking-[0.18em] text-white/[0.55] uppercase">MONTHLY SUBSCRIPTION — SAVE UP TO 15%</span>
      </div>

      {/* Subscription Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-4">
        {/* Basic - 5% */}
        <div className="rounded-[8px] p-6 bg-[#1a1a1a] border border-white/[0.08]">
          <p className="text-[52px] leading-none text-[#c8f135] mb-1 tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>5%</p>
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/[0.55] uppercase mb-4">BASIC</p>
          <div className="text-[13px] text-white/60 leading-[1.6] mb-4 space-y-1">
            <p>· 1 batch/month</p>
            <p>· Any type or size</p>
            <p>· Cancel anytime</p>
          </div>
          <p className="text-[12px] text-white/40 pt-3 border-t border-white/[0.07]">e.g. Recyclable Small — ₵109/mo</p>
        </div>

        {/* Regular - 10% */}
        <div className="rounded-[8px] p-6 bg-[#1a1a1a] border border-white/[0.08] relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c8f135] text-[#111] text-[10px] font-bold tracking-[0.14em] px-3 py-1 rounded-[2px] uppercase whitespace-nowrap">MOST POPULAR</span>
          <p className="text-[52px] leading-none text-[#c8f135] mb-1 tracking-[0.04em] mt-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>10%</p>
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/[0.55] uppercase mb-4">REGULAR</p>
          <div className="text-[13px] text-white/60 leading-[1.6] mb-4 space-y-1">
            <p>· 2 batches/month</p>
            <p>· Mix & match type and size</p>
          </div>
          <p className="text-[12px] text-white/40 pt-3 border-t border-white/[0.07]">e.g. 2× General Medium — ₵297/mo</p>
        </div>

        {/* Household - 15% */}
        <div className="rounded-[8px] p-6 bg-[#1a1a1a] border border-white/[0.08]">
          <p className="text-[52px] leading-none text-[#c8f135] mb-1 tracking-[0.04em]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>15%</p>
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/[0.55] uppercase mb-4">HOUSEHOLD</p>
          <div className="text-[13px] text-white/60 leading-[1.6] mb-4 space-y-1">
            <p>· 6 batches</p>
            <p>· Quarterly prepay</p>
            <p>· Full mix & match</p>
          </div>
          <p className="text-[12px] text-white/40 pt-3 border-t border-white/[0.07]">
            e.g. 6× Recyclable Small — ₵586<span className="text-white/[0.45]">/qtr</span> <span className="text-[#c8f135] text-[10px] tracking-wide">QUARTERLY</span>
          </p>
        </div>
      </div>
    </div>

    {/* Footer */}
    <div className="mt-6 lg:mt-8 bg-[#1a1f1a] px-4 sm:px-6 lg:px-12 py-5 lg:py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
      <span className="text-[24px] sm:text-[28px] lg:text-[32px] tracking-[0.12em] text-[#c8f135]" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>TRASHDROP</span>
      <span className="text-[11px] sm:text-[12px] text-white/40 tracking-wide text-center sm:text-right">by Infobrix Limited · Accra · Kumasi · Takoradi · Tamale</span>
    </div>
  </section>
);

// ─── Product Showcase Section (dark flyer style) ─────────────────────────────
const ProductShowcaseSection = () => (
  <section
    className="relative overflow-hidden"
    style={{
      background: '#0a0f0a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {/* Noise grain overlay */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.35,
        zIndex: 1,
      }}
    />

    {/* Left-to-right scrim */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'linear-gradient(105deg, rgba(10,15,10,1) 0%, rgba(10,15,10,0.97) 28%, rgba(10,15,10,0.78) 46%, rgba(10,15,10,0.25) 62%, transparent 72%)',
        zIndex: 3,
      }}
    />

    {/* Product image — right side */}
    <div
      className="absolute top-0 right-0 bottom-0"
      style={{ width: '72%', zIndex: 2 }}
    >
      <img
        src="/images/bags-poster.jpg"
        alt="TrashDrop Bags"
        className="w-full h-full object-cover"
        style={{
          objectPosition: '30% center',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 18%, rgba(0,0,0,1) 42%, rgba(0,0,0,1) 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 18%, rgba(0,0,0,1) 42%, rgba(0,0,0,1) 100%)',
        }}
      />
    </div>

    {/* Decorative rings */}
    <div className="absolute pointer-events-none" style={{ width: 500, height: 500, right: '8%', top: '-15%', borderRadius: '50%', border: '1px solid rgba(168,230,61,0.08)', zIndex: 4 }} />
    <div className="absolute pointer-events-none" style={{ width: 300, height: 300, right: '22%', bottom: '10%', borderRadius: '50%', border: '1px solid rgba(168,230,61,0.08)', zIndex: 4 }} />

    {/* "100% FREE" floating badge */}
    <div
      className="absolute flex flex-col items-center justify-center text-center"
      style={{
        top: '12%',
        right: '6%',
        zIndex: 10,
        background: '#f5c842',
        color: '#0a0f0a',
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 16,
        letterSpacing: '1.5px',
        padding: 16,
        borderRadius: '50%',
        width: 110,
        height: 110,
        lineHeight: 1.1,
        boxShadow: '0 6px 30px rgba(245,200,66,0.45), 0 0 0 3px rgba(245,200,66,0.2)',
        transform: 'rotate(12deg)',
      }}
    >
      <span style={{ fontSize: 26, lineHeight: 1, display: 'block' }}>100%</span>
      FREE
    </div>

    {/* Top accent bar */}
    <div style={{ height: 5, background: 'linear-gradient(90deg, #1a7a3c 0%, #a8e63d 55%, #22c55e 100%)', position: 'relative', zIndex: 10, flexShrink: 0 }} />

    {/* Header tag */}
    <div style={{ padding: '22px 48px 0', display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 8, flexShrink: 0 }}>
      <span style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '3.5px',
        textTransform: 'uppercase',
        color: '#22c55e',
        border: '1px solid rgba(34,197,94,0.4)',
        padding: '5px 14px',
        borderRadius: 3,
        background: 'rgba(26,122,60,0.12)',
      }}>
        Ghana's #1 Waste Platform
      </span>
    </div>

    {/* Hero copy */}
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative', zIndex: 8, padding: '0 0 0 52px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 520 }}>
        {/* Eyebrow */}
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '5px',
          color: '#22c55e',
          textTransform: 'uppercase',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ display: 'block', width: 26, height: 2, background: '#22c55e', flexShrink: 0 }} />
          Introducing TrashDrop Bags
        </div>

        {/* FREE PICKUP */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", lineHeight: 0.88, letterSpacing: 2 }}>
          <span style={{ display: 'block', fontSize: 'clamp(90px, 12vw, 128px)', color: '#a8e63d', textShadow: '0 0 80px rgba(168,230,61,0.3), 0 0 120px rgba(168,230,61,0.12)' }}>FREE</span>
          <span style={{ display: 'block', fontSize: 'clamp(56px, 7.5vw, 82px)', color: '#f0f5f0' }}>PICKUP</span>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 10px' }}>
          <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#a8e63d', flexShrink: 0 }} />
          <div style={{ height: 1.5, flex: 1, background: 'linear-gradient(90deg, rgba(168,230,61,0.5) 0%, transparent 100%)' }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '4px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', flexShrink: 0 }}>Plus</span>
          <div style={{ height: 1.5, flex: 1, background: 'linear-gradient(90deg, rgba(168,230,61,0.5) 0%, transparent 100%)' }} />
        </div>

        {/* NO MONTHLY PAYMENTS */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", lineHeight: 0.86 }}>
          <span style={{ display: 'block', fontSize: 'clamp(48px, 6.5vw, 72px)', color: 'rgba(255,255,255,0.13)', WebkitTextStroke: '1.5px rgba(255,255,255,0.45)', letterSpacing: 3 }}>NO MONTHLY</span>
          <span style={{ display: 'block', fontSize: 'clamp(80px, 11vw, 118px)', color: '#f5c842', textShadow: '0 0 50px rgba(245,200,66,0.35), 0 0 90px rgba(245,200,66,0.15)', letterSpacing: 2 }}>PAYMENTS</span>
        </div>
      </div>
    </div>

    {/* Bottom CTA bar */}
    <div style={{
      position: 'relative',
      zIndex: 8,
      background: '#1a7a3c',
      padding: '22px 52px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      clipPath: 'polygon(0 16px, 100% 0, 100% 100%, 0 100%)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Start Today</span>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, letterSpacing: 3, color: 'white', lineHeight: 1 }}>Download the App</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <span style={{ background: '#0a0f0a', color: '#a8e63d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '2.5px', padding: '9px 26px', borderRadius: 5, border: '1px solid rgba(168,230,61,0.5)' }}>
          TRASHDROPS.COM
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {['Accra', 'Kumasi', 'Takoradi', 'Tamale'].map((city) => (
            <span key={city} style={{ background: 'rgba(0,0,0,0.22)', color: 'rgba(255,255,255,0.65)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 3 }}>
              {city}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ─── Partnerships Section ─────────────────────────────────────────────────────
const PartnershipsSection = () => {
  const useCases = [
    { title: 'Smart Cities', description: 'Integrate TrashDrop into your city\'s digital infrastructure for real-time waste intelligence.', icon: 'fa-city' },
    { title: 'Municipal Waste Agencies', description: 'Streamline operations, track compliance, and optimize resource allocation.', icon: 'fa-building' },
    { title: 'Environmental NGOs', description: 'Leverage data insights to drive advocacy and community-based cleanup programs.', icon: 'fa-globe-africa' },
    { title: 'Recycling Companies', description: 'Identify waste streams, optimize collection routes, and increase recycling rates.', icon: 'fa-recycle' },
  ];

  return (
    <section id="partners" className="py-20 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block px-4 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full mb-4 tracking-wide">
              PARTNERSHIPS
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
              Partner With <span className="text-green-600">TrashDrop</span>
            </h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Join a growing network of cities, agencies, and organizations using TrashDrop to build cleaner, smarter, and more sustainable communities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup" className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/25">
                <i className="fas fa-calendar-check mr-2"></i>
                Request Demo
              </Link>
              <a href="mailto:partnerships@trashdrop.io" className="inline-flex items-center justify-center px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-green-500 hover:text-green-600 transition-all">
                <i className="fas fa-envelope mr-2"></i>
                City Deployment
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {useCases.map((uc) => (
              <div key={uc.title} className="bg-gray-50 rounded-2xl p-6 hover:bg-green-50 transition-colors border border-gray-100 hover:border-green-200 group">
                <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:bg-green-100 transition-colors">
                  <i className={`fas ${uc.icon} text-green-600 text-lg`}></i>
                </div>
                <h4 className="font-bold text-gray-900 mb-2">{uc.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{uc.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── Footer ───────────────────────────────────────────────────────────────────
const HomeFooter = () => (
  <footer className="bg-gray-900 text-gray-400 pt-16 pb-8">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center space-x-3 mb-4">
            <img src="/logo.svg" alt="TrashDrop" className="h-10 w-10" />
            <span className="text-xl font-bold text-white">Trash<span className="text-green-500">Drop</span></span>
          </div>
          <p className="text-sm leading-relaxed mb-4">
            Empowering communities to fight illegal dumping with real-time data intelligence and collective action.
          </p>
          <div className="flex space-x-3">
            <span role="link" tabIndex={0} className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-green-600 transition-colors cursor-pointer"><i className="fab fa-twitter text-sm"></i></span>
            <span role="link" tabIndex={0} className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-green-600 transition-colors cursor-pointer"><i className="fab fa-facebook-f text-sm"></i></span>
            <span role="link" tabIndex={0} className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-green-600 transition-colors cursor-pointer"><i className="fab fa-linkedin-in text-sm"></i></span>
            <span role="link" tabIndex={0} className="w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center hover:bg-green-600 transition-colors cursor-pointer"><i className="fab fa-github text-sm"></i></span>
          </div>
        </div>

        {/* Platform */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4">Platform</h4>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#map" className="hover:text-green-400 transition-colors">Live Map</a></li>
            <li><a href="#insights" className="hover:text-green-400 transition-colors">Dashboard</a></li>
            <li><Link to="/login" className="hover:text-green-400 transition-colors">Report Dumping</Link></li>
            <li><Link to="/signup" className="hover:text-green-400 transition-colors">Join Community</Link></li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4">Resources</h4>
          <ul className="space-y-2.5 text-sm">
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">Documentation</span></li>
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">API Reference</span></li>
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">Case Studies</span></li>
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">Blog</span></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
          <ul className="space-y-2.5 text-sm">
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">About Us</span></li>
            <li><a href="#partners" className="hover:text-green-400 transition-colors">Partnerships</a></li>
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">Privacy Policy</span></li>
            <li><span className="hover:text-green-400 transition-colors cursor-pointer">Terms of Service</span></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center text-sm">
        <p>&copy; {new Date().getFullYear()} TrashDrop. All rights reserved.</p>
        <p className="mt-2 md:mt-0 text-gray-500">Built for cleaner cities across Ghana and beyond.</p>
      </div>
    </div>
  </footer>
);

// ─── Floating Action Buttons ──────────────────────────────────────────────────
const FloatingActions = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-3">
      {expanded && (
        <div className="flex flex-col space-y-2 animate-fadeIn">
          <button
            onClick={() => isAuthenticated ? navigate('/illegal-dumping/reports') : navigate('/signup')}
            className="flex items-center space-x-2 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-full shadow-lg hover:bg-red-700 transition-all"
          >
            <i className="fas fa-exclamation-triangle"></i>
            <span>Report Dump</span>
          </button>
          <a
            href="#map"
            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-full shadow-lg hover:bg-blue-700 transition-all"
          >
            <i className="fas fa-map"></i>
            <span>View Map</span>
          </a>
          <Link
            to="/signup"
            className="flex items-center space-x-2 px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-full shadow-lg hover:bg-green-700 transition-all"
          >
            <i className="fas fa-user-plus"></i>
            <span>Join Community</span>
          </Link>
        </div>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
          expanded ? 'bg-gray-800 rotate-45' : 'bg-green-600 hover:bg-green-700'
        }`}
      >
        <i className="fas fa-plus text-white text-xl"></i>
      </button>
    </div>
  );
};

// ─── Main HomePage Component ──────────────────────────────────────────────────
const HomePage = () => {
  const { isAuthenticated, authInitialized } = useAuth();

  // Don't block render while auth is loading — homepage is public
  const effectiveAuth = authInitialized ? isAuthenticated : false;

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>

      <HomeNavbar isAuthenticated={effectiveAuth} />
      <HeroSection isAuthenticated={effectiveAuth} />
      <MapPreviewSection isAuthenticated={effectiveAuth} />
      <HowItWorksSection />
      <DigitalBinSection />
      <ReportDumpingSection isAuthenticated={effectiveAuth} />
      <DashboardPreviewSection isAuthenticated={effectiveAuth} />
      <ProductShowcaseSection />
      <PricingGuideSection />
      <PathwaysSection />
      <ImpactSection />
      <PartnershipsSection />
      <HomeFooter />
      <FloatingActions isAuthenticated={effectiveAuth} />
    </div>
  );
};

export default HomePage;
