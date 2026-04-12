import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── Brand tokens ─────────────────────────────────────────────────────────── */
export const TD = {
  lime:     '#a8e63d',
  forest:   '#1b6e35',
  forestDk: '#0f4020',
  ink:      '#0a0f0a',
  ink2:     '#111a13',
  sage:     '#6b7565',
  cream:    '#f5f2eb',
  gold:     '#f5c842',
};
export const FF = {
  display: { fontFamily:"'DM Serif Display', Georgia, serif" },
  body:    { fontFamily:"'DM Sans', system-ui, sans-serif" },
  label:   { fontFamily:"'Syne', sans-serif" },
  data:    { fontFamily:"'Bebas Neue', sans-serif" },
};

/* ─── Navbar ────────────────────────────────────────────────────────────────── */
export const PublicNavbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const NAV = [
    { to: '/how-it-works',     label: 'How It Works' },
    { to: '/users',            label: 'For Households' },
    { to: '/collectors',       label: 'Earn as Carter' },
    { to: '/illegal-dumping',  label: 'Report Dumping' },
    { to: '/blog',             label: 'Blog' },
    { to: '/about',            label: 'About' },
  ];

  const navBg     = scrolled ? 'rgba(10,15,10,0.97)' : 'transparent';
  const navBorder = scrolled ? `1px solid rgba(168,230,61,0.12)` : '1px solid transparent';
  const linkColor = 'rgba(255,255,255,0.78)';
  const brandColor = '#fff';

  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:1500, transition:'all 0.35s ease', background:navBg, backdropFilter:scrolled?'blur(22px)':'none', borderBottom:navBorder }}>
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', height:68 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <img src="/logo.svg" alt="TrashDrop" style={{ height:36, width:36 }} onError={e=>{e.target.style.display='none'}} />
          <span style={{ ...FF.label, fontSize:18, fontWeight:800, color:brandColor, letterSpacing:'-0.3px' }}>Trash<span style={{ color:TD.lime }}>Drop</span></span>
        </Link>
        <div className="td-nav-links" style={{ display:'flex', alignItems:'center', gap:28 }}>
          {NAV.map(l => (
            <Link key={l.to} to={l.to} style={{ ...FF.label, fontSize:13, fontWeight:600, letterSpacing:'0.3px', color:linkColor, textDecoration:'none', transition:'color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
              onMouseLeave={e=>e.currentTarget.style.color=linkColor}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="td-nav-links" style={{ display:'flex', gap:10, alignItems:'center' }}>
          {isAuthenticated
            ? <Link to="/dashboard" style={{ ...FF.label, fontSize:13, fontWeight:700, background:TD.lime, color:TD.ink, padding:'9px 22px', borderRadius:8, textDecoration:'none' }}>Dashboard →</Link>
            : <>
                <Link to="/login"  style={{ ...FF.label, fontSize:13, fontWeight:600, color:linkColor, textDecoration:'none', padding:'9px 14px' }}>Sign In</Link>
                <Link to="/signup" style={{ ...FF.label, fontSize:13, fontWeight:700, background:TD.lime, color:TD.ink, padding:'9px 22px', borderRadius:8, textDecoration:'none', boxShadow:`0 4px 20px ${TD.lime}40` }}>Get Started</Link>
              </>}
        </div>
        <button className="td-mobile-btn" onClick={() => setMobileOpen(o=>!o)} style={{ background:'none', border:'none', cursor:'pointer', padding:8, color:'#fff' }}>
          <i className={`fas ${mobileOpen?'fa-times':'fa-bars'}`} style={{ fontSize:18 }}></i>
        </button>
      </div>
      {mobileOpen && (
        <div style={{ background:TD.ink, borderTop:`1px solid rgba(168,230,61,0.12)`, padding:'16px 24px 24px' }}>
          {NAV.map(l => (
            <Link key={l.to} to={l.to} onClick={()=>setMobileOpen(false)} style={{ display:'block', ...FF.label, fontSize:14, fontWeight:600, color:'rgba(255,255,255,0.8)', textDecoration:'none', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {l.label}
            </Link>
          ))}
          <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
            {isAuthenticated
              ? <Link to="/dashboard" onClick={()=>setMobileOpen(false)} style={{ ...FF.label, fontWeight:700, background:TD.lime, color:TD.ink, textAlign:'center', padding:12, borderRadius:8, textDecoration:'none' }}>Go to Dashboard</Link>
              : <>
                  <Link to="/login"  onClick={()=>setMobileOpen(false)} style={{ ...FF.label, fontWeight:600, color:'#fff', textAlign:'center', padding:12, borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', textDecoration:'none' }}>Sign In</Link>
                  <Link to="/signup" onClick={()=>setMobileOpen(false)} style={{ ...FF.label, fontWeight:700, background:TD.lime, color:TD.ink, textAlign:'center', padding:12, borderRadius:8, textDecoration:'none' }}>Get Started Free</Link>
                </>}
          </div>
        </div>
      )}
    </nav>
  );
};

/* ─── Footer ────────────────────────────────────────────────────────────────── */
export const PublicFooter = () => (
  <footer style={{ background:'#050805', borderTop:`1px solid rgba(168,230,61,0.08)`, padding:'60px 24px 32px' }}>
    <div style={{ maxWidth:1280, margin:'0 auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:40, marginBottom:48 }}>
        <div>
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', marginBottom:16 }}>
            <img src="/logo.svg" alt="TrashDrop" style={{ height:32 }} onError={e=>{e.target.style.display='none'}} />
            <span style={{ ...FF.label, fontSize:17, fontWeight:800, color:'#fff' }}>Trash<span style={{ color:TD.lime }}>Drop</span></span>
          </Link>
          <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.4)', lineHeight:1.7, maxWidth:240 }}>
            Ghana's leading mobile waste management platform. Connecting households with verified collectors across Accra, Kumasi, Takoradi and Tamale.
          </p>
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            {[['fa-twitter','https://twitter.com'],['fa-linkedin','https://linkedin.com'],['fa-instagram','https://instagram.com'],['fa-facebook','https://facebook.com']].map(([icon, href]) => (
              <a key={icon} href={href} target="_blank" rel="noopener noreferrer"
                style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.5)', textDecoration:'none', transition:'all 0.2s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}60`;e.currentTarget.style.color=TD.lime;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='rgba(255,255,255,0.5)';}}>
                <i className={`fab ${icon}`} style={{ fontSize:14 }}></i>
              </a>
            ))}
          </div>
        </div>
        {[
          { title:'Platform', links:[['How It Works','/how-it-works'],['For Households','/users'],['QR Bag System','/how-it-works#qr'],['Digital Bin Service','/how-it-works'],['Pricing','/']] },
          { title:'Collectors', links:[['Earn as Carter','/collectors'],['Carter App','/collectors'],['Authority Assignments','/collectors'],['Earnings Calculator','/collectors'],['Sign Up Free','/signup']] },
          { title:'Resources', links:[['Blog','/blog'],['About Us','/about'],['Report Illegal Dump','/illegal-dumping'],['Waste in Accra','/accra'],['Contact','mailto:hello@trashdrops.com']] },
        ].map(col => (
          <div key={col.title}>
            <h4 style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', textTransform:'uppercase', color:'rgba(255,255,255,0.45)', marginBottom:18 }}>{col.title}</h4>
            {col.links.map(([label, href]) => (
              href.startsWith('mailto') || href.startsWith('http')
                ? <a key={label} href={href} style={{ display:'block', ...FF.body, fontSize:14, color:'rgba(255,255,255,0.55)', textDecoration:'none', marginBottom:10, transition:'color 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'}>
                    {label}
                  </a>
                : <Link key={label} to={href} style={{ display:'block', ...FF.body, fontSize:14, color:'rgba(255,255,255,0.55)', textDecoration:'none', marginBottom:10, transition:'color 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'}>
                    {label}
                  </Link>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <p style={{ ...FF.body, fontSize:12, color:'rgba(255,255,255,0.3)', margin:0 }}>© 2026 Infobrix Limited. All rights reserved. TrashDrop® is a registered trademark.</p>
        <div style={{ display:'flex', gap:20 }}>
          {[['Privacy Policy','#'],['Terms of Service','#'],['Cookie Policy','#']].map(([l,h]) => (
            <a key={l} href={h} style={{ ...FF.body, fontSize:12, color:'rgba(255,255,255,0.3)', textDecoration:'none', transition:'color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.3)'}>
              {l}
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

/* ─── FAQ Accordion ─────────────────────────────────────────────────────────── */
export const FAQAccordion = ({ items, accentColor }) => {
  const [open, setOpen] = useState(null);
  const accent = accentColor || TD.lime;
  return (
    <div style={{ maxWidth:780, margin:'0 auto' }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom:`1px solid rgba(255,255,255,0.07)`, overflow:'hidden' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{ width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'22px 0', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16 }}>
            <span style={{ ...FF.body, fontSize:16, fontWeight:600, color:'#f0f5f0', lineHeight:1.5 }}>{item.q}</span>
            <span style={{ width:28, height:28, borderRadius:'50%', border:`1.5px solid ${accent}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.25s', background: open===i ? `${accent}15` : 'transparent' }}>
              <i className={`fas fa-chevron-${open===i?'up':'down'}`} style={{ fontSize:11, color:accent }}></i>
            </span>
          </button>
          <div style={{ maxHeight: open===i ? 400 : 0, overflow:'hidden', transition:'max-height 0.35s cubic-bezier(.22,1,.36,1)' }}>
            <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.62)', lineHeight:1.75, paddingBottom:22, margin:0 }}>{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Page Wrapper ──────────────────────────────────────────────────────────── */
const PublicPageLayout = ({ children, title, description }) => {
  useEffect(() => {
    if (title) document.title = `${title} | TrashDrop`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc && description) desc.setAttribute('content', description);
  }, [title, description]);

  return (
    <div style={{ background: TD.ink, minHeight:'100vh', ...FF.body }}>
      <style>{`
        @media(max-width:768px) { .td-nav-links{display:none!important} .td-mobile-btn{display:block!important} }
        @media(min-width:769px) { .td-mobile-btn{display:none!important} }
        .td-nav-link:hover { color:#a8e63d !important; }
        @keyframes td-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes td-pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(168,230,61,0.4)} 70%{box-shadow:0 0 0 8px rgba(168,230,61,0)} }
        @keyframes td-fadeup { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .pub-reveal { animation: td-fadeup 0.7s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
};

export default PublicPageLayout;
