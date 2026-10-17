import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PublicDumpingMap, { usePublicDumpingReports } from '../components/landing/PublicDumpingMap';
import { computePublicStats, formatDuration, HOTSPOT_MIN_REPORTS } from '../services/publicDumpingReportsService';
import { HOUSEHOLD_APP_URL, BOOKING_CITIES, nearestBookingCity, TRUST_STATS, CITY_CARD_PHOTOS } from '../config/homepage';
import { CITY_CONTENT } from './cityContent';
import { reverseGeocode } from '../utils/geocoding';
import { useAuth } from '../context/AuthContext';
import { useSeo, BUSINESS, CITY_PAGES, WASTE_PICKUP_PATH, organizationJsonLd, localBusinessJsonLd } from '../utils/seo';
import { subscribeSocialFeed, PLATFORM_META } from '../services/socialFeedService';

/* ─── Brand tokens ──────────────────────────────────────────────────────────── */
const TD = {
  lime:     '#a8e63d',
  forest:   '#1b6e35',
  forestDk: '#0f4020',
  ink:      '#0a0f0a',
  ink2:     '#111a13',
  sage:     '#6b7565',
  cream:    '#f5f2eb',
  gold:     '#f5c842',
  orange:   '#F98B38',
};
const FF = {
  display: { fontFamily:"'DM Serif Display', Georgia, serif" },
  body:    { fontFamily:"'DM Sans', system-ui, sans-serif" },
  label:   { fontFamily:"'Syne', sans-serif" },
  data:    { fontFamily:"'Bebas Neue', sans-serif" },
};

/* ─── Landing-page theme tokens ─────────────────────────────────────────────── */
const LP = {
  dark: {
    pageBg:        '#fff',
    sectionAlt:    TD.cream,
    sectionDark:   TD.ink,
    sectionDark2:  '#0c1210',
    sectionForest: `linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 40%,#0a0f0a 100%)`,
    sectionPathway:'#f7f7f5',
    sectionPartner:TD.ink,
    sectionPricing:'#0a0a0a',
    footerBg:      '#050805',
    footerBorder:  'rgba(168,230,61,0.08)',
    navScrollBg:   'rgba(10,15,10,0.96)',
    navScrollBorder:'rgba(168,230,61,0.12)',
    navText:       'rgba(255,255,255,0.75)',
    navBrand:      '#fff',
    mobileMenuBg:  TD.ink,
    heroOverlay:   'linear-gradient(135deg,rgba(10,15,10,0.85) 0%,rgba(10,15,10,0.7) 50%,rgba(10,15,10,0.5) 100%)',
    heroBg:        TD.ink,
    heroText:      '#f0f5f0',
    heroSub:       'rgba(255,255,255,0.55)',
    heroStatLabel: TD.sage,
    sectionHeading:'#f0f5f0',
    bodyText:      'rgba(255,255,255,0.45)',
    ink2Heading:   TD.ink2,
    sageText:      TD.sage,
    cardBg:        '#fff',
    cardBorder:    'rgba(0,0,0,0.06)',
    stepNum:       'rgba(0,0,0,0.03)',
    darkBoxBg:     TD.ink2,
    darkBoxText:   'rgba(255,255,255,0.62)',
    mapSectionBg:  '#0c1210',
    mapStatBg:     'rgba(255,255,255,0.03)',
    mapStatBorder: 'rgba(255,255,255,0.07)',
    mapStatText:   '#fff',
    mapStatLabel:  'rgba(255,255,255,0.35)',
    pathwayCardBg: '#fff',
    pathwayText:   '#4a5568',
    partnerTileBg: 'rgba(255,255,255,0.03)',
    partnerTileB:  'rgba(255,255,255,0.07)',
    partnerH4:     '#f0f5f0',
    partnerP:      'rgba(255,255,255,0.38)',
    pricingBg:     '#0a1a0a',
    pricingText:   'rgba(255,255,255,0.52)',
    subBg:         '#1a1a1a',
    subText:       'rgba(255,255,255,0.58)',
    subSmall:      'rgba(255,255,255,0.32)',
    pricingBarBg:  '#1a1f1a',
    pricingBarText:'rgba(255,255,255,0.32)',
    impactText:    'rgba(255,255,255,0.42)',
    impactCount:   '#fff',
    impactSub:     'rgba(255,255,255,0.4)',
    fabLabel:      TD.ink,
    fabLabelBg:    TD.ink,
    fabLabelColor: '#fff',
    featureBoxBg:  'rgba(168,230,61,0.05)',
    featureBoxBorder:'rgba(168,230,61,0.15)',
    featureTitle:  TD.lime,
    featureIconBg: 'rgba(168,230,61,0.12)',
    featureIcon:   TD.lime,
    featureText:   'rgba(255,255,255,0.72)',
    mapLegendBg:   'rgba(10,15,10,0.9)',
    mapLegendBorder:'rgba(255,255,255,0.1)',
    mapLegendLabel:'rgba(255,255,255,0.45)',
    mapLegendText: 'rgba(255,255,255,0.55)',
    pricingRowBorder:'rgba(255,255,255,0.06)',
    pricingSize:   'rgba(255,255,255,0.35)',
    pricingDesc:   'rgba(255,255,255,0.45)',
    subTierLabel:  'rgba(255,255,255,0.42)',
    connectorBorder:'#fff',
    darkBoxStrong:  '#fff',
    darkBoxFooter:  '#fff',
    darkBoxSub:     TD.sage,
    howItWorksLabel:TD.sage,
    sectionLabel:   TD.sage,
    impactLabel:    `${TD.lime}80`,
    pathwaysLabel:  `${TD.forest}99`,
  },
  light: {
    pageBg:        '#fff',
    sectionAlt:    '#f0f9f0',
    sectionDark:   '#1b3a28',
    sectionDark2:  '#f5f9f5',
    sectionForest: `linear-gradient(160deg,#e8f5ed 0%,#f0faf2 40%,#fafff8 100%)`,
    sectionPathway:'#f7f7f5',
    sectionPartner:'#1b3a28',
    sectionPricing:'#fafafa',
    footerBg:      '#1b3a28',
    footerBorder:  'rgba(168,230,61,0.15)',
    navScrollBg:   'rgba(255,255,255,0.97)',
    navScrollBorder:'rgba(22,101,52,0.15)',
    navText:       'rgba(27,62,40,0.75)',
    navBrand:      TD.forest,
    mobileMenuBg:  '#fff',
    heroOverlay:   'linear-gradient(135deg,rgba(10,20,12,0.82) 0%,rgba(10,20,12,0.65) 50%,rgba(10,20,12,0.4) 100%)',
    heroBg:        TD.forest,
    heroText:      '#f0f5f0',
    heroSub:       'rgba(255,255,255,0.6)',
    heroStatLabel: '#a7c5b0',
    sectionHeading:'#1b3a28',
    bodyText:      '#4a7060',
    ink2Heading:   '#1b3a28',
    sageText:      '#5a7a68',
    cardBg:        '#fff',
    cardBorder:    'rgba(22,101,52,0.1)',
    stepNum:       'rgba(22,101,52,0.04)',
    darkBoxBg:     TD.forest,
    darkBoxText:   'rgba(255,255,255,0.75)',
    mapSectionBg:  '#f0faf2',
    mapStatBg:     'rgba(22,101,52,0.04)',
    mapStatBorder: 'rgba(22,101,52,0.1)',
    mapStatText:   '#1b3a28',
    mapStatLabel:  '#5a7a68',
    pathwayCardBg: '#fff',
    pathwayText:   '#4a5568',
    partnerTileBg: 'rgba(255,255,255,0.12)',
    partnerTileB:  'rgba(255,255,255,0.15)',
    partnerH4:     '#f0f5f0',
    partnerP:      'rgba(255,255,255,0.6)',
    pricingBg:     '#f0faf2',
    pricingText:   '#4a7060',
    subBg:         '#fff',
    subText:       '#374151',
    subSmall:      '#6b7280',
    pricingBarBg:  '#e8f5ed',
    pricingBarText:'#5a7a68',
    impactText:    '#3a6a50',
    impactCount:   '#1b3a28',
    impactSub:     '#5a7a68',
    fabLabel:      '#fff',
    fabLabelBg:    '#1b3a28',
    fabLabelColor: '#fff',
    featureBoxBg:  '#ffffff',
    featureBoxBorder:'rgba(22,101,52,0.18)',
    featureTitle:  TD.forest,
    featureIconBg: 'rgba(22,101,52,0.1)',
    featureIcon:   TD.forest,
    featureText:   '#2d4a38',
    mapLegendBg:   'rgba(255,255,255,0.95)',
    mapLegendBorder:'rgba(22,101,52,0.15)',
    mapLegendLabel:'#2d4a38',
    mapLegendText: '#374151',
    pricingRowBorder:'rgba(22,101,52,0.08)',
    pricingSize:   '#5a7a68',
    pricingDesc:   '#4a7060',
    subTierLabel:  '#5a7a68',
    connectorBorder:'#f0f9f0',
    darkBoxStrong:  '#f0f5f0',
    darkBoxFooter:  '#f0f5f0',
    darkBoxSub:     '#c8e6cc',
    howItWorksLabel:'#5a7a68',
    sectionLabel:   '#5a7a68',
    impactLabel:    TD.forest,
    pathwaysLabel:  TD.forest,
  },
};

/* ─── Landing-page local theme context ─────────────────────────────────────── */
const LpThemeContext = createContext();
const useLpTheme = () => useContext(LpThemeContext);
const LpThemeProvider = ({ children }) => {
  const [lpMode, setLpMode] = useState(() => localStorage.getItem('td_lp_theme') || 'light');
  const toggleLp = () => setLpMode(m => {
    const next = m === 'dark' ? 'light' : 'dark';
    localStorage.setItem('td_lp_theme', next);
    return next;
  });
  const tokens = LP[lpMode];
  return (
    <LpThemeContext.Provider value={{ lpMode, toggleLp, lp: tokens }}>
      {children}
    </LpThemeContext.Provider>
  );
};

/* ─── Hooks ─────────────────────────────────────────────────────────────────── */
const useReveal = (threshold = 0.12) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
};

const useCountUp = (end, duration = 2200, shouldStart = false) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!shouldStart) return;
    let t = null;
    let id;
    const step = (ts) => {
      if (!t) t = ts;
      const p = Math.min((ts - t) / duration, 1);
      setCount(Math.floor(p * end));
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [end, duration, shouldStart]);
  return count;
};

/* ═══════════════════════════════════════════════════════════════════════════════
   GLOBAL STYLES
   ═══════════════════════════════════════════════════════════════════════════════ */
const GlobalStyles = () => (
  <style>{`
    @keyframes td-float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    @keyframes td-spin-slow  { to{transform:rotate(360deg)} }
    @keyframes td-blink      { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes td-marquee    { to{transform:translateX(-50%)} }
    @keyframes td-fadeup     { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes td-pulse-dot  { 0%,100%{box-shadow:0 0 0 0 rgba(168,230,61,0.4)} 70%{box-shadow:0 0 0 8px rgba(168,230,61,0)} }
    .td-nav-link:hover { color:#a8e63d !important; }
    .td-pathway-card:hover { transform:translateY(-8px) !important; }
    .td-partner-tile:hover { background:rgba(168,230,61,0.06) !important; border-color:rgba(168,230,61,0.2) !important; }
    .td-social-btn:hover { background:rgba(168,230,61,0.15) !important; border-color:rgba(168,230,61,0.4) !important; color:#a8e63d !important; }
    .td-footer-link:hover { color:#a8e63d !important; }
    @media(max-width:768px) { .td-nav-links{display:none!important} }
    @media(min-width:769px) { .td-mobile-btn{display:none!important} }
    @media(max-width:900px) { .td-hero-grid{grid-template-columns:1fr!important} .td-hero-cards{display:none!important} }
    @media(max-width:768px) { .td-steps6{grid-template-columns:repeat(3,1fr)!important;row-gap:28px!important} .td-step-arrow{display:none!important} }
    @media(max-width:768px) { .td-services-grid{grid-template-columns:1fr!important} .td-map-stats{grid-template-columns:repeat(2,1fr)!important} .td-impact-grid{grid-template-columns:repeat(2,1fr)!important} }
    @media(max-width:480px) { .td-map-stats{grid-template-columns:1fr!important} .td-impact-grid{grid-template-columns:1fr!important} }
    @media(max-width:900px) { .td-pathways-grid{grid-template-columns:1fr!important} .td-partners-grid{grid-template-columns:1fr!important} }
    @media(max-width:900px) { .td-pricing-grid{grid-template-columns:1fr!important} }
    @media(max-width:900px) { .td-footer-grid{grid-template-columns:1fr 1fr!important} }
    @media(max-width:480px) { .td-footer-grid{grid-template-columns:1fr!important} }
    .td-sticky-book { right:28px; bottom:28px; }
    @media(max-width:768px) {
      .td-sticky-book { left:0; right:0; bottom:0; padding:10px 16px calc(10px + env(safe-area-inset-bottom)); background:rgba(255,255,255,0.96); box-shadow:0 -4px 18px rgba(0,0,0,0.12); }
      .td-sticky-book a { border-radius:12px !important; box-shadow:none !important; }
      .td-page { padding-bottom:76px; }
    }
    @media(max-width:600px) { .td-trust{grid-template-columns:repeat(2,1fr)!important; row-gap:18px!important} .td-city-row{grid-auto-columns:78%!important} }
    .td-city-row { scrollbar-width:thin; }
    .td-lp-toggle { transition: background 0.2s, color 0.2s, border-color 0.2s; }
    .td-lp-toggle:hover { opacity: 0.85; }
  `}</style>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════════════════════════════════════════════ */
const HomeNavbar = ({ isAuthenticated }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { lpMode, toggleLp } = useLpTheme();
  const isDark = lpMode === 'dark';
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn, { passive:true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  const NAV = [
    { href:'/#how',             label:'How it works'        },
    { href:'/#pricing',         label:'Prices'              },
    { href:'/illegal-dumping/', label:'Report dumping'      },
    { href:'/collectors/',      label:'Earn as a collector' },
    { href:'/partners/',        label:'Partners'            },
  ];
  const navScrollBg     = isDark ? 'rgba(10,15,10,0.96)'        : 'rgba(255,255,255,0.97)';
  const navScrollBorder = isDark ? 'rgba(168,230,61,0.12)'      : 'rgba(22,101,52,0.15)';
  // Light links while the bar is see-through over the dark hero
  const navLinkColor    = isDark || !scrolled ? 'rgba(255,255,255,0.85)' : 'rgba(27,62,40,0.8)';
  const brandColor      = isDark ? '#fff'                        : TD.forest;
  const mobileMenuBg    = isDark ? TD.ink                        : '#fff';
  const mobileLinkColor = isDark ? 'rgba(255,255,255,0.8)'      : 'rgba(27,62,40,0.85)';
  const mobileLinkBorder= isDark ? 'rgba(255,255,255,0.05)'     : 'rgba(22,101,52,0.08)';
  const mobileSignInStyle = isDark
    ? { ...FF.label, fontWeight:600, color:'#fff', textAlign:'center', padding:12, borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', textDecoration:'none' }
    : { ...FF.label, fontWeight:600, color:TD.forest, textAlign:'center', padding:12, borderRadius:8, border:`1px solid ${TD.forest}40`, textDecoration:'none' };
  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:1500, transition:'all 0.35s ease', background:scrolled?navScrollBg:'transparent', backdropFilter:scrolled?'blur(22px)':'none', borderBottom:scrolled?`1px solid ${navScrollBorder}`:'1px solid transparent' }}>
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:68 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <img src="/logo.svg" alt="TrashDrop" style={{ height:36, width:36 }} />
          <span style={{ ...FF.label, fontSize:18, fontWeight:800, color:brandColor, letterSpacing:'-0.3px' }}>Trash<span style={{ color:TD.lime }}>Drop</span></span>
        </Link>
        <div className="td-nav-links" style={{ display:'flex', alignItems:'center', gap:32 }}>
          {NAV.map(l => <a key={l.href} href={l.href} className="td-nav-link" style={{ ...FF.label, fontSize:13, fontWeight:600, letterSpacing:'0.3px', color:navLinkColor, textDecoration:'none', transition:'color 0.2s' }}>{l.label}</a>)}
        </div>
        <div className="td-nav-links" style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* Theme toggle */}
          <button
            className="td-lp-toggle"
            onClick={toggleLp}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            style={{ display:'inline-flex', alignItems:'center', gap:6, background:isDark?'rgba(168,230,61,0.1)':'rgba(22,101,52,0.08)', border:`1px solid ${isDark?'rgba(168,230,61,0.25)':'rgba(22,101,52,0.2)'}`, color:isDark?TD.lime:TD.forest, padding:'7px 14px', borderRadius:8, cursor:'pointer', ...FF.label, fontSize:12, fontWeight:700 }}
          >
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`} style={{ fontSize:13 }}></i>
            {isDark ? 'Light' : 'Dark'}
          </button>
          {isAuthenticated
            ? <Link to="/dashboard" style={{ ...FF.label, fontSize:13, fontWeight:700, background:TD.lime, color:TD.ink, padding:'9px 22px', borderRadius:8, textDecoration:'none', boxShadow:`0 4px 20px ${TD.lime}40` }}>Dashboard →</Link>
            : <><Link to="/login"  style={{ ...FF.label, fontSize:13, fontWeight:600, color:navLinkColor, textDecoration:'none', padding:'9px 14px' }}>Sign In</Link>
                <Link to="/signup" style={{ ...FF.label, fontSize:13, fontWeight:700, background:TD.lime, color:TD.ink, padding:'9px 22px', borderRadius:8, textDecoration:'none', boxShadow:`0 4px 20px ${TD.lime}40` }}>Get Started</Link></>}
        </div>
        <button className="td-mobile-btn" onClick={() => setMobileOpen(o=>!o)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} style={{ background:'none', border:'none', cursor:'pointer', padding:8, color:isDark || !scrolled ? '#fff' : TD.forest }}>
          <i className={`fas ${mobileOpen?'fa-times':'fa-bars'}`} style={{ fontSize:18 }}></i>
        </button>
      </div>
      {mobileOpen && (
        <div style={{ background:mobileMenuBg, borderTop:`1px solid ${isDark?'rgba(168,230,61,0.12)':'rgba(22,101,52,0.1)'}`, padding:'16px 24px 24px' }}>
          {NAV.map(l => <a key={l.href} href={l.href} onClick={()=>setMobileOpen(false)} style={{ display:'block', ...FF.label, fontSize:14, fontWeight:600, color:mobileLinkColor, textDecoration:'none', padding:'10px 0', borderBottom:`1px solid ${mobileLinkBorder}` }}>{l.label}</a>)}
          <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={toggleLp} style={{ ...FF.label, fontWeight:600, color:isDark?TD.lime:TD.forest, background:'transparent', border:`1px solid ${isDark?'rgba(168,230,61,0.25)':'rgba(22,101,52,0.2)'}`, textAlign:'center', padding:12, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <i className={`fas ${isDark?'fa-sun':'fa-moon'}`}></i> Switch to {isDark?'Light':'Dark'} Mode
            </button>
            {isAuthenticated
              ? <Link to="/dashboard" style={{ ...FF.label, fontWeight:700, background:TD.lime, color:TD.ink, textAlign:'center', padding:12, borderRadius:8, textDecoration:'none' }}>Go to Dashboard</Link>
              : <><Link to="/login"  style={mobileSignInStyle}>Sign In</Link>
                  <Link to="/signup" style={{ ...FF.label, fontWeight:700, background:TD.lime, color:TD.ink, textAlign:'center', padding:12, borderRadius:8, textDecoration:'none' }}>Get Started Free</Link></>}
          </div>
        </div>
      )}
    </nav>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   BOOKING CARD (top of the hero)
   ═══════════════════════════════════════════════════════════════════════════════ */
const SERVICES = {
  bag: { label:'QR Bag pickup', note:'Free',      cta:'Request pickup' },
  bin: { label:'Digital Bin',   note:'Get quote', cta:'Get quote'      },
};

const BookingCard = () => {
  const [city, setCity] = useState(BOOKING_CITIES[0].name);
  const [location, setLocation] = useState('');
  const [service, setService] = useState('bag');
  const [locStatus, setLocStatus] = useState('');
  const [locating, setLocating] = useState(false);

  // Location is only requested when the visitor taps the button, never on load
  const useMyLocation = () => {
    if (!navigator.geolocation) { setLocStatus('Your browser cannot share your location. Type your area instead.'); return; }
    setLocating(true);
    setLocStatus('Finding you…');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const near = nearestBookingCity(coords.latitude, coords.longitude);
      if (near) setCity(near);
      const address = await reverseGeocode(coords.latitude, coords.longitude);
      setLocation(address || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
      setLocStatus(near ? '' : 'We are not in your area yet. We serve Accra, Kumasi, Takoradi and Tamale.');
      setLocating(false);
    }, () => {
      setLocStatus('Location is off. Type your area instead.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  };

  const field = { width:'100%', boxSizing:'border-box', height:48, border:'1px solid #d7dbe0', borderRadius:10, padding:'0 52px 0 14px', ...FF.body, fontSize:15, color:TD.ink, background:'#fff' };
  return (
    <div data-testid="booking-card" style={{ background:'#fff', borderRadius:18, padding:20, maxWidth:480, boxShadow:'0 18px 50px rgba(0,0,0,0.35)', color:TD.ink, minHeight:420, boxSizing:'border-box' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, ...FF.body, fontSize:15 }}>
        <span>Pickup in <strong data-testid="booking-city">{city}</strong></span>
        {/* A native picker under a "Change city" link: nothing on the page moves when it opens */}
        <label style={{ position:'relative', color:TD.forest, fontWeight:600, fontSize:14, cursor:'pointer', textDecoration:'underline' }}>
          Change city
          <select value={city} onChange={e => setCity(e.target.value)} aria-label="Change city"
            style={{ position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%' }}>
            {BOOKING_CITIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <label htmlFor="booking-location" style={{ display:'block', ...FF.label, fontSize:12, fontWeight:700, color:'#4b5563', marginBottom:6 }}>Your location</label>
      <div style={{ position:'relative' }}>
        <input id="booking-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Area, street or landmark" autoComplete="street-address" style={field} />
        <button type="button" onClick={useMyLocation} disabled={locating} aria-label="Use my location" title="Use my location"
          style={{ position:'absolute', right:4, top:4, width:40, height:40, border:'none', borderRadius:8, background:`${TD.lime}30`, color:TD.forest, cursor:'pointer', fontSize:16 }}>
          <i className={`fas ${locating ? 'fa-spinner fa-spin' : 'fa-location-arrow'}`} aria-hidden="true"></i>
        </button>
      </div>
      <p role="status" style={{ ...FF.body, fontSize:12, color:'#6b7280', minHeight:18, lineHeight:'18px', margin:'4px 0 10px', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{locStatus}</p>

      <div role="radiogroup" aria-label="Service" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, background:'#f1f3f5', borderRadius:12, padding:4, marginBottom:14 }}>
        {Object.entries(SERVICES).map(([key, s]) => (
          <button key={key} type="button" role="radio" aria-checked={service === key} onClick={() => setService(key)}
            style={{ border:'none', borderRadius:9, padding:'9px 6px', cursor:'pointer', background: service === key ? '#fff' : 'transparent', boxShadow: service === key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none', ...FF.body, color:TD.ink, lineHeight:1.25 }}>
            <span style={{ display:'block', fontSize:14, fontWeight:600 }}>{s.label}</span>
            <span style={{ display:'block', fontSize:12, color: key === 'bag' ? TD.forest : '#6b7280' }}>({s.note})</span>
          </button>
        ))}
      </div>

      <a href={HOUSEHOLD_APP_URL} data-testid="booking-submit"
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, height:52, borderRadius:12, background:TD.lime, color:TD.ink, ...FF.label, fontSize:16, fontWeight:700, textDecoration:'none' }}>
        <i className="fas fa-truck" aria-hidden="true"></i> {SERVICES[service].cta}
      </a>

      <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:16, paddingTop:14, borderTop:'1px solid #eceef1' }}>
        <img src="/images/book-in-app-qr.png" alt="QR code that opens the TrashDrop app" width="96" height="96" style={{ width:96, height:96, borderRadius:8, flexShrink:0 }} />
        <p style={{ ...FF.body, fontSize:14, lineHeight:1.5, color:'#374151', margin:0 }}>
          <strong>Scan to book in the TrashDrop app.</strong> Point your phone camera at the code.
        </p>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════════════════════════════════ */
const HeroSection = ({ isAuthenticated }) => {
  const ORBS = [
    { s:420, t:'10%', l:'2%',  c:TD.lime,   d:0   },
    { s:300, t:'65%', l:'68%', c:TD.forest, d:1.5 },
    { s:240, t:'25%', l:'75%', c:TD.gold,   d:3   },
    { s:360, t:'70%', l:'5%',  c:TD.forest, d:0.8 },
  ];
  return (
    <section style={{ position:'relative', minHeight:'100vh', display:'flex', alignItems:'center', background:TD.ink, overflow:'hidden' }}>
      {/* Background Image */}
      <div style={{ 
        position:'absolute', 
        inset:0, 
        backgroundImage:'url(/images/home/hero-bg.jpg)', 
        backgroundSize:'cover', 
        backgroundPosition:'center',
        backgroundRepeat:'no-repeat',
        opacity:0.6,
        zIndex:0
      }} />
      {/* Dark overlay gradient for text readability */}
      <div style={{ 
        position:'absolute', 
        inset:0, 
        background:'linear-gradient(135deg, rgba(10,15,10,0.85) 0%, rgba(10,15,10,0.7) 50%, rgba(10,15,10,0.5) 100%)',
        zIndex:1
      }} />
      {ORBS.map((o,i) => (
        <div key={i} style={{ position:'absolute', width:o.s, height:o.s, top:o.t, left:o.l, borderRadius:'50%', background:`radial-gradient(circle,${o.c}18 0%,transparent 70%)`, filter:'blur(60px)', animation:`td-float ${6+i}s ease-in-out ${o.d}s infinite`, pointerEvents:'none', zIndex:2 }} />
      ))}
      <div style={{ position:'absolute', inset:0, opacity:0.04, pointerEvents:'none', backgroundImage:`linear-gradient(${TD.lime} 1px,transparent 1px),linear-gradient(90deg,${TD.lime} 1px,transparent 1px)`, backgroundSize:'52px 52px', zIndex:2 }} />
      <div style={{ position:'absolute', top:0, right:'22%', width:1, height:'100%', background:`linear-gradient(to bottom,transparent,${TD.lime}28,transparent)`, pointerEvents:'none', zIndex:2 }} />

      <div style={{ position:'relative', zIndex:3, maxWidth:1280, margin:'0 auto', padding:'96px 24px 64px', width:'100%' }}>
        <div className="td-hero-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }}>

          {/* Left */}
          <div style={{ position:'relative', zIndex:3 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 16px', marginBottom:20 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:TD.lime, display:'inline-block', animation:'td-pulse-dot 2s infinite' }} />
              <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Your Waste Tells Your Story</span>
            </div>
            <h1 style={{ ...FF.display, fontSize:'clamp(38px,4.4vw,56px)', lineHeight:1.04, letterSpacing:'-1.5px', color:'#f0f5f0', margin:'0 0 12px' }}>
              Waste pickup in Ghana, booked in minutes
            </h1>
            <p style={{ ...FF.body, fontSize:18, lineHeight:1.6, color:'rgba(255,255,255,0.78)', margin:'0 0 32px', maxWidth:540 }}>
              A verified collector comes to your door. Pay with MoMo or cash — or nothing at all with TrashDrop bags.
            </p>
            <div id="book" style={{ scrollMarginTop:80 }}><BookingCard /></div>
            <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:8, color:'rgba(255,255,255,0.82)', ...FF.label, fontSize:14, fontWeight:600, textDecoration:'none', margin:'16px 0 36px' }}>
              <i className="fab fa-whatsapp" style={{ color:'#25D366', fontSize:18 }} aria-hidden="true"></i> Or book on WhatsApp: {BUSINESS.phoneDisplay}
            </a>
          </div>

          {/* Right — floating cards */}
          <div className="td-hero-cards" style={{ position:'relative', height:480, zIndex:3 }}>
            <div style={{ position:'absolute', top:20, right:0, width:258, background:`rgba(27,110,53,0.18)`, border:`1px solid rgba(168,230,61,0.2)`, backdropFilter:'blur(20px)', borderRadius:20, padding:'20px 22px', animation:'td-float 6s ease-in-out infinite', boxShadow:`0 24px 60px rgba(0,0,0,0.5)` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <i className="fas fa-qrcode" style={{ color:TD.lime, fontSize:13 }}></i>
                <span style={{ ...FF.label, fontSize:10, color:TD.lime, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase' }}>QR Bag Pickup</span>
              </div>
              <div style={{ ...FF.data, fontSize:52, color:'#fff', lineHeight:1 }}>FREE</div>
              <div style={{ ...FF.body, fontSize:12, color:'rgba(255,255,255,0.55)', marginTop:4 }}>Collection included with every bag</div>
              <div style={{ display:'flex', gap:6, marginTop:14 }}>
                {['Organic','General','Recyclable'].map(t => <span key={t} style={{ ...FF.label, fontSize:9, fontWeight:700, letterSpacing:'1px', color:TD.lime, background:`${TD.lime}18`, borderRadius:4, padding:'3px 6px', textTransform:'uppercase' }}>{t}</span>)}
              </div>
            </div>
            <div style={{ position:'absolute', top:185, left:0, width:218, background:'rgba(10,15,10,0.82)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', borderRadius:18, padding:'18px 20px', animation:'td-float 8s ease-in-out 1.5s infinite', boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:`${TD.lime}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className="fas fa-trash-alt" style={{ color:TD.lime, fontSize:14 }}></i>
                </div>
                <span style={{ ...FF.label, fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>Digital Bin</span>
              </div>
              <div style={{ ...FF.data, fontSize:36, color:'#fff' }}>ON DEMAND</div>
              <div style={{ ...FF.body, fontSize:12, color:TD.lime, marginTop:2 }}>Instant price quote</div>
            </div>
            <div style={{ position:'absolute', bottom:40, right:16, width:196, background:`linear-gradient(135deg,${TD.gold}18,${TD.gold}08)`, border:`1px solid ${TD.gold}28`, backdropFilter:'blur(20px)', borderRadius:16, padding:'16px 18px', animation:'td-float 7s ease-in-out 3s infinite', boxShadow:`0 16px 40px rgba(0,0,0,0.4)` }}>
              <div style={{ ...FF.label, fontSize:10, color:TD.gold, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', marginBottom:6 }}>Track Your Collector</div>
              <div style={{ ...FF.data, fontSize:40, color:'#fff' }}>LIVE</div>
              <div style={{ ...FF.body, fontSize:11, color:'rgba(255,255,255,0.45)', marginTop:2 }}>From request to doorstep</div>
            </div>
            <div style={{ position:'absolute', top:12, left:'36%', width:92, height:92, borderRadius:'50%', border:`1.5px solid ${TD.lime}28`, display:'flex', alignItems:'center', justifyContent:'center', animation:'td-spin-slow 18s linear infinite' }}>
              <svg viewBox="0 0 100 100" style={{ position:'absolute', width:'100%', height:'100%' }}>
                <path id="tc" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
                <text style={{ fontSize:8.5, fill:`${TD.lime}60`, fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'3px' }}>
                  <textPath href="#tc">Waste you can track · </textPath>
                </text>
              </svg>
              <div style={{ width:36, height:36, borderRadius:'50%', background:`${TD.lime}15`, border:`1.5px solid ${TD.lime}35`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="fas fa-leaf" style={{ color:TD.lime, fontSize:15 }}></i>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:8, animation:'td-float 2.5s ease-in-out infinite' }}>
        <span style={{ ...FF.label, fontSize:9, color:'rgba(255,255,255,0.28)', letterSpacing:'2px', fontWeight:700, textTransform:'uppercase' }}>Scroll</span>
        <div style={{ width:24, height:40, border:'1.5px solid rgba(255,255,255,0.14)', borderRadius:99, display:'flex', justifyContent:'center', paddingTop:6 }}>
          <div style={{ width:4, height:8, background:TD.lime, borderRadius:99, animation:'td-float 1.4s ease-in-out infinite alternate' }} />
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   TRUST ROW (values in src/config/homepage.js)
   ═══════════════════════════════════════════════════════════════════════════════ */
const TrustRow = () => (
  <section aria-label="Why households trust TrashDrop" style={{ background:TD.ink, borderTop:'1px solid rgba(255,255,255,0.08)' }}>
    <ul className="td-trust" style={{ listStyle:'none', margin:'0 auto', maxWidth:1100, padding:'22px 24px', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
      {TRUST_STATS.map(t => (
        <li key={t.label} style={{ textAlign:'center' }}>
          <span style={{ display:'block', ...FF.data, fontSize:30, color:TD.lime, letterSpacing:'1px', lineHeight:1.1 }}>{t.value}</span>
          <span style={{ display:'block', ...FF.body, fontSize:13, color:'rgba(255,255,255,0.75)' }}>{t.label}</span>
        </li>
      ))}
    </ul>
  </section>
);

/* ═══════════════════════════════════════════════════════════════════════════════
   MARQUEE STRIP
   ═══════════════════════════════════════════════════════════════════════════════ */
const MarqueeStrip = () => {
  // Two identical halves, so the -50% scroll loops seamlessly
  const half = ['QR-Tagged Bags','·','Free Collection','·','Real-Time Tracking','·','Illegal Dump Reporting','·','Accra · Kumasi · Takoradi · Tamale','·'];
  const items = [...half, ...half];
  return (
    <div style={{ background:TD.lime, overflow:'hidden', padding:'11px 0', position:'relative', zIndex:10 }}>
      <div style={{ display:'flex', animation:'td-marquee 28s linear infinite', whiteSpace:'nowrap' }}>
        {items.map((item,i) => <span key={i} style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:TD.ink, paddingRight:26 }}>{item}</span>)}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════════════════════════════════ */
const HOW_STEPS = [
  { icon:'fa-shopping-bag',  title:'Get bags'          },
  { icon:'fa-qrcode',        title:'Scan code'         },
  { icon:'fa-trash-alt',     title:'Fill bag'          },
  { icon:'fa-hand-pointer',  title:'Request pickup'    },
  { icon:'fa-truck',         title:'Collector arrives' },
  { icon:'fa-map-marker-alt', title:'Track it'         },
];

const HowItWorksSection = () => {
  const { ref, visible } = useReveal(0.1);
  const { lp } = useLpTheme();
  return (
    <section id="how" style={{ background:lp.sectionAlt, position:'relative', overflow:'hidden' }}>
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'80px 24px' }}>
        <h2 style={{ ...FF.display, fontSize:'clamp(36px,4.5vw,56px)', lineHeight:1, letterSpacing:'-1.5px', color:lp.ink2Heading, margin:'0 0 40px', textAlign:'center' }}>
          How it works
        </h2>
        <ol className="td-steps6" style={{ listStyle:'none', padding:0, margin:0, display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:16 }}>
          {HOW_STEPS.map((s,i) => (
            <li key={s.title} style={{ position:'relative', textAlign:'center', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(24px)', transition:`all 0.7s cubic-bezier(.22,1,.36,1) ${i*0.08}s` }}>
              <div style={{ width:64, height:64, borderRadius:18, background:lp.cardBg, border:`1px solid ${lp.cardBorder}`, boxShadow:'0 4px 18px rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <i className={`fas ${s.icon}`} aria-hidden="true" style={{ fontSize:24, color:TD.forest }}></i>
              </div>
              <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2px', color:TD.forest, display:'block', marginBottom:4 }}>{i + 1}</span>
              <h3 style={{ ...FF.body, fontSize:15, fontWeight:600, color:lp.ink2Heading, margin:0 }}>{s.title}</h3>
              {i < HOW_STEPS.length - 1 && <i className="fas fa-chevron-right td-step-arrow" aria-hidden="true" style={{ position:'absolute', top:24, right:-12, fontSize:14, color:TD.lime }}></i>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SERVICES
   ═══════════════════════════════════════════════════════════════════════════════ */
const ServicesSection = () => {
  const { ref, visible } = useReveal(0.08);
  const { lp } = useLpTheme();
  return (
    <section id="services" style={{ background:lp.sectionAlt, paddingBottom:100 }}>
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:6 }}>
          <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'4px', color:lp.sectionLabel, textTransform:'uppercase' }}>Our Services</span>
        </div>
        <h2 style={{ ...FF.display, fontSize:'clamp(36px,4.5vw,58px)', lineHeight:0.95, letterSpacing:'-1.5px', color:lp.ink2Heading, margin:'0 0 14px', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(28px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1)' }}>
          Two ways to <em style={{ color:TD.forest }}>drop</em> your waste.<br />Zero excuses.
        </h2>
        <p style={{ ...FF.body, fontSize:15, fontWeight:300, color:lp.sageText, maxWidth:540, marginBottom:48, lineHeight:1.75 }}>
          TrashDrop offers two ways to book waste collection, built for how you actually live: QR Bags for regular rubbish collection
          with free pickup, or the Digital Bin for an on-demand trash pickup whenever you need one.
        </p>
        <div className="td-services-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* QR Bag */}
          <div style={{ background:TD.ink2, borderRadius:20, padding:'40px 44px', position:'relative', overflow:'hidden', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(40px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
            <div style={{ position:'absolute', top:-40, right:-40, width:220, height:220, borderRadius:'50%', background:`${TD.lime}0C`, pointerEvents:'none' }} />
            <span style={{ position:'absolute', top:16, right:24, ...FF.data, fontSize:100, color:'rgba(255,255,255,0.03)', lineHeight:1 }}>01</span>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${TD.lime}18`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'5px 12px', marginBottom:20 }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:TD.lime, display:'inline-block' }} />
              <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:TD.lime, textTransform:'uppercase' }}>Service One</span>
            </div>
            <h3 style={{ ...FF.display, fontSize:'clamp(28px,3vw,42px)', color:'#fff', lineHeight:1, margin:'0 0 4px', letterSpacing:'-0.5px' }}>The QR<br /><em style={{ color:TD.lime }}>Bag System</em></h3>
            <p style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:`${TD.lime}90`, textTransform:'uppercase', marginBottom:20 }}>Buy · Scan · Collect</p>
            <div style={{ width:36, height:2, background:TD.lime, borderRadius:99, marginBottom:28 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              {[
                ['1','Purchase Official Bags','Buy TrashDrop bags from any authorised vendor near you.'],
                ['2','Scan the QR Code','Each pack of bags has its own code. Scan it once to add all the bags to your account.'],
                ['3','Request Free Collection','When your bag is full, tap to request pickup — collection is completely free.']
              ].map(([n,t,d]) => (
                <div key={n} style={{ display:'flex', gap:14 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:`${TD.lime}20`, border:`1px solid ${TD.lime}35`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                    <span style={{ ...FF.label, fontSize:11, fontWeight:700, color:TD.lime }}>{n}</span>
                  </div>
                  <div>
                    <p style={{ ...FF.label, fontSize:11, fontWeight:700, color:TD.lime, letterSpacing:'0.5px', margin:'0 0 3px' }}>{t}</p>
                    <p style={{ ...FF.body, fontSize:13, fontWeight:300, color:'rgba(255,255,255,0.55)', margin:0, lineHeight:1.65 }}>{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:28, background:TD.lime, color:TD.ink, padding:'10px 20px', borderRadius:8, ...FF.label, fontSize:12, fontWeight:700, letterSpacing:'1px' }}>✦ Collection is FREE</div>
          </div>
          {/* Digital Bin */}
          <div style={{ background:TD.forest, borderRadius:20, padding:'40px 44px', position:'relative', overflow:'hidden', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(40px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.22s' }}>
            <div style={{ position:'absolute', bottom:-40, left:-40, width:200, height:200, borderRadius:'50%', background:'rgba(255,255,255,0.04)', pointerEvents:'none' }} />
            <span style={{ position:'absolute', top:16, right:24, ...FF.data, fontSize:100, color:'rgba(255,255,255,0.04)', lineHeight:1 }}>02</span>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:99, padding:'5px 12px', marginBottom:20 }}>
              <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', display:'inline-block' }} />
              <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:'#fff', textTransform:'uppercase' }}>Service Two</span>
            </div>
            <h3 style={{ ...FF.display, fontSize:'clamp(28px,3vw,42px)', color:'#fff', lineHeight:1, margin:'0 0 4px', letterSpacing:'-0.5px' }}>The Digital<br /><em style={{ color:'rgba(255,255,255,0.88)' }}>Bin Service</em></h3>
            <p style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:'rgba(255,255,255,0.55)', textTransform:'uppercase', marginBottom:20 }}>Request · Quote · Track</p>
            <div style={{ width:36, height:2, background:'rgba(255,255,255,0.4)', borderRadius:99, marginBottom:28 }} />
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              {[['1','Request On-Demand Pickup','Open the app and submit a Request Bin Pickup (No Bag) anytime, anywhere.'],
                ['2','Instant Price Quote','Get a clear price straight away — no surprises.'],
                ['3','Real-Time Collector Tracking','Your request is matched to a nearby collector. Track arrival live on the map.']].map(([n,t,d]) => (
                <div key={n} style={{ display:'flex', gap:14 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                    <span style={{ ...FF.label, fontSize:11, fontWeight:700, color:'#fff' }}>{n}</span>
                  </div>
                  <div>
                    <p style={{ ...FF.label, fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.88)', letterSpacing:'0.5px', margin:'0 0 3px' }}>{t}</p>
                    <p style={{ ...FF.body, fontSize:13, fontWeight:300, color:'rgba(255,255,255,0.65)', margin:0, lineHeight:1.65 }}>{d}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:28, background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'10px 20px', borderRadius:8, ...FF.label, fontSize:12, fontWeight:700, letterSpacing:'1px' }}>📍 Live Tracking</div>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MOBILE REPORT MOCKUP
   ═══════════════════════════════════════════════════════════════════════════════ */
const MobileReportMockup = () => {
  const [step, setStep] = useState(1);
  const [photoTaken, setPhotoTaken] = useState(false);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setStep(s => {
        if (s === 1 && photoTaken) return 2;
        if (s === 2) return 3;
        if (s === 3) { setPhotoTaken(false); return 1; }
        setPhotoTaken(true);
        return s;
      });
    }, 2500);
    return () => clearInterval(timer);
  }, [photoTaken]);

  return (
    <div style={{ position:'relative', width:280, flexShrink:0 }}>
      {/* Phone Frame */}
      <div style={{ 
        background:'#1a1a1a', 
        borderRadius:40, 
        padding:12, 
        boxShadow:'0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
        border:'2px solid #333'
      }}>
        {/* Screen */}
        <div style={{ 
          background:'#0a0a0a', 
          borderRadius:28, 
          overflow:'hidden',
          position:'relative'
        }}>
          {/* Notch */}
          <div style={{ 
            position:'absolute', 
            top:0, 
            left:'50%', 
            transform:'translateX(-50%)',
            width:120, 
            height:28, 
            background:'#1a1a1a',
            borderRadius:'0 0 20px 20px',
            zIndex:10
          }} />
          
          {/* Status Bar */}
          <div style={{ 
            display:'flex', 
            justifyContent:'space-between', 
            alignItems:'center',
            padding:'8px 20px 4px',
            background:'#0f1210'
          }}>
            <span style={{ ...FF.label, fontSize:11, color:'#fff', fontWeight:600 }}>9:41</span>
            <div style={{ display:'flex', gap:4 }}>
              <i className="fas fa-signal" style={{ color:'#fff', fontSize:10 }}></i>
              <i className="fas fa-wifi" style={{ color:'#fff', fontSize:10 }}></i>
              <i className="fas fa-battery-full" style={{ color:TD.lime, fontSize:10 }}></i>
            </div>
          </div>

          {/* App Header */}
          <div style={{ 
            background:TD.forest, 
            padding:'12px 16px',
            display:'flex',
            alignItems:'center',
            gap:10
          }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <img src="/logo.svg" alt="" style={{ width:18, height:18 }} />
            </div>
            <span style={{ ...FF.label, fontSize:13, color:'#fff', fontWeight:700 }}>Report Dump</span>
          </div>

          {/* App Content */}
          <div style={{ padding:'16px 16px 12px', minHeight:380, maxHeight:420, background:'#0f1210', position:'relative', overflow:'hidden' }}>
            {/* Step 1: Photo */}
            <div style={{ 
              opacity:step===1?1:0, 
              transition:'opacity 0.3s ease',
              position:step===1?'relative':'absolute',
              inset:step===1?'auto':'16px 16px 12px',
              pointerEvents:step===1?'auto':'none'
            }}>
              <p style={{ ...FF.label, fontSize:10, color:TD.lime, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 8px' }}>Step 1 of 3</p>
              <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.7)', margin:'0 0 12px', lineHeight:1.4 }}>Take a photo of the illegal dumping site</p>
              
              {/* Camera Viewfinder */}
              <div style={{ 
                height:160, 
                background:photoTaken?'rgba(168,230,61,0.08)':'#1a1a1a', 
                borderRadius:14, 
                border:`1.5px dashed ${photoTaken?TD.lime:'rgba(255,255,255,0.15)'}`,
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                gap:8,
                marginBottom:12,
                transition:'all 0.3s'
              }}>
                {photoTaken ? (
                  <>
                    <div style={{ width:52, height:52, borderRadius:10, background:'rgba(168,230,61,0.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <i className="fas fa-image" style={{ color:TD.lime, fontSize:22 }}></i>
                    </div>
                    <span style={{ ...FF.label, fontSize:11, color:TD.lime, fontWeight:600 }}>Photo captured!</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-camera" style={{ color:'rgba(255,255,255,0.25)', fontSize:28 }}></i>
                    <span style={{ ...FF.body, fontSize:11, color:'rgba(255,255,255,0.35)' }}>Tap to capture</span>
                  </>
                )}
              </div>

              <div style={{ display:'flex', gap:6 }}>
                <div style={{ flex:1, height:3, background:TD.lime, borderRadius:2 }} />
                <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2 }} />
                <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2 }} />
              </div>
            </div>

            {/* Step 2: Location */}
            <div style={{ 
              opacity:step===2?1:0, 
              transition:'opacity 0.3s ease',
              position:step===2?'relative':'absolute',
              inset:step===2?'auto':'16px 16px 12px',
              pointerEvents:step===2?'auto':'none'
            }}>
              <p style={{ ...FF.label, fontSize:10, color:TD.lime, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 8px' }}>Step 2 of 3</p>
              <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.7)', margin:'0 0 12px', lineHeight:1.4 }}>Confirm location</p>
              
              <div style={{ 
                height:140, 
                background:'#1a1a1a', 
                borderRadius:12, 
                border:'1px solid rgba(255,255,255,0.08)',
                display:'flex',
                alignItems:'center',
                justifyContent:'center',
                marginBottom:12,
                position:'relative',
                overflow:'hidden'
              }}>
                <div style={{ 
                  position:'absolute', 
                  inset:0,
                  background:'radial-gradient(circle at 50% 50%, rgba(168,230,61,0.08) 0%, transparent 60%)'
                }} />
                <div style={{ textAlign:'center', position:'relative', zIndex:1 }}>
                  <i className="fas fa-map-marker-alt" style={{ color:TD.lime, fontSize:26, marginBottom:4, display:'block' }}></i>
                  <p style={{ ...FF.body, fontSize:11, color:'rgba(255,255,255,0.5)', margin:'4px 0' }}>Accra, Ghana</p>
                  <p style={{ ...FF.label, fontSize:10, color:TD.lime, fontWeight:600, letterSpacing:'0.5px' }}>GPS Accurate</p>
                </div>
              </div>

              <div style={{ display:'flex', gap:6 }}>
                <div style={{ flex:1, height:3, background:TD.lime, borderRadius:2 }} />
                <div style={{ flex:1, height:3, background:TD.lime, borderRadius:2 }} />
                <div style={{ flex:1, height:3, background:'rgba(255,255,255,0.08)', borderRadius:2 }} />
              </div>
            </div>

            {/* Step 3: Submit */}
            <div style={{ 
              opacity:step===3?1:0, 
              transition:'opacity 0.3s ease',
              position:step===3?'relative':'absolute',
              inset:step===3?'auto':'16px 16px 12px',
              pointerEvents:step===3?'auto':'none'
            }}>
              <p style={{ ...FF.label, fontSize:10, color:TD.lime, fontWeight:700, letterSpacing:'1.5px', textTransform:'uppercase', margin:'0 0 8px' }}>Step 3 of 3</p>
              <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.7)', margin:'0 0 12px', lineHeight:1.4 }}>Review and submit</p>
              
              <div style={{ 
                background:'rgba(168,230,61,0.06)', 
                borderRadius:12, 
                border:`1px solid ${TD.lime}25`,
                padding:12,
                marginBottom:12
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ width:40, height:40, borderRadius:8, background:'rgba(168,230,61,0.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className="fas fa-image" style={{ color:TD.lime, fontSize:16 }}></i>
                  </div>
                  <div style={{ minWidth:0 }}>
                    <p style={{ ...FF.label, fontSize:11, color:'#fff', fontWeight:600, margin:0 }}>Photo attached</p>
                    <p style={{ ...FF.body, fontSize:10, color:'rgba(255,255,255,0.5)', margin:'2px 0 0' }}>Accra, Ghana</p>
                  </div>
                </div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {['Mixed Waste', 'Large', 'Critical'].map((tag, i) => (
                    <span key={tag} style={{ 
                      ...FF.label, 
                      fontSize:9, 
                      color:i===2?'#ef4444':TD.lime, 
                      background:i===2?'rgba(239,68,68,0.12)':'rgba(168,230,61,0.12)',
                      padding:'3px 8px',
                      borderRadius:4,
                      fontWeight:600,
                      whiteSpace:'nowrap'
                    }}>{tag}</span>
                  ))}
                </div>
              </div>

              <button style={{ 
                width:'100%', 
                padding:'11px', 
                background:TD.lime, 
                color:TD.ink, 
                border:'none', 
                borderRadius:10, 
                ...FF.label, 
                fontSize:13, 
                fontWeight:700,
                cursor:'pointer',
                marginBottom:10
              }}>
                Submit Report
              </button>

              <div style={{ display:'flex', gap:6 }}>
                <div style={{ flex:1, height:3, background:TD.lime, borderRadius:2 }} />
                <div style={{ flex:1, height:3, background:TD.lime, borderRadius:2 }} />
                <div style={{ flex:1, height:3, background:TD.lime, borderRadius:2 }} />
              </div>
            </div>
          </div>

          {/* Home Indicator */}
          <div style={{ 
            height:18, 
            background:'#0f1210',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            flexShrink:0
          }}>
            <div style={{ width:100, height:3, background:'rgba(255,255,255,0.25)', borderRadius:2 }} />
          </div>
        </div>
      </div>

      {/* Floating Badge */}
      <div style={{ 
        position:'absolute', 
        bottom:-10, 
        right:-20, 
        background:TD.lime, 
        color:TD.ink,
        padding:'8px 14px',
        borderRadius:20,
        ...FF.label,
        fontSize:11,
        fontWeight:700,
        boxShadow:'0 4px 20px rgba(168,230,61,0.4)',
        transform:'rotate(-5deg)'
      }}>
        <i className="fas fa-bolt" style={{ marginRight:4 }}></i> 30 sec report
      </div>
    </div>
  );
};

const RISK_PILL = { Critical:'#dc2626', High:'#ea580c', Medium:'#eab308', Low:'#22c55e' };

/* ─── Social feed overlay (absolute, bottom-right of map) ───────────────────── */
const SocialFeedOverlay = () => {
  const [open, setOpen] = useState(false);
  const [posts, setPosts] = useState([]);
  const [newId, setNewId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [paused, setPaused] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeSocialFeed((incoming, isInitial) => {
      if (paused && !isInitial) return;
      setPosts(prev => {
        if (!isInitial && incoming.length > 0) {
          setNewId(incoming[0].id);
          setTimeout(() => setNewId(null), 2200);
        }
        return incoming.slice(0, 15);
      });
    }, 8000);
    return unsub;
  }, [paused]);

  const platforms = ['all', 'twitter', 'facebook', 'instagram', 'tiktok'];
  const filtered = filter === 'all' ? posts : posts.filter(p => p.platform === filter);

  const panelBg    = 'rgba(8,12,8,0.93)';
  const borderCol  = 'rgba(168,230,61,0.18)';
  const headText   = '#f0f5f0';
  const subText    = 'rgba(255,255,255,0.4)';
  const cardBg     = 'rgba(255,255,255,0.04)';
  const cardBorder = 'rgba(255,255,255,0.08)';
  const bodyTxt    = 'rgba(255,255,255,0.78)';
  const metaTxt    = 'rgba(255,255,255,0.35)';
  const pillBg     = 'rgba(255,255,255,0.07)';

  return (
    <div style={{ position:'absolute', bottom:16, right:16, zIndex:1150, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>

      {/* Expanded panel */}
      {open && (
        <div style={{ width:320, maxWidth:'calc(100vw - 32px)', background:panelBg, border:`1px solid ${borderCol}`, borderRadius:18, overflow:'hidden', backdropFilter:'blur(20px)', boxShadow:'0 24px 60px rgba(0,0,0,0.7)', display:'flex', flexDirection:'column' }}>

          {/* Header */}
          <div style={{ padding:'11px 14px', borderBottom:`1px solid ${borderCol}`, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:TD.lime, flexShrink:0, boxShadow:`0 0 0 3px ${TD.lime}28`, animation:'td-pulse-dot 1.8s infinite' }} />
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, color:headText, letterSpacing:'1.5px', textTransform:'uppercase', flex:1 }}>Social Feed</span>
            <button onClick={() => setPaused(p => !p)} style={{ ...FF.label, fontSize:9, fontWeight:700, letterSpacing:'1px', textTransform:'uppercase', padding:'3px 9px', borderRadius:6, border:`1px solid ${borderCol}`, background:'transparent', color:paused ? TD.lime : subText, cursor:'pointer' }}>
              {paused ? '▶' : '⏸'}
            </button>
            <button onClick={() => setOpen(false)} style={{ width:22, height:22, borderRadius:6, border:`1px solid ${borderCol}`, background:'transparent', color:subText, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 }}>✕</button>
          </div>

          {/* Platform filters */}
          <div style={{ padding:'7px 12px', borderBottom:`1px solid ${borderCol}`, display:'flex', gap:5, flexWrap:'wrap' }}>
            {platforms.map(p => {
              const meta = PLATFORM_META[p];
              const active = filter === p;
              return (
                <button key={p} onClick={() => setFilter(p)} style={{ ...FF.label, fontSize:9, fontWeight:700, letterSpacing:'0.8px', textTransform:'uppercase', padding:'3px 10px', borderRadius:16, cursor:'pointer', transition:'all 0.2s', background: active ? (p === 'all' ? TD.forest : (meta?.color || TD.forest)) : pillBg, color: active ? '#fff' : 'rgba(255,255,255,0.45)', border: active ? 'none' : `1px solid ${borderCol}` }}>
                  {p === 'all' ? 'All' : (meta?.label || p)}
                </button>
              );
            })}
            <span style={{ ...FF.body, fontSize:9, color:subText, marginLeft:'auto', alignSelf:'center' }}>{filtered.length}</span>
          </div>

          {/* Feed list */}
          <div ref={listRef} style={{ maxHeight:340, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.length === 0 && (
              <div style={{ padding:'24px 0', textAlign:'center', color:subText, ...FF.body, fontSize:12 }}>Loading…</div>
            )}
            {filtered.map(post => {
              const meta = PLATFORM_META[post.platform] || {};
              const isNew = post.id === newId;
              const platColor = meta.darkColor || meta.color || TD.lime;
              const platBg    = meta.bgDark || 'rgba(255,255,255,0.06)';
              return (
                <div key={post.id} style={{ background: isNew ? 'rgba(168,230,61,0.07)' : cardBg, border:`1px solid ${isNew ? TD.lime+'40' : cardBorder}`, borderRadius:12, padding:'10px 11px', transition:'all 0.4s ease' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:platBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:12, fontWeight:700, color:platColor }}>{meta.icon || '?'}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span style={{ ...FF.label, fontSize:10, fontWeight:700, color:headText, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{post.handle}</span>
                        {post.verified && <span style={{ fontSize:9, color:platColor }}>✓</span>}
                        {isNew && <span style={{ ...FF.label, fontSize:8, fontWeight:700, color:TD.lime, background:`${TD.lime}20`, padding:'1px 5px', borderRadius:3 }}>NEW</span>}
                      </div>
                      <span style={{ ...FF.body, fontSize:9, color:metaTxt }}>{meta.label || post.platform} · {post.time}</span>
                    </div>
                    <span style={{ ...FF.label, fontSize:8, fontWeight:700, color:RISK_PILL[post.risk]||'#eab308', background:(RISK_PILL[post.risk]||'#eab308')+'18', padding:'2px 7px', borderRadius:5, textTransform:'uppercase', flexShrink:0 }}>{post.risk}</span>
                  </div>
                  <p style={{ ...FF.body, fontSize:12, color:bodyTxt, margin:'0 0 6px', lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{post.text}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ ...FF.body, fontSize:10, color:metaTxt, display:'flex', alignItems:'center', gap:3 }}><i className="fas fa-map-marker-alt" style={{ fontSize:8 }}></i>{post.location}</span>
                    <span style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                      <span style={{ ...FF.body, fontSize:10, color:metaTxt }}><i className="fas fa-heart" style={{ fontSize:8, color:'#e05c7a', marginRight:2 }}></i>{post.likes}</span>
                      <span style={{ ...FF.body, fontSize:10, color:metaTxt }}><i className="fas fa-share" style={{ fontSize:8, marginRight:2 }}></i>{post.shares}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding:'8px 14px', borderTop:`1px solid ${borderCol}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ ...FF.body, fontSize:9, color:subText }}>Updates every 8s</span>
            <a href="https://twitter.com/search?q=illegal+dumping+Accra" target="_blank" rel="noopener noreferrer" style={{ ...FF.label, fontSize:9, fontWeight:700, color:TD.lime, textDecoration:'none' }}>View on X ↗</a>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(8,12,8,0.92)', border:`1px solid ${borderCol}`, borderRadius:12, padding:'9px 14px', cursor:'pointer', backdropFilter:'blur(16px)', boxShadow:'0 8px 32px rgba(0,0,0,0.5)', transition:'all 0.2s' }}
      >
        <span style={{ width:7, height:7, borderRadius:'50%', background:TD.lime, flexShrink:0, boxShadow:`0 0 0 2px ${TD.lime}28`, animation:'td-pulse-dot 1.8s infinite' }} />
        <span style={{ ...FF.label, fontSize:11, fontWeight:700, color:headText, letterSpacing:'1px', textTransform:'uppercase' }}>
          {open ? 'Hide Feed' : 'Social Feed'}
        </span>
        {!open && posts.length > 0 && (
          <span style={{ ...FF.label, fontSize:9, fontWeight:700, color:TD.ink, background:TD.lime, padding:'1px 7px', borderRadius:10 }}>{posts.length}</span>
        )}
        <i className={`fas fa-chevron-${open ? 'down' : 'up'}`} style={{ fontSize:9, color:subText }} />
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   LIVE MAP
   ═══════════════════════════════════════════════════════════════════════════════ */
const MapPreviewSection = ({ isAuthenticated, dumpingData }) => {
  const navigate = useNavigate();
  const { ref, visible } = useReveal(0.05);
  const { lp, lpMode } = useLpTheme();
  const stats = computePublicStats(dumpingData.reports);
  const statsReady = dumpingData.status === 'ready';
  const tiles = [
    {label:'Total Reports',value:String(stats.total),icon:'fa-file-alt',color:'#4d9de0',bg:'rgba(77,157,224,0.12)', title:'Public reports on the map (excludes cancelled reports)'},
    {label:'Hotspot Zones',value:String(stats.hotspots),icon:'fa-map-pin',color:'#dc2626',bg:'rgba(220,38,38,0.12)', title:`Areas where ${HOTSPOT_MIN_REPORTS}+ active reports are each within 500 m of another`},
    {label:'Cleanup Rate',value:stats.cleanupRate === null ? '—' : `${Math.round(stats.cleanupRate)}%`,icon:'fa-broom',color:TD.lime,bg:`${TD.lime}14`, title:`${stats.cleanedUp} of ${stats.total} reports cleaned up`},
    {label:'Avg Response',value:formatDuration(stats.avgResponseHours),icon:'fa-clock',color:TD.gold,bg:`${TD.gold}14`, title:'Average time from report to cleanup, for cleaned-up reports'},
  ];
  // Logged-out visitors sign in first; logged-in users open the analytics map
  const openFullMap = () => navigate(isAuthenticated ? '/illegal-dumping/map' : '/login');
  return (
    <section id="map" style={{ background:lp.mapSectionBg, padding:'96px 0' }}>
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.lime, textTransform:'uppercase', display:'block', marginBottom:14, opacity:visible?1:0, transition:'opacity 0.6s ease' }}>Illegal Dumping Live Map</span>
          <h2 style={{ ...FF.display, fontSize:'clamp(34px,4.5vw,54px)', lineHeight:1.05, letterSpacing:'-1.5px', color:lp.sectionHeading, margin:'0 0 14px', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(28px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
            Track. Report. <em style={{ color:TD.lime }}>Eliminate</em> Illegal Dumping.
          </h2>
          <p style={{ ...FF.body, fontSize:16, fontWeight:300, color:lp.bodyText, maxWidth:620, margin:'0 auto 24px', lineHeight:1.75 }}>
            Beyond waste collection, TrashDrop helps communities, cities and environmental agencies across Ghana detect, report and clean up
            illegal dumping. Explore reported dumping sites across Ghana in real time.
          </p>
          <button
            onClick={() => navigate(isAuthenticated ? '/illegal-dumping/reports' : '/signup')}
            style={{ display:'inline-flex', alignItems:'center', gap:10, background:'transparent', color:lp.sectionHeading, ...FF.label, fontSize:14, fontWeight:700, padding:'12px 24px', borderRadius:10, cursor:'pointer', border:`1.5px solid ${TD.lime}55` }}>
            <i className="fas fa-exclamation-triangle" style={{ color:TD.gold }}></i> Report Illegal Dump
          </button>
        </div>
        
        {/* Two Column Layout: Mobile on Left, Map on Right */}
        <div style={{ display:'flex', gap:32, alignItems:'stretch', flexWrap:'wrap' }}>
          {/* Left: Mobile Report Mockup */}
          <div style={{ 
            display:'flex', 
            flexDirection:'column',
            gap:20,
            flex:1,
            minWidth:300,
            maxWidth:320
          }}>
            <MobileReportMockup />
            
            {/* Feature List below phone */}
            <div style={{ 
              background:lp.featureBoxBg, 
              border:`1px solid ${lp.featureBoxBorder}`, 
              borderRadius:16, 
              padding:20
            }}>
              <p style={{ ...FF.label, fontSize:12, color:lp.featureTitle, fontWeight:700, marginBottom:14, letterSpacing:'0.5px' }}>
                <i className="fas fa-mobile-alt" style={{ marginRight:8 }}></i> Mobile Reporting
              </p>
              {[
                { icon:'fa-camera', text:'Snap photos of dumping sites' },
                { icon:'fa-map-marker-alt', text:'Auto GPS location tagging' },
                { icon:'fa-paper-plane', text:'Instant report submission' },
                { icon:'fa-bell', text:'Real-time status updates' }
              ].map((f, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:i<3?10:0 }}>
                  <div style={{ width:26, height:26, borderRadius:6, background:lp.featureIconBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <i className={`fas ${f.icon}`} style={{ color:lp.featureIcon, fontSize:11 }}></i>
                  </div>
                  <span style={{ ...FF.body, fontSize:13, color:lp.featureText }}>{f.text}</span>
                </div>
              ))}
            </div>
            
          </div>

          {/* Right: Map (real reports, read-only) */}
          <div style={{ flex:2, minWidth:300 }}>
            <PublicDumpingMap lp={lp} isDark={lpMode === 'dark'} data={dumpingData}>
              <div style={{ position:'absolute', top:14, right:14, zIndex:1100 }}>
                <button onClick={openFullMap} style={{ display:'flex', alignItems:'center', gap:8, background:TD.forest, color:'#fff', border:'none', cursor:'pointer', ...FF.label, fontSize:12, fontWeight:700, padding:'10px 18px', borderRadius:10, boxShadow:`0 4px 20px ${TD.forest}60` }}>
                  <i className="fas fa-expand-arrows-alt"></i> Full Analytics Map
                </button>
              </div>
              {/* Social feed overlay — bottom-right corner of the map */}
              <SocialFeedOverlay />
            </PublicDumpingMap>
          </div>
        </div>

        <div className="td-map-stats" style={{ display:'grid', gridTemplateColumns:`repeat(${tiles.length},1fr)`, gap:16, marginTop:24 }}>
          {tiles.map(s => (
            <div key={s.label} data-testid="map-stat" title={s.title} style={{ background:lp.mapStatBg, border:`1px solid ${lp.mapStatBorder}`, borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`fas ${s.icon}`} style={{ color:s.color, fontSize:16 }}></i>
              </div>
              <div>
                <p style={{ ...FF.data, fontSize:28, color:lp.mapStatText, margin:0, lineHeight:1 }}>{statsReady ? s.value : '—'}</p>
                <p style={{ ...FF.label, fontSize:10, color:lp.mapStatLabel, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', margin:'3px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   IMPACT STATS
   ═══════════════════════════════════════════════════════════════════════════════ */
/* ─── Lightbox ───────────────────────────────────────────────────────────────── */
/** Alt text for the illegal-dumping photos (they show reported dump sites) */
const dumpPhotoAlt = (p) => `Illegal dumping reported on TrashDrop: ${p.label}`;

const DUMP_PHOTOS = [
  { src:'/images/chocked_bridge.jpeg',               label:'Bridge blockage · Accra' },
  { src:'/images/chocked_drainage_1.jpeg',           label:'Drainage blockage' },
  { src:'/images/chocked_pavement_1.jpeg',           label:'Pavement dump' },
  { src:'/images/chocked_drainage_2.jpeg',           label:'Drainage overflow' },
  { src:'/images/ksi_central_market.jpeg',           label:'Kumasi Central Market' },
  { src:'/images/chocked_pavement_2.jpeg',           label:'Pavement · Accra' },
  { src:'/images/chocked_pavement_3.jpeg',           label:'Roadside dump' },
  { src:'/images/chocked_pavement_4.jpeg',           label:'Blocked walkway' },
  { src:'/images/report_communal_bin_overflow.jpeg', label:'Bin overflow' },
];

const Lightbox = ({ photos, index, onClose, onPrev, onNext, onGoTo }) => {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext]);

  const photo = photos[index];
  return (
    <div
      onClick={onClose}
      style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      {/* Close */}
      <button onClick={onClose} style={{ position:'absolute', top:20, right:24, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', width:44, height:44, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000 }}>
        <i className="fas fa-times" />
      </button>
      {/* Counter */}
      <div style={{ position:'absolute', top:24, left:24, ...FF.label, fontSize:11, color:'rgba(255,255,255,0.45)', fontWeight:600, letterSpacing:'2px' }}>
        {index + 1} / {photos.length}
      </div>
      {/* Prev */}
      <button onClick={e=>{e.stopPropagation();onPrev();}} style={{ position:'absolute', left:16, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', color:'#fff', width:48, height:48, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, transition:'background 0.2s' }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.16)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
        <i className="fas fa-chevron-left" />
      </button>
      {/* Image */}
      <div onClick={e=>e.stopPropagation()} style={{ maxWidth:'90vw', maxHeight:'85vh', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <img src={photo.src} alt={dumpPhotoAlt(photo)} style={{ maxWidth:'100%', maxHeight:'78vh', borderRadius:12, objectFit:'contain', boxShadow:'0 32px 80px rgba(0,0,0,0.7)' }} />
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:TD.lime, display:'inline-block', flexShrink:0 }} />
          <span style={{ ...FF.label, fontSize:12, fontWeight:700, letterSpacing:'2px', color:'rgba(255,255,255,0.75)', textTransform:'uppercase' }}>{photo.label}</span>
        </div>
        {/* Thumbnail strip */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'center', maxWidth:600 }}>
          {photos.map((p,i) => (
            <button key={i} onClick={e=>{e.stopPropagation();onGoTo(i);}} style={{ padding:0, border:`2px solid ${i===index?TD.lime:'transparent'}`, borderRadius:6, overflow:'hidden', cursor:'pointer', background:'none', transition:'border-color 0.2s', width:44, height:44, flexShrink:0 }}>
              <img src={p.src} alt={dumpPhotoAlt(p)} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            </button>
          ))}
        </div>
      </div>
      {/* Next */}
      <button onClick={e=>{e.stopPropagation();onNext();}} style={{ position:'absolute', right:16, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.14)', color:'#fff', width:48, height:48, borderRadius:'50%', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, transition:'background 0.2s' }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.16)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,0.08)'}>
        <i className="fas fa-chevron-right" />
      </button>
    </div>
  );
};

const ImpactStatCard = ({ label, value, ready, icon, color, accent }) => {
  const { ref, visible } = useReveal(0.3);
  const { lp } = useLpTheme();
  const count = useCountUp(value, 2200, visible);
  return (
    <div ref={ref} style={{ textAlign:'center', padding:'36px 20px' }}>
      <div style={{ width:64, height:64, borderRadius:18, background:accent, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', transition:'transform 0.3s ease', cursor:'default' }}
        onMouseEnter={e=>e.currentTarget.style.transform='scale(1.1) rotate(-5deg)'}
        onMouseLeave={e=>e.currentTarget.style.transform='scale(1) rotate(0deg)'}>
        <i className={`fas ${icon}`} style={{ fontSize:24, color }}></i>
      </div>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'center', gap:2 }}>
        <span style={{ ...FF.data, fontSize:'clamp(44px,5vw,64px)', color:lp.impactCount, letterSpacing:'1px' }}>{ready ? count.toLocaleString() : '—'}</span>
      </div>
      <p style={{ ...FF.body, fontSize:13, color:lp.impactSub, fontWeight:400, margin:'6px 0 0' }}>{label}</p>
    </div>
  );
};

const ImpactSection = ({ dumpingData }) => {
  const { ref, visible } = useReveal(0.08);
  const { lp } = useLpTheme();
  const [lbIndex, setLbIndex] = useState(null);
  const lbOpen  = lbIndex !== null;
  const lbClose = () => setLbIndex(null);
  const lbPrev  = () => setLbIndex(i => (i - 1 + DUMP_PHOTOS.length) % DUMP_PHOTOS.length);
  const lbNext  = () => setLbIndex(i => (i + 1) % DUMP_PHOTOS.length);
  // Same reports as the live map above, so the two sections always agree
  const stats = computePublicStats(dumpingData.reports);
  const ready = dumpingData.status === 'ready';
  const STATS = [
    { label:'Dumps Reported',     value:stats.total,     icon:'fa-flag',          color:'#f87171', accent:'rgba(248,113,113,0.15)' },
    { label:'Cleaned Up',         value:stats.cleanedUp, icon:'fa-broom',         color:TD.lime,   accent:`${TD.lime}18`            },
    { label:'Waiting for Cleanup', value:stats.active,   icon:'fa-hourglass-half', color:TD.gold,  accent:`${TD.gold}18`            },
    { label:'Areas Reported',     value:stats.areas,     icon:'fa-map-marker-alt', color:'#60a5fa', accent:'rgba(96,165,250,0.15)'   },
  ];
  return (
    <section id="impact" style={{ background:lp.sectionForest, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:`radial-gradient(circle at 1px 1px,rgba(168,230,61,0.5) 1px,transparent 0)`, backgroundSize:'32px 32px', pointerEvents:'none' }} />
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'100px 24px' }}>
        <div style={{ textAlign:'center', marginBottom:72 }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:lp.impactLabel, textTransform:'uppercase', display:'block', marginBottom:16, opacity:visible?1:0, transition:'opacity 0.6s ease' }}>Environmental Impact</span>
          <h2 style={{ ...FF.display, fontSize:'clamp(36px,4.5vw,56px)', lineHeight:1.05, letterSpacing:'-1.5px', color:lp.sectionHeading, margin:'0 0 16px', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(28px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
            Making a <em style={{ color:TD.lime }}>Real Difference</em>
          </h2>
          <p style={{ ...FF.body, fontSize:16, fontWeight:300, color:lp.impactText, maxWidth:520, margin:'0 auto', lineHeight:1.75 }}>Every report, every cleanup, every community action adds up to meaningful environmental change across Ghana.</p>
        </div>
        {/* ── Photo evidence grid ── */}
        {lbOpen && <Lightbox photos={DUMP_PHOTOS} index={lbIndex} onClose={lbClose} onPrev={lbPrev} onNext={lbNext} onGoTo={setLbIndex} />}
        <div style={{ marginBottom:56, opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.15s' }}>
          {/* Top row: tall left + 2×2 right */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'180px 180px', gap:6, marginBottom:6 }}>
            {/* index 0 — tall left spanning 2 rows */}
            {[
              { style:{ gridRow:'1 / 3' }, idx:0 },
              { style:{},                   idx:1 },
              { style:{},                   idx:2 },
              { style:{},                   idx:3 },
              { style:{},                   idx:4 },
            ].map(({ style, idx }) => {
              const p = DUMP_PHOTOS[idx];
              return (
                <div key={idx} style={{ ...style, position:'relative', borderRadius:14, overflow:'hidden', cursor:'pointer' }}
                  onClick={() => setLbIndex(idx)}
                  onMouseEnter={e=>{e.currentTarget.querySelector('img').style.transform='scale(1.06)'; e.currentTarget.querySelector('.expand-icon').style.opacity='1';}}
                  onMouseLeave={e=>{e.currentTarget.querySelector('img').style.transform='scale(1)';    e.currentTarget.querySelector('.expand-icon').style.opacity='0';}}>
                  <img src={p.src} alt={dumpPhotoAlt(p)} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.55s cubic-bezier(.22,1,.36,1)' }} />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 55%)', pointerEvents:'none' }} />
                  <span style={{ position:'absolute', bottom:10, left:12, ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:'rgba(255,255,255,0.85)', textTransform:'uppercase' }}>{p.label}</span>
                  <span className="expand-icon" style={{ position:'absolute', top:10, right:10, width:28, height:28, borderRadius:'50%', background:'rgba(0,0,0,0.45)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.2s', pointerEvents:'none' }}>
                    <i className="fas fa-expand-alt" style={{ fontSize:11, color:'#fff' }} />
                  </span>
                </div>
              );
            })}
          </div>
          {/* Bottom row: 4 equal images (indices 5-8) */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
            {DUMP_PHOTOS.slice(5).map((img, i) => {
              const idx = i + 5;
              return (
                <div key={idx} style={{ position:'relative', height:130, borderRadius:12, overflow:'hidden', cursor:'pointer' }}
                  onClick={() => setLbIndex(idx)}
                  onMouseEnter={e=>{e.currentTarget.querySelector('img').style.transform='scale(1.07)'; e.currentTarget.querySelector('.expand-icon').style.opacity='1';}}
                  onMouseLeave={e=>{e.currentTarget.querySelector('img').style.transform='scale(1)';    e.currentTarget.querySelector('.expand-icon').style.opacity='0';}}>
                  <img src={img.src} alt={dumpPhotoAlt(img)} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform 0.55s cubic-bezier(.22,1,.36,1)' }} />
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 60%)', pointerEvents:'none' }} />
                  <span style={{ position:'absolute', bottom:9, left:11, ...FF.label, fontSize:9, fontWeight:700, letterSpacing:'1.5px', color:'rgba(255,255,255,0.82)', textTransform:'uppercase' }}>{img.label}</span>
                  <span className="expand-icon" style={{ position:'absolute', top:8, right:8, width:24, height:24, borderRadius:'50%', background:'rgba(0,0,0,0.45)', border:'1px solid rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity 0.2s', pointerEvents:'none' }}>
                    <i className="fas fa-expand-alt" style={{ fontSize:10, color:'#fff' }} />
                  </span>
                </div>
              );
            })}
          </div>
          {/* Caption */}
          <p style={{ ...FF.label, fontSize:11, color: lp.impactSub, textAlign:'center', marginTop:14, letterSpacing:'1px', fontWeight:600 }}>
            Real reports submitted by TrashDrop users across Ghana · Photos used with permission
          </p>
        </div>

        <div className="td-impact-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid rgba(168,230,61,0.1)', borderLeft:'1px solid rgba(168,230,61,0.1)' }}>
          {STATS.map((s,i) => (
            <div key={s.label} style={{ borderRight:'1px solid rgba(168,230,61,0.1)', borderBottom:'1px solid rgba(168,230,61,0.1)', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:`all 0.8s cubic-bezier(.22,1,.36,1) ${i*0.1}s` }}>
              <ImpactStatCard {...s} ready={ready} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   PATHWAYS
   ═══════════════════════════════════════════════════════════════════════════════ */
const PathwaysSection = () => {
  const { ref, visible } = useReveal(0.08);
  const { lp } = useLpTheme();
  const PATHWAYS = [
    { title:'Citizens & Communities',       icon:'fa-users',        color:TD.lime,   bg:`${TD.lime}15`,           border:`${TD.lime}25`,           cta:'Join as Community Reporter',         link:'/signup',
      features:['Report illegal dumping in real-time','Track environmental impact in your area','Participate in community cleanup events','Earn recognition for contributions'] },
    { title:'Municipal Authorities (MMDA)', icon:'fa-landmark',     color:'#4d9de0', bg:'rgba(77,157,224,0.15)', border:'rgba(77,157,224,0.25)', cta:'Register as Environmental Officer', link:'/signup', popular:true,
      features:['Monitor illegal dumping hotspots','Assign and dispatch cleanup teams','Track enforcement actions & outcomes','Generate compliance reports'] },
    { title:'Waste Management Operators',   icon:'fa-truck',        color:TD.gold,   bg:`${TD.gold}15`,           border:`${TD.gold}25`,           cta:'Register as Waste Operator',         link:'/signup',
      features:['Manage bins and collection points','Optimize waste collection routes','Track operational performance KPIs','Real-time fleet and schedule management'] },
  ];
  return (
    <section id="pathways" style={{ background:lp.sectionPathway, position:'relative', overflow:'hidden', padding:'100px 0' }}>
      <div style={{ position:'absolute', top:-120, right:-120, width:500, height:500, borderRadius:'50%', background:`${TD.lime}08`, pointerEvents:'none', filter:'blur(80px)' }} />
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ textAlign:'center', marginBottom:64 }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:lp.pathwaysLabel, textTransform:'uppercase', display:'block', marginBottom:14, opacity:visible?1:0, transition:'opacity 0.6s ease' }}>Get Involved</span>
          <h2 style={{ ...FF.display, fontSize:'clamp(36px,4.5vw,56px)', lineHeight:1.05, letterSpacing:'-1.5px', color:lp.ink2Heading, margin:'0 0 16px', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(28px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
            Choose Your <em style={{ color:TD.forest }}>Pathway</em>
          </h2>
          <p style={{ ...FF.body, fontSize:16, fontWeight:300, color:lp.sageText, maxWidth:520, margin:'0 auto', lineHeight:1.75 }}>
            Whether you're a citizen, government official, or waste operator — TrashDrop has tools designed specifically for you.
          </p>
        </div>
        <div className="td-pathways-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
          {PATHWAYS.map((p,i) => (
            <div key={p.title} className="td-pathway-card" style={{ position:'relative', background:lp.pathwayCardBg, border:`1.5px solid ${p.popular?p.color:'rgba(0,0,0,0.07)'}`, borderRadius:22, padding:'36px 28px', boxShadow:p.popular?`0 20px 60px ${p.color}18`:'0 4px 24px rgba(0,0,0,0.05)', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(40px)', transition:`all 0.9s cubic-bezier(.22,1,.36,1) ${i*0.15}s`, cursor:'default' }}>
              {p.popular && <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:p.color, color:'#fff', ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'2px', padding:'6px 16px', borderRadius:99, whiteSpace:'nowrap', textTransform:'uppercase', boxShadow:`0 4px 16px ${p.color}60` }}>MOST POPULAR</div>}
              <div style={{ width:56, height:56, borderRadius:16, background:p.bg, border:`1px solid ${p.border}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                <i className={`fas ${p.icon}`} style={{ fontSize:22, color:p.color }}></i>
              </div>
              <h3 style={{ ...FF.display, fontSize:22, color:lp.ink2Heading, margin:'0 0 20px', letterSpacing:'-0.3px' }}>{p.title}</h3>
              <ul style={{ margin:'0 0 28px', padding:0, listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <i className="fas fa-check-circle" style={{ color:p.color, fontSize:14, marginTop:2, flexShrink:0 }}></i>
                    <span style={{ ...FF.body, fontSize:14, fontWeight:300, color:lp.pathwayText, lineHeight:1.6 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link to={p.link} style={{ display:'block', textAlign:'center', ...FF.label, fontSize:13, fontWeight:700, letterSpacing:'0.5px', padding:14, borderRadius:12, textDecoration:'none', background:p.popular?p.color:'transparent', color:p.popular?(p.color===TD.lime?TD.ink:'#fff'):p.color, border:p.popular?'none':`1.5px solid ${p.color}`, boxShadow:p.popular?`0 6px 24px ${p.color}40`:'none', transition:'all 0.2s ease' }}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   PARTNERSHIPS
   ═══════════════════════════════════════════════════════════════════════════════ */
const PartnershipsSection = () => {
  const { ref, visible } = useReveal(0.08);
  const { lp } = useLpTheme();
  const USE_CASES = [
    { title:'Smart Cities',              desc:"Integrate TrashDrop into your city's digital infrastructure for real-time waste intelligence.", icon:'fa-city',        color:'#60a5fa' },
    { title:'Municipal Waste Agencies',  desc:'Streamline operations, track compliance, and optimize resource allocation.',                   icon:'fa-building',    color:TD.lime   },
    { title:'Environmental NGOs',        desc:'Leverage data insights to drive advocacy and community-based cleanup programs.',               icon:'fa-globe-africa',color:'#34d399' },
    { title:'Recycling Companies',       desc:'Identify waste streams, optimize collection routes, and increase recycling rates.',            icon:'fa-recycle',     color:TD.gold   },
  ];
  return (
    <section id="partners" style={{ background:lp.sectionPartner, padding:'100px 0' }}>
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>
        <div className="td-partners-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
          <div>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:`${TD.lime}70`, textTransform:'uppercase', display:'block', marginBottom:16, opacity:visible?1:0, transition:'opacity 0.6s ease' }}>Partnerships</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(36px,4.5vw,52px)', lineHeight:1.05, letterSpacing:'-1.5px', color:'#f0f5f0', margin:'0 0 20px', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(28px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
              Partner With <em style={{ color:TD.lime }}>TrashDrop</em>
            </h2>
            <p style={{ ...FF.body, fontSize:16, fontWeight:300, color:lp.partnerP, lineHeight:1.75, marginBottom:36 }}>
              Join a growing network of cities, agencies, and organizations using TrashDrop to build cleaner, smarter communities across Ghana and Africa.
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
              <Link to="/signup"
                style={{ display:'inline-flex', alignItems:'center', gap:8, background:TD.lime, color:TD.ink, ...FF.label, fontSize:13, fontWeight:700, padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 28px ${TD.lime}40`, transition:'all 0.2s ease' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow=`0 14px 36px ${TD.lime}55`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=`0 8px 28px ${TD.lime}40`;}}>
                <i className="fas fa-calendar-check"></i> Request Demo
              </Link>
              <a href="mailto:partnerships@trashdrops.com"
                style={{ display:'inline-flex', alignItems:'center', gap:8, background:'transparent', color:'rgba(255,255,255,0.75)', ...FF.label, fontSize:13, fontWeight:700, padding:'14px 28px', borderRadius:10, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.15)', transition:'all 0.2s ease' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}50`;e.currentTarget.style.color=TD.lime;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.15)';e.currentTarget.style.color='rgba(255,255,255,0.75)';}}>
                <i className="fas fa-envelope"></i> City Deployment
              </a>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {USE_CASES.map((uc,i) => (
              <div key={uc.title} className="td-partner-tile" style={{ background:lp.partnerTileBg, border:`1px solid ${lp.partnerTileB}`, borderRadius:16, padding:24, cursor:'pointer', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:`all 0.8s cubic-bezier(.22,1,.36,1) ${0.2+i*0.1}s` }}>
                <div style={{ width:44, height:44, borderRadius:12, background:`${uc.color}15`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                  <i className={`fas ${uc.icon}`} style={{ color:uc.color, fontSize:18 }}></i>
                </div>
                <h4 style={{ ...FF.display, fontSize:17, color:lp.partnerH4, margin:'0 0 8px', letterSpacing:'-0.3px' }}>{uc.title}</h4>
                <p style={{ ...FF.body, fontSize:13, fontWeight:300, color:lp.partnerP, lineHeight:1.65, margin:0 }}>{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SERVICE AREAS
   ═══════════════════════════════════════════════════════════════════════════════ */
// First few neighbourhoods from each city page, e.g. "East Legon, Madina, Adenta…"
const cityAreas = (slug) => `${CITY_CONTENT[slug].areas.slice(0, 3).join(', ')}…`;

const ServiceAreasSection = () => {
  const { lp } = useLpTheme();
  return (
    <section id="service-areas" style={{ background:lp.sectionAlt, padding:'72px 0' }}>
      <div style={{ maxWidth:1280, margin:'0 auto' }}>
        <div style={{ padding:'0 24px', marginBottom:24 }}>
          <h2 style={{ ...FF.display, fontSize:'clamp(30px,4vw,44px)', color:lp.ink2Heading, margin:'0 0 6px', letterSpacing:'-1px', lineHeight:1.05 }}>
            Waste collection near you
          </h2>
          <p style={{ ...FF.body, fontSize:16, color:lp.sageText, margin:0 }}>Pick your city to see the areas we cover.</p>
        </div>
        <ul className="td-city-row" style={{ listStyle:'none', margin:0, padding:'4px 24px 16px', display:'grid', gridAutoFlow:'column', gridAutoColumns:'minmax(250px, 1fr)', gap:16, overflowX:'auto', scrollSnapType:'x mandatory', scrollPaddingInline:24, WebkitOverflowScrolling:'touch' }}>
          {CITY_PAGES.map(city => (
            <li key={city.slug} style={{ scrollSnapAlign:'start' }}>
              <Link to={city.path} style={{ display:'block', background:lp.cardBg, border:`1px solid ${lp.cardBorder}`, borderRadius:16, overflow:'hidden', textDecoration:'none', height:'100%' }}>
                {CITY_CARD_PHOTOS[city.slug]
                  ? <img src={CITY_CARD_PHOTOS[city.slug]} alt={`TrashDrop waste pickup in ${city.name}`} width="640" height="420" loading="lazy" decoding="async"
                      style={{ display:'block', width:'100%', height:'auto', aspectRatio:'640 / 420', objectFit:'cover', background:'#e5e7eb' }} />
                  : <div aria-hidden="true" style={{ aspectRatio:'640 / 420', background:`linear-gradient(135deg, ${TD.forest}, #8FC638)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ ...FF.display, fontSize:30, color:'#fff' }}><i className="fas fa-map-marker-alt" style={{ fontSize:22, marginRight:10 }}></i>{city.name}</span>
                    </div>}
                <div style={{ padding:'14px 16px 16px' }}>
                  <h3 style={{ ...FF.display, fontSize:20, color:lp.ink2Heading, margin:'0 0 4px' }}>Waste collection in {city.name}</h3>
                  <p style={{ ...FF.body, fontSize:14, color:lp.sageText, margin:0, lineHeight:1.5 }}>{cityAreas(city.slug)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   FAQ
   ═══════════════════════════════════════════════════════════════════════════════ */
const HOME_FAQS = [
  {
    q: 'How do I book a waste pickup in Ghana?',
    a: 'Sign up at trashdrops.com or WhatsApp us on +233 20 933 8885. Choose QR Bag pickup, which is free once your bags are registered, or Digital Bin for a one-off pickup with an instant price. A verified collector takes your request, and you can follow them until the job is done.',
  },
  {
    q: 'How does TrashDrop work?',
    a: 'Six steps: get TrashDrop bags, scan the code on the pack, fill a bag, request a pickup, a verified collector arrives, and you track your waste until it reaches an approved disposal site. For a one-off pickup, choose Digital Bin, get a price and pay with MoMo or cash.',
  },
  {
    q: 'Do I need to download an app?',
    a: "No. TrashDrop works in your phone's browser at trashdrops.com, on Android and iPhone.",
  },
  {
    q: 'How are QR Bag pickups free?',
    a: 'You buy official TrashDrop bags from an approved seller. Each pack has a code; scan it to register your bags. After that, every pickup is free. You only pay for the bags.',
  },
  {
    q: 'How can I earn money collecting waste?',
    a: 'Open the TrashDrop Carter App at trashdrops.com, verify your phone number, upload your Ghana Card and vehicle details, and wait for approval. Then accept pickup jobs near you. The app keeps working when you are offline. Collectors earn ₵32.43 a pickup on average, paid straight to mobile money. Full-time collectors earn ₵2,500–₵8,000 a month.',
  },
  {
    q: 'How do I report illegal dumping?',
    a: 'Tap Report dumping, take a clear photo, share your location and send. You earn reward points, and we send a cleanup crew and tell the local assembly. You can follow the cleanup in the app.',
  },
  {
    q: 'Which cities do you serve?',
    a: 'Accra (including East Legon, Dome, Madina, Spintex and Achimota), Kumasi, Takoradi and Tamale. More cities are coming.',
  },
  {
    q: 'How do I pay?',
    a: 'Digital Bin pickups: MTN MoMo, Telecel Cash, AirtelTigo Money, card or cash, paid at pickup. QR Bag pickups are always free; you only pay for the bags.',
  },
  {
    q: 'Are the collectors verified?',
    a: "Yes. Before we approve a collector, they show a valid Ghana ID (Ghana Card, passport or voter ID), their vehicle registration and an operating licence. You can see each collector's rating and vehicle in the app.",
  },
];

const FAQSection = () => {
  const { ref, visible } = useReveal(0.08);
  const { lp, lpMode } = useLpTheme();
  const isDark = lpMode === 'dark';
  const [openIdx, setOpenIdx] = useState(null);

  const sectionBg     = isDark ? '#0e1a0e'                    : '#f0f9f0';
  const borderColor   = isDark ? 'rgba(255,255,255,0.14)'      : 'rgba(22,101,52,0.18)';
  const headingColor  = isDark ? '#f0f5f0'                     : '#1b3a28';
  const subColor      = isDark ? 'rgba(255,255,255,0.60)'      : '#4a7060';
  const answerColor   = isDark ? 'rgba(255,255,255,0.72)'      : '#2d4a38';
  const questionColor = isDark ? '#e8f5e8'                     : '#1b3a28';
  const badgeBg       = isDark ? `${TD.lime}18`                : `${TD.forest}12`;
  const badgeBorder   = isDark ? `${TD.lime}35`                : `${TD.forest}25`;
  const badgeColor    = isDark ? TD.lime                       : TD.forest;
  const sectionBorder = isDark ? 'rgba(168,230,61,0.08)'       : 'rgba(22,101,52,0.08)';
  const chevronColor  = isDark ? TD.lime                       : TD.forest;
  const chevronBorder = isDark ? `${TD.lime}55`                : `${TD.forest}40`;
  const chevronBg     = isDark ? `${TD.lime}20`                : `${TD.forest}12`;
  const linkColor     = isDark ? TD.lime                       : TD.forest;

  return (
    <section style={{ background: sectionBg, padding:'96px 24px', borderTop:`1px solid ${sectionBorder}` }}>
      {/* FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": HOME_FAQS.map(f => ({
            "@type": "Question",
            "name": f.q,
            "acceptedAnswer": { "@type": "Answer", "text": f.a }
          }))
        })}}
      />
      <div ref={ref} style={{ maxWidth:860, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56, opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(24px)', transition:'all 0.8s cubic-bezier(.22,1,.36,1)' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:badgeBg, border:`1px solid ${badgeBorder}`, borderRadius:99, padding:'6px 16px', marginBottom:16 }}>
            <i className="fas fa-question-circle" style={{ color:badgeColor, fontSize:11 }}></i>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:badgeColor, textTransform:'uppercase' }}>FAQ</span>
          </div>
          <h2 style={{ ...FF.display, fontSize:'clamp(30px,4vw,52px)', color:headingColor, margin:'0 0 12px', letterSpacing:'-1px', lineHeight:1.05 }}>
            Frequently asked questions
          </h2>
          <p style={{ ...FF.body, fontSize:16, color:subColor, maxWidth:520, margin:'0 auto' }}>
            Everything you need to know about TrashDrop waste collection in Ghana.
          </p>
        </div>

        <div style={{ opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
          {HOME_FAQS.map((item, i) => (
            <div key={i} style={{ borderBottom:`1px solid ${borderColor}`, overflow:'hidden' }}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                style={{ width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'22px 0', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16 }}>
                <span style={{ ...FF.body, fontSize:16, fontWeight:600, color:questionColor, lineHeight:1.5 }}>{item.q}</span>
                <span style={{ width:30, height:30, borderRadius:'50%', border:`1.5px solid ${chevronBorder}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.25s', background: openIdx===i ? chevronBg : 'transparent' }}>
                  <i className={`fas fa-chevron-${openIdx===i?'up':'down'}`} style={{ fontSize:11, color:chevronColor }}></i>
                </span>
              </button>
              <div style={{ maxHeight: openIdx===i ? 400 : 0, overflow:'hidden', transition:'max-height 0.38s cubic-bezier(.22,1,.36,1)' }}>
                <p style={{ ...FF.body, fontSize:15, color:answerColor, lineHeight:1.78, paddingBottom:22, margin:0 }}>{item.a}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:48 }}>
          <a href="/how-it-works/" style={{ ...FF.label, fontSize:13, fontWeight:700, color:linkColor, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
            See full How It Works guide <i className="fas fa-arrow-right" style={{ fontSize:11, color:linkColor }}></i>
          </a>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════════════════════ */
const HomeFooter = () => {
  const { lp } = useLpTheme();
  return (
  <footer style={{ background:lp.footerBg, borderTop:`1px solid ${lp.footerBorder}` }}>
    <div style={{ maxWidth:1280, margin:'0 auto', padding:'72px 24px 32px' }}>
      <div className="td-footer-grid" style={{ display:'grid', gridTemplateColumns:'1.8fr 1fr 1fr 1fr', gap:48, marginBottom:64 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <img src="/logo.svg" alt="TrashDrop" style={{ height:40, width:40 }} />
            <span style={{ ...FF.label, fontSize:20, fontWeight:800, color:'#fff', letterSpacing:'-0.3px' }}>Trash<span style={{ color:TD.lime }}>Drop</span></span>
          </div>
          <p style={{ ...FF.body, fontSize:14, fontWeight:300, color:'rgba(255,255,255,0.38)', lineHeight:1.75, maxWidth:280, marginBottom:24 }}>
            Trash and waste collection in Accra, Kumasi, Takoradi and Tamale, plus illegal dumping reporting across Ghana. Call or WhatsApp {BUSINESS.phoneDisplay}.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            {[['fab fa-twitter','#'],['fab fa-facebook-f','#'],['fab fa-linkedin-in','#'],['fab fa-instagram','#']].map(([ic,href]) => (
              <a key={ic} href={href} className="td-social-btn" style={{ width:36, height:36, borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.5)', textDecoration:'none', transition:'all 0.2s ease', fontSize:13 }}>
                <i className={ic}></i>
              </a>
            ))}
          </div>
        </div>
        {[
          { title:'Waste Collection', links:[...CITY_PAGES.map(c => [c.name, c.path]), ['On-demand waste pickup', WASTE_PICKUP_PATH]] },
          { title:'Platform', links:[['How It Works','/how-it-works/'],['FAQ','/faq/'],['For Households','/users/'],['Earn as a Collector','/collectors/'],['Report Dumping','/illegal-dumping/']] },
          { title:'Company',  links:[['About Us','/about/'],['Blog','/blog/'],['Partners','/partners/'],['WhatsApp Us',BUSINESS.whatsappUrl],['Contact Us','mailto:hello@trashdrops.com']] },
        ].map(col => (
          <div key={col.title}>
            <h4 style={{ ...FF.label, fontSize:12, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'rgba(255,255,255,0.55)', marginBottom:20 }}>{col.title}</h4>
            {col.links.map(([label,href]) => (
              href.startsWith('/') || href.startsWith('#')
                ? <Link key={label} to={href.startsWith('/')? href : '#'} className="td-footer-link" style={{ display:'block', ...FF.body, fontSize:14, fontWeight:300, color:'rgba(255,255,255,0.38)', textDecoration:'none', marginBottom:10, transition:'color 0.2s' }}>{label}</Link>
                : <a key={label} href={href} className="td-footer-link" style={{ display:'block', ...FF.body, fontSize:14, fontWeight:300, color:'rgba(255,255,255,0.38)', textDecoration:'none', marginBottom:10, transition:'color 0.2s' }}>{label}</a>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:28, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <p style={{ ...FF.body, fontSize:13, fontWeight:300, color:'rgba(255,255,255,0.28)', margin:0 }}>&copy; {new Date().getFullYear()} TrashDrop by Infobrix Limited. All rights reserved.</p>
        <p style={{ ...FF.body, fontSize:13, fontWeight:300, color:'rgba(255,255,255,0.22)', margin:0 }}>Built for cleaner cities across Ghana and Africa.</p>
      </div>
    </div>
  </footer>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   APP DOWNLOAD BANNER
   ═══════════════════════════════════════════════════════════════════════════════ */
const CollectorsLine = () => {
  const { lp } = useLpTheme();
  return (
    <section style={{ background:lp.pageBg, padding:'40px 24px' }}>
      <p style={{ ...FF.body, fontSize:17, lineHeight:1.6, color:lp.ink2Heading, textAlign:'center', maxWidth:720, margin:'0 auto' }}>
        We work with existing collectors and aboboyaa crews, giving them better tools and steady jobs.
      </p>
    </section>
  );
};

const AppDownloadBanner = () => {
  const { isDark } = useLpTheme();
  return (
    <section style={{ background: isDark ? '#0a140a' : '#f0faf2', padding:'64px 24px' }}>
      <div style={{
        maxWidth: 960,
        margin: '0 auto',
        background: TD.lime,
        borderRadius: 24,
        padding: '52px 56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 40,
        position: 'relative',
        overflow: 'hidden',
        flexWrap: 'wrap',
        boxShadow: `0 24px 80px ${TD.lime}50`,
      }}>
        {/* Subtle background texture */}
        <div style={{ position:'absolute', inset:0, opacity:0.06, backgroundImage:`linear-gradient(${TD.ink} 1px,transparent 1px),linear-gradient(90deg,${TD.ink} 1px,transparent 1px)`, backgroundSize:'36px 36px', pointerEvents:'none' }} />
        {/* Decorative orb */}
        <div style={{ position:'absolute', top:-60, right:220, width:260, height:260, borderRadius:'50%', background:`rgba(0,0,0,0.06)`, pointerEvents:'none' }} />

        {/* Left: text */}
        <div style={{ position:'relative', zIndex:1, flex:1, minWidth:260 }}>
          <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'4px', color:`${TD.ink}80`, textTransform:'uppercase', display:'block', marginBottom:12 }}>GET STARTED TODAY — IT&rsquo;S FREE</span>
          <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,50px)', color:TD.ink, lineHeight:1.05, letterSpacing:'-1px', margin:'0 0 28px' }}>
            Book your first pickup.<br />Or report an illegal dump.
          </h2>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <a href="/signup" style={{ display:'inline-flex', alignItems:'center', gap:10, background:TD.ink, color:'#fff', ...FF.label, fontSize:13, fontWeight:700, padding:'13px 24px', borderRadius:10, textDecoration:'none', boxShadow:`0 6px 24px rgba(0,0,0,0.25)`, transition:'transform 0.2s ease' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <i className="fas fa-leaf" style={{ fontSize:14 }}></i> Book a Pickup
            </a>
            <a href="/illegal-dumping/" style={{ display:'inline-flex', alignItems:'center', gap:10, background:'rgba(0,0,0,0.12)', color:TD.ink, ...FF.label, fontSize:13, fontWeight:700, padding:'13px 24px', borderRadius:10, textDecoration:'none', border:`1.5px solid rgba(0,0,0,0.18)`, transition:'transform 0.2s ease' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <i className="fas fa-exclamation-triangle" style={{ fontSize:13 }}></i> Report a Dump
            </a>
          </div>
        </div>

        {/* Right: QR code */}
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:12, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
            <img
              src="/images/book-in-app-qr.png"
              alt="Scan to download TrashDrop"
              style={{ width:148, height:148, display:'block', borderRadius:8 }}
            />
          </div>
          <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:`${TD.ink}80`, textTransform:'uppercase' }}>SCAN TO DOWNLOAD</span>
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   FLOATING FAB
   ═══════════════════════════════════════════════════════════════════════════════ */
// Fixed, so it never moves the page. Shows once the top booking card has scrolled out of view.
const StickyBookButton = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const card = document.getElementById('book');
    if (!card || !('IntersectionObserver' in window)) return undefined;
    const obs = new IntersectionObserver(([e]) => setShow(!e.isIntersecting));
    obs.observe(card);
    return () => obs.disconnect();
  }, []);
  const goToCard = (e) => {
    e.preventDefault();
    document.getElementById('book').scrollIntoView({ behavior:'smooth', block:'center' });
  };
  return (
    <div className="td-sticky-book" data-testid="sticky-book" aria-hidden={!show}
      style={{ position:'fixed', zIndex:2000, transition:'transform 0.25s ease, opacity 0.25s ease', transform: show ? 'none' : 'translateY(140%)', opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}>
      <a href="#book" onClick={goToCard} tabIndex={show ? 0 : -1}
        style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, height:52, padding:'0 26px', borderRadius:999, background:TD.lime, color:TD.ink, ...FF.label, fontSize:16, fontWeight:700, textDecoration:'none', boxShadow:'0 8px 28px rgba(0,0,0,0.28)' }}>
        <i className="fas fa-truck" aria-hidden="true"></i> Book a pickup
      </a>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   PRICING  (kept from existing, restyled)
   ═══════════════════════════════════════════════════════════════════════════════ */
const PricingGuideSection = () => {
  const { ref, visible } = useReveal(0.05);
  const { lp } = useLpTheme();
  const PLANS = [
    { type:'Recyclable', color:'#4d9de0', bg:'#1a2a3a', badge:'LOWEST PRICE · BEST VALUE', desc:'Plastics, paper, metals. Collector earns from material resale.',
      prices:[{l:'Small',s:'90L',p:'₵115'},{l:'Medium',s:'120L',p:'₵140'},{l:'Large',s:'240L',p:'₵170'}] },
    { type:'General',    color:'#f0a830', bg:'#2a2016', badge:'MOST FLEXIBLE',              desc:'Everyday mixed waste. Standard collection, no sorting required.',
      prices:[{l:'Small',s:'90L',p:'₵140'},{l:'Medium',s:'120L',p:'₵165'},{l:'Large',s:'240L',p:'₵195'}] },
    { type:'Organic',    color:TD.lime,   bg:'#1a2a16', badge:'ECO-PREMIUM',                desc:'Food scraps, garden waste. Composting-ready handling.',
      prices:[{l:'Small',s:'90L',p:'₵160'},{l:'Medium',s:'120L',p:'₵195'},{l:'Large',s:'240L',p:'₵225'}] },
  ];
  const SUBS = [
    { pct:'5%',  tier:'BASIC',     items:['1 batch/month','Any type or size','Cancel anytime'],              ex:'e.g. Recyclable Small — ₵109/mo' },
    { pct:'10%', tier:'REGULAR',   items:['2 batches/month','Mix & match type and size'],                    ex:'e.g. 2× General Medium — ₵297/mo', popular:true },
    { pct:'15%', tier:'HOUSEHOLD', items:['6 batches','Quarterly prepay','Full mix & match'],                ex:'e.g. 6× Recyclable Small — ₵586/qtr' },
  ];
  return (
    <section id="pricing" style={{ background:lp.sectionPricing }}>
      <div style={{ position:'relative', overflow:'hidden', minHeight:340, display:'flex', alignItems:'center', background:'#0a1a0a' }}>
        {/* 3-image row — right 50% of the banner, full height */}
        <div style={{ position:'absolute', top:0, right:0, height:'100%', display:'flex', alignItems:'stretch', gap:2, zIndex:1 }}>
          <img src="/images/home/pricing-bags-1.jpg" width="1054" height="700" loading="lazy" decoding="async" alt="TrashDrop QR-coded waste bags for organic, general and recyclable waste"     style={{ height:'100%', width:'auto', display:'block', opacity:0.85 }} />
          <img src="/images/home/pricing-bags-2.jpg" width="1086" height="578" loading="lazy" decoding="async" alt="QR code label on a TrashDrop waste collection bag"     style={{ height:'100%', width:'auto', display:'block' }} />
        </div>
        {/* Dark gradient — solid left, barely touches the image area on the right */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, #0a1a0a 0%, #0a1a0a 40%, rgba(10,26,10,0.7) 52%, rgba(10,26,10,0.08) 68%, transparent 100%)', zIndex:2 }} />
        {/* Subtle lime grid overlay */}
        <div style={{ position:'absolute', inset:0, zIndex:2, opacity:0.03, backgroundImage:`linear-gradient(rgba(168,230,61,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(168,230,61,0.6) 1px,transparent 1px)`, backgroundSize:'40px 40px' }} />
        {/* Lime left-edge accent line */}
        <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:`linear-gradient(to bottom,transparent,${TD.lime},transparent)`, zIndex:3 }} />
        <div style={{ position:'absolute', top:16, right:16, background:TD.lime, color:TD.ink, ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'2px', padding:'6px 14px', borderRadius:4, zIndex:4 }}>2026 PRICING</div>
        <div style={{ position:'relative', zIndex:3, padding:'60px 40px', maxWidth:'50%' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:28, height:2, background:TD.lime }} />
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'5px', color:TD.lime, textTransform:'uppercase' }}>Smart Waste</span>
          </div>
          <h2 style={{ ...FF.data, fontSize:'clamp(52px,7vw,88px)', color:'#fff', lineHeight:0.9, letterSpacing:'2px', margin:0 }}>SMART WASTE.<br /><span style={{ color:TD.lime }}>FAIR PRICE.</span></h2>
          <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.52)', marginTop:16, lineHeight:1.6 }}>QR-tagged bags · on-demand pickup · no hidden fees<br />Prices from ₵115/batch · Free collection on all plans</p>
        </div>
      </div>
      <div style={{ background:TD.lime, textAlign:'center', ...FF.label, fontSize:12, fontWeight:700, letterSpacing:'2px', color:TD.ink, padding:12, textTransform:'uppercase' }}>+ Collection is FREE on every bag in the batch</div>
      <div ref={ref} style={{ padding:'48px 40px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
          <div style={{ width:36, height:2, background:TD.lime }} />
          <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:lp.subTierLabel, textTransform:'uppercase' }}>Bag Pricing — Per batch of 5 bags</span>
        </div>
        <div className="td-pricing-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {PLANS.map((p,i) => (
            <div key={p.type} style={{ background:lp.subBg, border:`1px solid ${lp.sectionPricing==='#fafafa'?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.07)'}`, borderRadius:10, padding:24, opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:`all 0.8s cubic-bezier(.22,1,.36,1) ${i*0.1}s` }}>
              <h3 style={{ ...FF.data, fontSize:32, color:p.color, letterSpacing:'2px', margin:'0 0 4px' }}>{p.type}</h3>
              <p style={{ ...FF.body, fontSize:12, color:lp.pricingDesc, lineHeight:1.5, margin:'0 0 8px' }}>{p.desc}</p>
              <span style={{ ...FF.label, fontSize:9, fontWeight:700, letterSpacing:'1.5px', background:`${p.color}20`, color:p.color, borderRadius:3, padding:'3px 8px', textTransform:'uppercase' }}>{p.badge}</span>
              <div style={{ marginTop:16 }}>
                {p.prices.map(pr => (
                  <div key={pr.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderTop:`1px solid ${lp.pricingRowBorder}` }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ ...FF.label, fontSize:10, fontWeight:700, background:`${p.color}25`, color:p.color, borderRadius:3, padding:'2px 7px' }}>{pr.l}</span>
                      <span style={{ ...FF.label, fontSize:10, color:lp.pricingSize, fontWeight:600 }}>{pr.s}</span>
                    </div>
                    <span style={{ ...FF.data, fontSize:28, color:lp.mapStatText, letterSpacing:'1px' }}>{pr.p}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding:'36px 40px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
          <div style={{ width:36, height:2, background:TD.lime }} />
          <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:lp.subTierLabel, textTransform:'uppercase' }}>Monthly Subscription — Save up to 15%</span>
        </div>
        <div className="td-pricing-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {SUBS.map(s => (
            <div key={s.tier} style={{ position:'relative', background:lp.subBg, border:`1px solid ${s.popular?`${TD.lime}35`:lp.pricingRowBorder}`, borderRadius:10, padding:24 }}>
              {s.popular && <span style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:TD.lime, color:TD.ink, ...FF.label, fontSize:9, fontWeight:700, letterSpacing:'2px', padding:'4px 12px', borderRadius:3, whiteSpace:'nowrap', textTransform:'uppercase' }}>Most Popular</span>}
              <div style={{ ...FF.data, fontSize:52, color:TD.lime, lineHeight:1, marginBottom:4, letterSpacing:'2px' }}>{s.pct}</div>
              <div style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'3px', color:lp.subTierLabel, textTransform:'uppercase', marginBottom:16 }}>{s.tier}</div>
              <div style={{ marginBottom:16 }}>
                {s.items.map(it => <p key={it} style={{ ...FF.body, fontSize:13, color:lp.subText, margin:'4px 0', lineHeight:1.5 }}>· {it}</p>)}
              </div>
              <p style={{ ...FF.body, fontSize:12, color:lp.subSmall, borderTop:`1px solid ${lp.sectionPricing==='#fafafa'?'rgba(0,0,0,0.08)':'rgba(255,255,255,0.07)'}`, paddingTop:12, margin:0 }}>{s.ex}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */
const HomePageNew = () => {
  const { isAuthenticated, authInitialized } = useAuth();
  const auth = authInitialized ? isAuthenticated : false;
  return (
    <LpThemeProvider>
      <LpPageInner auth={auth} />
    </LpThemeProvider>
  );
};

export const HOME_SEO = {
  title: 'Waste Collection & Trash Pickup in Ghana | TrashDrop',
  description: 'Book waste collection and trash pickup in Accra, Kumasi, Takoradi & Tamale. Free pickup with QR Bags, on-demand bins, live tracking. Pay MoMo or cash.',
  path: '/',
};

const LpPageInner = ({ auth }) => {
  const { lp } = useLpTheme();
  useSeo({ ...HOME_SEO, jsonLd: [organizationJsonLd(), localBusinessJsonLd()] });
  // One load for the map, its stats and the impact numbers, so they always agree
  const dumpingData = usePublicDumpingReports();
  return (
    <div className="td-page" style={{ minHeight:'100vh', background:lp.pageBg, overflowX:'hidden', ...FF.body, transition:'background 0.3s ease' }}>
      <GlobalStyles />
      <HomeNavbar         isAuthenticated={auth} />
      <HeroSection        isAuthenticated={auth} />
      <TrustRow />
      <MarqueeStrip />
      <HowItWorksSection />
      <ServicesSection />
      <MapPreviewSection  isAuthenticated={auth} dumpingData={dumpingData} />
      <ImpactSection      dumpingData={dumpingData} />
      <PricingGuideSection />
      <ServiceAreasSection />
      <FAQSection />
      <CollectorsLine />
      <AppDownloadBanner />
      <HomeFooter />
      <StickyBookButton />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   /partners — assemblies, operators, businesses and community groups
   ═══════════════════════════════════════════════════════════════════════════════ */
export const PARTNERS_SEO = {
  title: 'Partner with TrashDrop | Assemblies, Operators & Businesses in Ghana',
  description: 'For MMDAs, waste operators and businesses in Ghana: live illegal dumping map, hotspot and risk data, cleanup dispatch and municipal dashboards.',
  path: '/partners/',
};

const PartnersPageInner = ({ auth }) => {
  const { lp } = useLpTheme();
  useSeo({ ...PARTNERS_SEO, jsonLd: [organizationJsonLd()] });
  // One load for the map, its stats and the impact numbers, so they always agree
  const dumpingData = usePublicDumpingReports();
  return (
    <div className="td-page td-partners-page" style={{ minHeight:'100vh', background:lp.pageBg, overflowX:'hidden', ...FF.body }}>
      <GlobalStyles />
      <HomeNavbar isAuthenticated={auth} />
      <header style={{ background:TD.ink, padding:'136px 24px 64px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Partners</span>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,4.6vw,58px)', lineHeight:1.05, letterSpacing:'-1.5px', color:'#f0f5f0', margin:'12px 0 14px' }}>
            TrashDrop for assemblies, operators and businesses
          </h1>
          <p style={{ ...FF.body, fontSize:18, lineHeight:1.6, color:'rgba(255,255,255,0.75)', maxWidth:640, margin:0 }}>
            Live illegal dumping reports, hotspot and risk data, and cleanup crews you can dispatch, across Ghana.
          </p>
        </div>
      </header>
      <PathwaysSection />
      <MapPreviewSection  isAuthenticated={auth} dumpingData={dumpingData} />
      <ImpactSection      dumpingData={dumpingData} />
      <PartnershipsSection />
      <HomeFooter />
    </div>
  );
};

export const PartnersPage = () => {
  const { isAuthenticated, authInitialized } = useAuth();
  return (
    <LpThemeProvider>
      <PartnersPageInner auth={authInitialized ? isAuthenticated : false} />
    </LpThemeProvider>
  );
};

export default HomePageNew;
