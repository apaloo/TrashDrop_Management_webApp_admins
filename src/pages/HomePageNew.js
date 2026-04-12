import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../context/AuthContext';

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
    mapTileUrl:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
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
    mapTileUrl:    'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
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
    const step = (ts) => {
      if (!t) t = ts;
      const p = Math.min((ts - t) / duration, 1);
      setCount(Math.floor(p * end));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, shouldStart]);
  return count;
};

const TW_PHRASES = ['Illegal Dumping.', 'Waste Overflow.', 'Uncollected Trash.', 'Dirty Communities.'];
const useTypewriter = () => {
  const [text, setText] = useState('');
  const st = useRef({ pi: 0, ci: 0, typing: true, locked: false });
  useEffect(() => {
    const s = st.current;
    if (s.locked) return;
    const phrase = TW_PHRASES[s.pi];
    const timer = setTimeout(() => {
      if (s.typing) {
        if (s.ci < phrase.length) { s.ci++; setText(phrase.slice(0, s.ci)); }
        else { s.locked = true; setTimeout(() => { s.locked = false; s.typing = false; setText(t => t); }, 1800); }
      } else {
        if (s.ci > 0) { s.ci--; setText(phrase.slice(0, s.ci)); }
        else { s.pi = (s.pi + 1) % TW_PHRASES.length; s.typing = true; }
      }
    }, s.typing ? 72 : 36);
    return () => clearTimeout(timer);
  });
  return text;
};

/* ─── Map data ──────────────────────────────────────────────────────────────── */
const DUMP_CLUSTERS = [
  { id:1,  lat:5.6037, lng:-0.1870, reports:47, waste:'Mixed Waste',  risk:'High',     lastReport:'2 hours ago'  },
  { id:2,  lat:5.6350, lng:-0.1650, reports:23, waste:'Plastic',      risk:'Medium',   lastReport:'5 hours ago'  },
  { id:3,  lat:5.5700, lng:-0.2100, reports:61, waste:'Hazardous',    risk:'Critical', lastReport:'30 min ago'   },
  { id:4,  lat:5.5950, lng:-0.2300, reports:15, waste:'Organic',      risk:'Low',      lastReport:'1 day ago'    },
  { id:5,  lat:5.6500, lng:-0.1300, reports:34, waste:'E-Waste',      risk:'High',     lastReport:'3 hours ago'  },
  { id:6,  lat:5.5500, lng:-0.1900, reports:28, waste:'Construction', risk:'Medium',   lastReport:'8 hours ago'  },
  { id:7,  lat:5.6200, lng:-0.2500, reports:52, waste:'Mixed Waste',  risk:'High',     lastReport:'1 hour ago'   },
  { id:8,  lat:5.5800, lng:-0.1400, reports:9,  waste:'Plastic',      risk:'Low',      lastReport:'2 days ago'   },
  { id:9,  lat:5.6100, lng:-0.2000, reports:38, waste:'Organic',      risk:'Medium',   lastReport:'4 hours ago'  },
  { id:10, lat:5.6400, lng:-0.2200, reports:19, waste:'Hazardous',    risk:'High',     lastReport:'6 hours ago'  },
];
const RISK_COLORS = { Critical:'#dc2626', High:'#ea580c', Medium:'#eab308', Low:'#22c55e' };

const MapAutoFit = ({ clusters }) => {
  const map = useMap();
  useEffect(() => {
    if (!clusters.length) return;
    map.fitBounds(L.latLngBounds(clusters.map(c => [c.lat, c.lng])), { padding:[40,40], maxZoom:13 });
  }, [map, clusters]);
  return null;
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
    .td-step-card:hover { transform:translateY(-6px) !important; box-shadow:0 20px 48px rgba(0,0,0,0.14) !important; }
    .td-pathway-card:hover { transform:translateY(-8px) !important; }
    .td-partner-tile:hover { background:rgba(168,230,61,0.06) !important; border-color:rgba(168,230,61,0.2) !important; }
    .td-social-btn:hover { background:rgba(168,230,61,0.15) !important; border-color:rgba(168,230,61,0.4) !important; color:#a8e63d !important; }
    .td-footer-link:hover { color:#a8e63d !important; }
    @media(max-width:768px) { .td-nav-links{display:none!important} }
    @media(min-width:769px) { .td-mobile-btn{display:none!important} }
    @media(max-width:900px) { .td-hero-grid{grid-template-columns:1fr!important} .td-hero-cards{display:none!important} }
    @media(max-width:1024px){ .td-steps-grid{grid-template-columns:repeat(2,1fr)!important} .td-connector{display:none!important} }
    @media(max-width:640px) { .td-steps-grid{grid-template-columns:1fr!important} }
    @media(max-width:768px) { .td-services-grid{grid-template-columns:1fr!important} .td-map-stats{grid-template-columns:repeat(2,1fr)!important} .td-impact-grid{grid-template-columns:repeat(2,1fr)!important} }
    @media(max-width:480px) { .td-map-stats{grid-template-columns:1fr!important} .td-impact-grid{grid-template-columns:1fr!important} }
    @media(max-width:900px) { .td-pathways-grid{grid-template-columns:1fr!important} .td-partners-grid{grid-template-columns:1fr!important} }
    @media(max-width:900px) { .td-pricing-grid{grid-template-columns:1fr!important} }
    @media(max-width:900px) { .td-footer-grid{grid-template-columns:1fr 1fr!important} }
    @media(max-width:480px) { .td-footer-grid{grid-template-columns:1fr!important} }
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
    { href:'#how',      label:'How It Works' },
    { href:'#map',      label:'Live Map'      },
    { href:'#pricing',  label:'Pricing'       },
    { href:'#impact',   label:'Impact'        },
    { href:'#partners', label:'Partners'      },
  ];
  const navScrollBg     = isDark ? 'rgba(10,15,10,0.96)'        : 'rgba(255,255,255,0.97)';
  const navScrollBorder = isDark ? 'rgba(168,230,61,0.12)'      : 'rgba(22,101,52,0.15)';
  const navLinkColor    = isDark ? 'rgba(255,255,255,0.75)'     : 'rgba(27,62,40,0.8)';
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
        <button className="td-mobile-btn" onClick={() => setMobileOpen(o=>!o)} style={{ background:'none', border:'none', cursor:'pointer', padding:8, color:isDark?'#fff':TD.forest }}>
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
   HERO
   ═══════════════════════════════════════════════════════════════════════════════ */
const HeroSection = ({ isAuthenticated }) => {
  const navigate  = useNavigate();
  const headline  = useTypewriter();
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
        backgroundImage:'url(/images/auth-bg.jpg)', 
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

      <div style={{ position:'relative', zIndex:3, maxWidth:1280, margin:'0 auto', padding:'110px 24px 80px', width:'100%' }}>
        <div className="td-hero-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:64, alignItems:'center' }}>

          {/* Left */}
          <div style={{ position:'relative', zIndex:3 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 16px', marginBottom:28 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:TD.lime, display:'inline-block', animation:'td-pulse-dot 2s infinite' }} />
              <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Real-Time Environmental Intelligence</span>
            </div>
            <h1 style={{ ...FF.display, fontSize:'clamp(44px,5.5vw,72px)', lineHeight:1.0, letterSpacing:'-1.5px', color:'#f0f5f0', margin:'0 0 8px' }}>Track. Report.</h1>
            <h1 style={{ ...FF.display, fontSize:'clamp(44px,5.5vw,72px)', lineHeight:1.0, letterSpacing:'-1.5px', fontStyle:'italic', color:'transparent', WebkitTextStroke:`1.5px ${TD.lime}`, margin:'0 0 12px' }}>Eliminate</h1>
            <div style={{ display:'flex', alignItems:'center', gap:4, minHeight:52, marginBottom:28 }}>
              <span style={{ ...FF.data, fontSize:'clamp(28px,3.5vw,44px)', color:TD.gold, letterSpacing:'1px' }}>{headline}</span>
              <span style={{ display:'inline-block', width:3, height:38, background:TD.lime, borderRadius:2, animation:'td-blink 1s step-end infinite' }} />
            </div>
            <p style={{ ...FF.body, fontSize:17, lineHeight:1.75, fontWeight:300, color:'rgba(255,255,255,0.55)', maxWidth:520, marginBottom:40 }}>
              TrashDrop empowers communities, cities, and environmental agencies across
              <strong style={{ color:'rgba(255,255,255,0.82)', fontWeight:500 }}> Ghana</strong> to detect, report, and eliminate
              illegal waste dumping using real-time mapping and data intelligence.
            </p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:40 }}>
              <a href="#map"
                style={{ display:'inline-flex', alignItems:'center', gap:10, background:TD.lime, color:TD.ink, ...FF.label, fontSize:14, fontWeight:700, padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45`, transition:'all 0.25s cubic-bezier(.34,1.56,.64,1)' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px) scale(1.03)';e.currentTarget.style.boxShadow=`0 16px 40px ${TD.lime}55`;}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=`0 8px 32px ${TD.lime}45`;}}>
                <i className="fas fa-map-marked-alt"></i> View Dump Map
              </a>
              <button
                onClick={() => isAuthenticated ? navigate('/illegal-dumping/reports') : navigate('/signup')}
                style={{ display:'inline-flex', alignItems:'center', gap:10, background:'transparent', color:'#fff', ...FF.label, fontSize:14, fontWeight:700, padding:'14px 28px', borderRadius:10, cursor:'pointer', border:`1.5px solid rgba(255,255,255,0.18)`, transition:'all 0.25s ease' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}55`;e.currentTarget.style.background=`${TD.lime}0D`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.18)';e.currentTarget.style.background='transparent';}}>
                <i className="fas fa-exclamation-triangle" style={{ color:TD.gold }}></i> Report Illegal Dump
              </button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
              {[{v:'12,470+',l:'Dumps Reported'},{v:'3,850+',l:'Tonnes Removed'},{v:'156',l:'Communities'}].map(s => (
                <div key={s.l}>
                  <div style={{ ...FF.data, fontSize:22, color:TD.lime, letterSpacing:'1px' }}>{s.v}</div>
                  <div style={{ ...FF.label, fontSize:10, color:TD.sage, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase' }}>{s.l}</div>
                </div>
              ))}
              <div style={{ width:1, height:36, background:'rgba(255,255,255,0.08)' }} />
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'td-pulse-dot 2s infinite' }} />
                <span style={{ ...FF.label, fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>Live · Accra, Ghana</span>
              </div>
            </div>
          </div>

          {/* Right — floating cards */}
          <div className="td-hero-cards" style={{ position:'relative', height:480, zIndex:3 }}>
            <div style={{ position:'absolute', top:20, right:0, width:258, background:`rgba(27,110,53,0.18)`, border:`1px solid rgba(168,230,61,0.2)`, backdropFilter:'blur(20px)', borderRadius:20, padding:'20px 22px', animation:'td-float 6s ease-in-out infinite', boxShadow:`0 24px 60px rgba(0,0,0,0.5)` }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'td-pulse-dot 2s infinite' }} />
                <span style={{ ...FF.label, fontSize:10, color:TD.lime, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase' }}>Active Hotspots</span>
              </div>
              <div style={{ ...FF.data, fontSize:52, color:'#fff', lineHeight:1 }}>1,247</div>
              <div style={{ ...FF.body, fontSize:12, color:TD.sage, marginTop:4 }}>+12% this month</div>
              <div style={{ display:'flex', gap:3, marginTop:14, alignItems:'flex-end', height:32 }}>
                {[40,65,50,80,70,90,75].map((h,i) => <div key={i} style={{ flex:1, height:`${h}%`, background:`${TD.lime}70`, borderRadius:2 }} />)}
              </div>
            </div>
            <div style={{ position:'absolute', top:185, left:0, width:218, background:'rgba(10,15,10,0.82)', border:'1px solid rgba(255,255,255,0.08)', backdropFilter:'blur(20px)', borderRadius:18, padding:'18px 20px', animation:'td-float 8s ease-in-out 1.5s infinite', boxShadow:'0 20px 50px rgba(0,0,0,0.5)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:`${TD.lime}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className="fas fa-check-circle" style={{ color:TD.lime, fontSize:14 }}></i>
                </div>
                <span style={{ ...FF.label, fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>Cleanups Done</span>
              </div>
              <div style={{ ...FF.data, fontSize:40, color:'#fff' }}>892</div>
              <div style={{ ...FF.body, fontSize:12, color:TD.lime, marginTop:2 }}>↑ +8% this month</div>
              <div style={{ marginTop:10, background:'rgba(255,255,255,0.06)', borderRadius:99, height:4, overflow:'hidden' }}>
                <div style={{ width:'71%', height:'100%', background:`linear-gradient(90deg,${TD.forest},${TD.lime})`, borderRadius:99 }} />
              </div>
              <div style={{ ...FF.label, fontSize:10, color:TD.sage, marginTop:4, fontWeight:600 }}>71% cleanup rate</div>
            </div>
            <div style={{ position:'absolute', bottom:40, right:16, width:196, background:`linear-gradient(135deg,${TD.gold}18,${TD.gold}08)`, border:`1px solid ${TD.gold}28`, backdropFilter:'blur(20px)', borderRadius:16, padding:'16px 18px', animation:'td-float 7s ease-in-out 3s infinite', boxShadow:`0 16px 40px rgba(0,0,0,0.4)` }}>
              <div style={{ ...FF.label, fontSize:10, color:TD.gold, fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', marginBottom:6 }}>Avg Response</div>
              <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                <span style={{ ...FF.data, fontSize:44, color:'#fff' }}>4.2</span>
                <span style={{ ...FF.label, fontSize:14, color:TD.gold, fontWeight:700 }}>hrs</span>
              </div>
              <div style={{ ...FF.body, fontSize:11, color:'rgba(255,255,255,0.38)', marginTop:2 }}>Community to cleanup</div>
            </div>
            <div style={{ position:'absolute', top:12, left:'36%', width:92, height:92, borderRadius:'50%', border:`1.5px solid ${TD.lime}28`, display:'flex', alignItems:'center', justifyContent:'center', animation:'td-spin-slow 18s linear infinite' }}>
              <svg viewBox="0 0 100 100" style={{ position:'absolute', width:'100%', height:'100%' }}>
                <path id="tc" d="M 50,50 m -37,0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
                <text style={{ fontSize:8.5, fill:`${TD.lime}60`, fontFamily:'Syne,sans-serif', fontWeight:700, letterSpacing:'3px' }}>
                  <textPath href="#tc">Ghana's #1 Waste Platform · </textPath>
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
   MARQUEE STRIP
   ═══════════════════════════════════════════════════════════════════════════════ */
const MarqueeStrip = () => {
  const items = ['QR-Tagged Bags','·','Free Collection','·','Real-Time Tracking','·','Illegal Dump Reporting','·','Live Map Analytics','·','Municipal Dashboard','·','Accra · Kumasi · Takoradi · Tamale','·',"Ghana's #1 Waste Platform",'·','QR-Tagged Bags','·','Free Collection','·','Real-Time Tracking','·','Illegal Dump Reporting','·','Live Map Analytics','·','Municipal Dashboard','·'];
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
const HowItWorksSection = () => {
  const { ref, visible } = useReveal(0.1);
  const { lp } = useLpTheme();
  const STEPS = [
    { num:'01', icon:'fa-shopping-bag', title:'Buy Official Bags',    color:TD.lime,   bg:`${TD.lime}16`,              body:'Purchase TrashDrop QR-coded bags from any authorised vendor near you — available in 3 sizes and 3 waste types.' },
    { num:'02', icon:'fa-qrcode',       title:'Scan to Activate',     color:TD.gold,   bg:`${TD.gold}16`,              body:'Each batch has a unique QR code. Scan with the TrashDrop app to activate and link the bags to your account.' },
    { num:'03', icon:'fa-truck',        title:'Request Free Pickup',   color:'#4d9de0', bg:'rgba(77,157,224,0.15)',    body:'When your bag is full, tap one button to request free collection. A verified collector comes to your door.' },
    { num:'04', icon:'fa-map-marked-alt',title:'Verified Disposal',   color:TD.lime,   bg:`${TD.lime}16`,              body:'Waste only reaches legally mapped landfills. You get confirmation your waste was properly handled, end to end.' },
  ];
  return (
    <section id="how" style={{ background:lp.sectionAlt, position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, opacity:0.04, pointerEvents:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='t'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23t)' opacity='0.035'/%3E%3C/svg%3E")` }} />
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'100px 24px' }}>
        <div style={{ marginBottom:72 }}>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
            <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'4px', color:lp.howItWorksLabel, textTransform:'uppercase' }}>How It Works</span>
          </div>
          <h2 style={{ ...FF.display, fontSize:'clamp(40px,5vw,62px)', lineHeight:0.95, letterSpacing:'-2px', color:lp.ink2Heading, margin:0, opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1)' }}>
            What happens to your waste<br />after it <em style={{ color:TD.forest }}>leaves</em> your door?
          </h2>
          <div style={{ marginTop:20, display:'inline-block' }}>
            <div style={{ background:TD.forest, color:'#fff', ...FF.label, fontSize:14, fontWeight:700, padding:'10px 24px', borderRadius:99, boxShadow:`0 8px 24px ${TD.forest}40` }}>
              With TrashDrop, you don't have to guess.
            </div>
          </div>
        </div>

        <div className="td-steps-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:20 }}>
          {STEPS.map((s,i) => (
            <div key={s.num} className="td-step-card" style={{ background:lp.cardBg, borderRadius:20, padding:28, border:`1px solid ${lp.cardBorder}`, boxShadow:'0 4px 24px rgba(0,0,0,0.05)', position:'relative', overflow:'hidden', transition:'all 0.3s ease', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(40px)', transitionDelay:`${0.1+i*0.12}s` }}>
              <span style={{ position:'absolute', top:-8, right:12, ...FF.data, fontSize:100, color:lp.stepNum, lineHeight:1, userSelect:'none' }}>{s.num}</span>
              <div style={{ width:52, height:52, borderRadius:14, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                <i className={`fas ${s.icon}`} style={{ fontSize:22, color:s.color }}></i>
              </div>
              <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:s.color, textTransform:'uppercase', display:'block', marginBottom:8 }}>Step {s.num}</span>
              <h3 style={{ ...FF.display, fontSize:22, color:lp.ink2Heading, margin:'0 0 10px', letterSpacing:'-0.5px' }}>{s.title}</h3>
              <p style={{ ...FF.body, fontSize:14, fontWeight:300, color:lp.sageText, lineHeight:1.7, margin:0 }}>{s.body}</p>
              {i < STEPS.length-1 && <div className="td-connector" style={{ position:'absolute', top:'50%', right:-12, width:24, height:24, borderRadius:'50%', background:s.color, border:`3px solid ${lp.connectorBorder}`, zIndex:2, transform:'translateY(-50%)', boxShadow:`0 0 0 4px ${s.color}30` }} />}
            </div>
          ))}
        </div>

        <div style={{ marginTop:56, background:lp.darkBoxBg, borderRadius:20, padding:'36px 40px' }}>
          {[
            { b:'Every bag is tagged with a QR code', r:', tracked from your doorstep to verified disposal sites.' },
            { b:'Our collectors are verified',         r:', and waste can only be disposed at legally mapped landfills.' },
            { b:'No shortcuts. No dumping. No guesswork.', r:'' },
          ].map((p,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:14, marginBottom:i<2?12:0 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:`${TD.lime}20`, border:`1px solid ${TD.lime}40`, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', marginTop:1 }}>
                <i className="fas fa-check" style={{ color:TD.lime, fontSize:10 }}></i>
              </div>
              <p style={{ ...FF.body, fontSize:15, color:lp.darkBoxText, lineHeight:1.7, margin:0 }}>
                <strong style={{ color:lp.darkBoxStrong, fontWeight:600 }}>{p.b}</strong>{p.r}
              </p>
            </div>
          ))}
          <div style={{ borderTop:'1px solid rgba(255,255,255,0.07)', marginTop:20, paddingTop:20, textAlign:'center' }}>
            <p style={{ ...FF.display, fontSize:24, color:lp.darkBoxFooter, margin:0, fontStyle:'italic' }}>TrashDrop — <span style={{ color:TD.lime }}>Waste you can track.</span></p>
            <p style={{ ...FF.body, fontSize:15, color:lp.darkBoxSub, fontWeight:300, margin:'4px 0 0' }}>From doorstep to landfill.</p>
          </div>
        </div>
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
          TrashDrop offers two flexible services built for how you actually live — whether you prefer a planned system or on-demand pickup.
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
                ['2','Scan the QR Code','Each bundle of bags has a unique batch QR code. Scan it to activate all bags in the bundle and link them to your account.'],
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
                ['2','Instant GPS Price Quote','Receive a transparent, GPS-based price quote instantly — no surprises.'],
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
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginTop:28, background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'10px 20px', borderRadius:8, ...FF.label, fontSize:12, fontWeight:700, letterSpacing:'1px' }}>📍 Live GPS Tracking</div>
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

/* ═══════════════════════════════════════════════════════════════════════════════
   LIVE MAP
   ═══════════════════════════════════════════════════════════════════════════════ */
const MapPreviewSection = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const [showPrompt, setShowPrompt] = useState(false);
  const { ref, visible } = useReveal(0.05);
  const { lp } = useLpTheme();
  const handleRestricted = () => {
    if (!isAuthenticated) { setShowPrompt(true); setTimeout(() => setShowPrompt(false), 4000); }
    else navigate('/illegal-dumping/map');
  };
  return (
    <section id="map" style={{ background:lp.mapSectionBg, padding:'96px 0' }}>
      <div ref={ref} style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>
        <div style={{ textAlign:'center', marginBottom:52 }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.lime, textTransform:'uppercase', display:'block', marginBottom:14, opacity:visible?1:0, transition:'opacity 0.6s ease' }}>Public Preview</span>
          <h2 style={{ ...FF.display, fontSize:'clamp(34px,4.5vw,54px)', lineHeight:1.05, letterSpacing:'-1.5px', color:lp.sectionHeading, margin:'0 0 14px', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(28px)', transition:'all 0.9s cubic-bezier(.22,1,.36,1) 0.1s' }}>
            Illegal Dumping <em style={{ color:TD.lime }}>Live Map</em>
          </h2>
          <p style={{ ...FF.body, fontSize:16, fontWeight:300, color:lp.bodyText, maxWidth:520, margin:'0 auto', lineHeight:1.75 }}>Explore reported illegal dumping hotspots across Greater Accra in real time.</p>
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

          {/* Right: Map */}
          <div style={{ flex:2, minWidth:400 }}>
            <div style={{ position:'relative', borderRadius:24, overflow:'hidden', border:`1px solid rgba(168,230,61,0.14)`, boxShadow:`0 32px 80px rgba(0,0,0,0.7)`, height:'100%', minHeight:500 }}>
              <div style={{ height:'100%', minHeight:500 }}>
                <MapContainer center={[5.6037,-0.1870]} zoom={12} style={{ height:'100%', width:'100%', minHeight:500 }} scrollWheelZoom={true}>
                  <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url={lp.mapTileUrl} />
                  <MapAutoFit clusters={DUMP_CLUSTERS} />
                  {DUMP_CLUSTERS.map(c => (
                    <CircleMarker key={c.id} center={[c.lat,c.lng]} radius={Math.max(10,Math.sqrt(c.reports)*4)} pathOptions={{ fillColor:RISK_COLORS[c.risk], color:RISK_COLORS[c.risk], weight:2, opacity:0.9, fillOpacity:0.35 }}>
                      <Popup>
                        <div style={{ minWidth:180, fontFamily:'DM Sans,sans-serif' }}>
                          <p style={{ fontWeight:700, margin:'0 0 4px', color:'#111' }}>{c.reports} Reports</p>
                          <p style={{ margin:'2px 0', fontSize:13, color:'#555' }}><strong>Waste:</strong> {c.waste}</p>
                          <p style={{ margin:'2px 0', fontSize:13, color:'#555' }}><strong>Risk:</strong> <span style={{ color:RISK_COLORS[c.risk] }}>{c.risk}</span></p>
                          <p style={{ margin:'6px 0 8px', fontSize:11, color:'#888' }}>Last: {c.lastReport}</p>
                          <button onClick={handleRestricted} style={{ width:'100%', padding:6, background:TD.forest, color:'#fff', border:'none', borderRadius:6, cursor:'pointer', fontSize:12, fontWeight:600 }}>{isAuthenticated?'View Full Details':'Login for Details'}</button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
              <div style={{ position:'absolute', bottom:16, left:16, background:lp.mapLegendBg, backdropFilter:'blur(14px)', border:`1px solid ${lp.mapLegendBorder}`, borderRadius:12, padding:'12px 16px', zIndex:1100 }}>
                <p style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'2px', color:lp.mapLegendLabel, textTransform:'uppercase', margin:'0 0 8px' }}>Risk Level</p>
                {Object.entries(RISK_COLORS).map(([label,color]) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:color, display:'inline-block' }} />
                    <span style={{ ...FF.body, fontSize:12, color:lp.mapLegendText }}>{label}</span>
                  </div>
                ))}
              </div>
              <div style={{ position:'absolute', top:14, right:14, zIndex:1100 }}>
                <button onClick={handleRestricted} style={{ display:'flex', alignItems:'center', gap:8, background:TD.forest, color:'#fff', border:'none', cursor:'pointer', ...FF.label, fontSize:12, fontWeight:700, padding:'10px 18px', borderRadius:10, boxShadow:`0 4px 20px ${TD.forest}60` }}>
                  <i className="fas fa-expand-arrows-alt"></i> Full Analytics Map
                </button>
              </div>
              {showPrompt && (
                <div style={{ position:'absolute', top:58, right:14, zIndex:1200, maxWidth:280, background:'#fff', borderRadius:14, padding:16, boxShadow:'0 20px 60px rgba(0,0,0,0.3)', border:'1px solid rgba(0,0,0,0.08)' }}>
                  <div style={{ display:'flex', gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:'50%', background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className="fas fa-lock" style={{ color:TD.forest, fontSize:14 }}></i>
                    </div>
                    <div>
                      <p style={{ ...FF.label, fontSize:13, fontWeight:700, color:'#111', margin:'0 0 4px' }}>Login Required</p>
                      <p style={{ ...FF.body, fontSize:12, color:'#666', margin:'0 0 10px', lineHeight:1.5 }}>Sign in to access full analytics.</p>
                      <div style={{ display:'flex', gap:8 }}>
                        <Link to="/login"  style={{ padding:'6px 14px', background:TD.forest, color:'#fff', borderRadius:6, ...FF.label, fontSize:11, fontWeight:700, textDecoration:'none' }}>Sign In</Link>
                        <Link to="/signup" style={{ padding:'6px 14px', border:`1px solid ${TD.forest}`, color:TD.forest, borderRadius:6, ...FF.label, fontSize:11, fontWeight:700, textDecoration:'none' }}>Sign Up</Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="td-map-stats" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginTop:24 }}>
          {[{label:'Total Reports',value:'326',icon:'fa-file-alt',color:'#4d9de0',bg:'rgba(77,157,224,0.12)'},
            {label:'Hotspot Zones',value:'10',icon:'fa-map-pin',color:'#dc2626',bg:'rgba(220,38,38,0.12)'},
            {label:'Cleanup Rate',value:'71%',icon:'fa-broom',color:TD.lime,bg:`${TD.lime}14`},
            {label:'Avg Response',value:'4.2h',icon:'fa-clock',color:TD.gold,bg:`${TD.gold}14`}].map(s => (
            <div key={s.label} style={{ background:lp.mapStatBg, border:`1px solid ${lp.mapStatBorder}`, borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={`fas ${s.icon}`} style={{ color:s.color, fontSize:16 }}></i>
              </div>
              <div>
                <p style={{ ...FF.data, fontSize:28, color:lp.mapStatText, margin:0, lineHeight:1 }}>{s.value}</p>
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
const ImpactStatCard = ({ label, value, suffix, icon, color, accent }) => {
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
        <span style={{ ...FF.data, fontSize:'clamp(44px,5vw,64px)', color:lp.impactCount, letterSpacing:'1px' }}>{count.toLocaleString()}</span>
        {suffix && <span style={{ ...FF.data, fontSize:22, color:TD.lime }}>{suffix}</span>}
      </div>
      <p style={{ ...FF.body, fontSize:13, color:lp.impactSub, fontWeight:400, margin:'6px 0 0' }}>{label}</p>
    </div>
  );
};

const ImpactSection = () => {
  const { ref, visible } = useReveal(0.08);
  const { lp } = useLpTheme();
  const STATS = [
    { label:'Illegal Dumps Reported', value:12470, suffix:'+', icon:'fa-flag',         color:'#f87171', accent:'rgba(248,113,113,0.15)' },
    { label:'Tonnes Waste Removed',   value:3850,  suffix:'+', icon:'fa-dumpster',     color:TD.lime,   accent:`${TD.lime}18`            },
    { label:'CO₂ Prevented (tonnes)', value:940,   suffix:'t', icon:'fa-leaf',         color:'#34d399', accent:'rgba(52,211,153,0.15)'   },
    { label:'Active Communities',     value:156,   suffix:'',  icon:'fa-users',        color:'#60a5fa', accent:'rgba(96,165,250,0.15)'   },
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
        <div className="td-impact-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderTop:'1px solid rgba(168,230,61,0.1)', borderLeft:'1px solid rgba(168,230,61,0.1)' }}>
          {STATS.map((s,i) => (
            <div key={s.label} style={{ borderRight:'1px solid rgba(168,230,61,0.1)', borderBottom:'1px solid rgba(168,230,61,0.1)', opacity:visible?1:0, transform:visible?'translateY(0)':'translateY(32px)', transition:`all 0.8s cubic-bezier(.22,1,.36,1) ${i*0.1}s` }}>
              <ImpactStatCard {...s} />
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
            Empowering communities to fight illegal dumping with real-time data intelligence and collective action across Ghana.
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
          { title:'Platform', links:[['Live Map','#map'],['How It Works','#how'],['Pricing','#pricing'],['Report Dumping','/login'],['Join Community','/signup']] },
          { title:'Resources', links:[['Documentation','#'],['API Reference','#'],['Case Studies','#'],['Blog','#'],['Privacy Policy','#']] },
          { title:'Company',  links:[['About Us','#'],['Partnerships','#partners'],['Terms of Service','#'],['Contact Us','mailto:hello@trashdrops.com'],['Careers','#']] },
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
          <h2 style={{ ...FF.display, fontSize:'clamp(32px,4vw,52px)', color:TD.ink, lineHeight:1.0, letterSpacing:'-1px', margin:'0 0 28px' }}>
            Download the app.<br />Book your first pickup.
          </h2>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:10, background:TD.ink, color:'#fff', ...FF.label, fontSize:13, fontWeight:700, padding:'12px 22px', borderRadius:10, textDecoration:'none', boxShadow:`0 6px 24px rgba(0,0,0,0.25)`, transition:'transform 0.2s ease' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <i className="fab fa-google-play" style={{ fontSize:16 }}></i> Google Play
            </a>
            <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:10, background:TD.ink, color:'#fff', ...FF.label, fontSize:13, fontWeight:700, padding:'12px 22px', borderRadius:10, textDecoration:'none', boxShadow:`0 6px 24px rgba(0,0,0,0.25)`, transition:'transform 0.2s ease' }}
              onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
              onMouseLeave={e=>e.currentTarget.style.transform=''}>
              <i className="fab fa-apple" style={{ fontSize:17 }}></i> App Store
            </a>
          </div>
        </div>

        {/* Right: QR code */}
        <div style={{ position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:12, flexShrink:0 }}>
          <div style={{ background:'#fff', borderRadius:16, padding:12, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
            <img
              src="/images/app-download-qr.jpeg"
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
const FloatingActions = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const fn = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', fn, { passive:true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  if (!show) return null;
  return (
    <div style={{ position:'fixed', bottom:28, right:28, zIndex:2000, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:10 }}>
      {open && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[{label:'Report Dump', icon:'fa-exclamation-triangle', color:'#ef4444', action:() => isAuthenticated?navigate('/illegal-dumping/reports'):navigate('/signup')},
            {label:'View Map',   icon:'fa-map',                   color:'#4d9de0', href:'#map'},
            {label:'Join Now',   icon:'fa-user-plus',             color:TD.lime,   to:'/signup'}].map(a => (
            <div key={a.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ ...FF.label, fontSize:12, fontWeight:700, background:TD.ink, color:'#fff', padding:'6px 12px', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.3)', border:'1px solid rgba(255,255,255,0.08)', whiteSpace:'nowrap' }}>{a.label}</span>
              {a.action
                ? <button onClick={a.action} style={{ width:44, height:44, borderRadius:'50%', background:a.color, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 20px ${a.color}60`, color:'#fff', fontSize:16 }}><i className={`fas ${a.icon}`}></i></button>
                : a.href
                  ? <a href={a.href}  style={{ width:44, height:44, borderRadius:'50%', background:a.color, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 20px ${a.color}60`, color:'#fff', fontSize:16, textDecoration:'none' }}><i className={`fas ${a.icon}`}></i></a>
                  : <Link to={a.to}   style={{ width:44, height:44, borderRadius:'50%', background:a.color, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 20px ${a.color}60`, color:TD.ink, fontSize:16, textDecoration:'none' }}><i className={`fas ${a.icon}`}></i></Link>
              }
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o=>!o)} style={{ width:56, height:56, borderRadius:'50%', background:open?'rgba(255,255,255,0.1)':TD.lime, border:open?'1px solid rgba(255,255,255,0.2)':'none', boxShadow:open?'none':`0 8px 32px ${TD.lime}50`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.25s ease' }}>
        <i className={`fas ${open?'fa-times':'fa-plus'}`} style={{ fontSize:20, color:open?'#fff':TD.ink, transform:open?'rotate(45deg)':'rotate(0)', transition:'transform 0.25s ease' }}></i>
      </button>
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
          <img src="/images/QR_code_trashbag.png"   alt="TrashDrop bag stack"     style={{ height:'100%', width:'auto', display:'block', opacity:0.85 }} />
          <img src="/images/QR_code_trashbag_2.png" alt="TrashDrop bag label"     style={{ height:'100%', width:'auto', display:'block' }} />
        </div>
        {/* Dark gradient — solid left, barely touches the image area on the right */}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, #0a1a0a 0%, #0a1a0a 40%, rgba(10,26,10,0.7) 52%, rgba(10,26,10,0.08) 68%, transparent 100%)', zIndex:2 }} />
        {/* Subtle lime grid overlay */}
        <div style={{ position:'absolute', inset:0, zIndex:2, opacity:0.03, backgroundImage:`linear-gradient(rgba(168,230,61,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(168,230,61,0.6) 1px,transparent 1px)`, backgroundSize:'40px 40px' }} />
        {/* Lime left-edge accent line */}
        <div style={{ position:'absolute', top:0, left:0, width:3, height:'100%', background:`linear-gradient(to bottom,transparent,${TD.lime},transparent)`, zIndex:3 }} />
        <div style={{ position:'absolute', top:16, right:16, background:TD.lime, color:TD.ink, ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'2px', padding:'6px 14px', borderRadius:4, zIndex:4 }}>2025 PRICING GUIDE</div>
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

const LpPageInner = ({ auth }) => {
  const { lp } = useLpTheme();
  return (
    <div style={{ minHeight:'100vh', background:lp.pageBg, overflowX:'hidden', ...FF.body, transition:'background 0.3s ease' }}>
      <GlobalStyles />
      <HomeNavbar         isAuthenticated={auth} />
      <HeroSection        isAuthenticated={auth} />
      <MarqueeStrip />
      <HowItWorksSection />
      <ServicesSection />
      <MapPreviewSection  isAuthenticated={auth} />
      <ImpactSection />
      <PricingGuideSection />
      <PathwaysSection />
      <PartnershipsSection />
      <AppDownloadBanner />
      <HomeFooter />
      <FloatingActions    isAuthenticated={auth} />
    </div>
  );
};

export default HomePageNew;
