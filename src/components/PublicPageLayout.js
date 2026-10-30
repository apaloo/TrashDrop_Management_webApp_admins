import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BUSINESS } from '../utils/seo';
import { PublicMenuDesktop, PublicMenuMobile } from './PublicMenu';
import { TD, FF, BTN, TYPE } from '../theme/brand';

/* ─── Brand tokens: src/theme/brand.js (re-exported for the pages) ─────────── */
export { TD, FF };

const SOCIAL_NAMES = { 'fa-twitter':'X (Twitter)', 'fa-linkedin':'LinkedIn', 'fa-instagram':'Instagram', 'fa-facebook':'Facebook' };

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

  const navBg     = scrolled ? 'rgba(10,15,10,0.97)' : 'transparent';
  const navBorder = scrolled ? `1px solid rgba(182,238,105,0.12)` : '1px solid transparent';
  const linkColor = 'rgba(255,255,255,0.78)';
  const brandColor = '#fff';
  const menuColors = { link:linkColor, linkHover:TD.lime, panelBg:TD.ink, panelBorder:'rgba(182,238,105,0.15)', panelText:'rgba(255,255,255,0.88)', panelMuted:'rgba(255,255,255,0.45)', accent:TD.lime, divider:'rgba(255,255,255,0.07)' };

  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:1500, transition:'all 0.35s ease', background:navBg, backdropFilter:scrolled?'blur(22px)':'none', borderBottom:navBorder }}>
      <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:20, height:68 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', flexShrink:0, whiteSpace:'nowrap' }}>
          <img src="/logo.svg" alt="TrashDrop" style={{ height:36, width:36 }} onError={e=>{e.target.style.display='none'}} />
          <span style={{ ...FF.label, fontSize:18, fontWeight:700, color:brandColor, letterSpacing:'-0.3px' }}>Trash<span style={{ color:TD.lime }}>Drop</span></span>
        </Link>
        <PublicMenuDesktop className="td-nav-links" colors={menuColors} />
        <div className="td-nav-links" style={{ display:'flex', gap:10, alignItems:'center', flexShrink:0 }}>
          {isAuthenticated
            ? <Link to="/dashboard" className="td-pub-btn" style={{ ...BTN.primaryOnDark, ...BTN.small }}>Dashboard</Link>
            : <>
                <Link to="/login"  className="td-pub-btn" style={{ ...FF.label, fontSize:16, fontWeight:600, color:'#f0f5f0', textDecoration:'none', padding:'9px 14px' }}>Sign in</Link>
                <Link to="/#book-app" className="td-pub-btn" style={{ ...BTN.primaryOnDark, ...BTN.small }}>Book a pickup</Link>
              </>}
        </div>
        <button className="td-mobile-btn" onClick={() => setMobileOpen(o=>!o)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} style={{ background:'none', border:'none', cursor:'pointer', padding:8, color:'#fff' }}>
          <i className={`fas ${mobileOpen?'fa-times':'fa-bars'}`} style={{ fontSize:18 }}></i>
        </button>
      </div>
      {mobileOpen && (
        <div style={{ background:TD.ink, borderTop:`1px solid rgba(182,238,105,0.12)`, padding:'8px 24px 24px', maxHeight:'calc(100vh - 68px)', overflowY:'auto' }}>
          <PublicMenuMobile colors={menuColors} onNavigate={() => setMobileOpen(false)} />
          <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:8 }}>
            {isAuthenticated
              ? <Link to="/dashboard" onClick={()=>setMobileOpen(false)} style={{ ...FF.label, fontWeight:700, background:TD.lime, color:TD.ink, textAlign:'center', padding:12, borderRadius:8, textDecoration:'none' }}>Go to Dashboard</Link>
              : <>
                  <Link to="/login"  onClick={()=>setMobileOpen(false)} style={{ ...FF.label, fontWeight:600, color:'#fff', textAlign:'center', padding:12, borderRadius:8, border:'1px solid rgba(255,255,255,0.15)', textDecoration:'none' }}>Sign In</Link>
                  <Link to="/#book-app" onClick={()=>setMobileOpen(false)} style={{ ...BTN.primaryOnDark, display:'flex' }}>Book a pickup</Link>
                </>}
          </div>
        </div>
      )}
    </nav>
  );
};

/* ─── Footer ────────────────────────────────────────────────────────────────── */
export const PublicFooter = () => (
  <footer style={{ background:'#050805', borderTop:`1px solid rgba(182,238,105,0.08)`, padding:'60px 24px 32px' }}>
    <div style={{ maxWidth:1280, margin:'0 auto' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:40, marginBottom:48 }}>
        <div>
          <Link to="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', marginBottom:16 }}>
            <img src="/logo.svg" alt="TrashDrop" style={{ height:32 }} onError={e=>{e.target.style.display='none'}} />
            <span style={{ ...FF.label, fontSize:18, fontWeight:700, color:'#fff' }}>Trash<span style={{ color:TD.lime }}>Drop</span></span>
          </Link>
          <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.68)', lineHeight:1.7, maxWidth:240 }}>
            Ghana's leading mobile waste management platform. Connecting households with verified collectors across Accra, Kumasi, Takoradi and Tamale.
          </p>
          <div style={{ display:'flex', gap:10, marginTop:20 }}>
            {[['fa-twitter','https://twitter.com'],['fa-linkedin','https://linkedin.com'],['fa-instagram','https://instagram.com'],['fa-facebook',BUSINESS.facebookUrl]].map(([icon, href]) => (
              <a key={icon} href={href} target="_blank" rel="noopener noreferrer" aria-label={`TrashDrop on ${SOCIAL_NAMES[icon]}`}
                style={{ width:34, height:34, borderRadius:8, border:'1px solid rgba(255,255,255,0.12)', display:'flex', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.68)', textDecoration:'none', transition:'all 0.2s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}60`;e.currentTarget.style.color=TD.lime;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.12)';e.currentTarget.style.color='rgba(255,255,255,0.68)';}}>
                <i className={`fab ${icon}`} style={{ fontSize:14 }} aria-hidden="true"></i>
              </a>
            ))}
          </div>
        </div>
        {[
          { title:'Platform', links:[['How It Works','/how-it-works/'],['For Households','/users/'],['QR Bag System','/how-it-works/#qr'],['Digital Bin Service','/how-it-works/'],['Pricing','/how-it-works/#pricing']] },
          { title:'Collectors', links:[['Earn as Carter','/collectors/'],['Carter App','/collectors/'],['Authority Assignments','/collectors/'],['Earnings Calculator','/collectors/'],["Sign Up Free","/collectors/#download-app"]] },
          { title:'Waste Collection', links:[['Accra','/waste-collection-accra/'],['Kumasi','/waste-collection-kumasi/'],['Takoradi','/waste-collection-takoradi/'],['Tamale','/waste-collection-tamale/'],['On-demand waste pickup','/waste-pickup/']] },
          { title:'Resources', links:[['FAQ','/faq/'],['Blog','/blog/'],['About Us','/about/'],['Partners','/partners/'],['Report Illegal Dump','/illegal-dumping/'],['WhatsApp +233 20 933 8885','https://wa.me/233209338885'],['Contact','mailto:hello@trashdrops.com']] },
        ].map(col => (
          <div key={col.title}>
            <h4 style={{ ...FF.label, fontSize:13, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'rgba(255,255,255,0.68)', marginBottom:18 }}>{col.title}</h4>
            {col.links.map(([label, href]) => (
              href.startsWith('mailto') || href.startsWith('http')
                ? <a key={label} href={href} style={{ display:'block', ...FF.body, fontSize:14, color:'rgba(255,255,255,0.68)', textDecoration:'none', marginBottom:10, transition:'color 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.68)'}>
                    {label}
                  </a>
                : <Link key={label} to={href} style={{ display:'block', ...FF.body, fontSize:14, color:'rgba(255,255,255,0.68)', textDecoration:'none', marginBottom:10, transition:'color 0.2s' }}
                    onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
                    onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.68)'}>
                    {label}
                  </Link>
            ))}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.68)', margin:0 }}>© 2026 Infobrix Limited. All rights reserved. TrashDrop® is a registered trademark.</p>
        <div style={{ display:'flex', gap:20 }}>
          {[['Privacy Policy','/privacy/'],['Terms of Service','/terms/'],['Cookie Policy','/privacy/#cookies']].map(([l,h]) => (
            <a key={l} href={h} style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.68)', textDecoration:'none', transition:'color 0.2s' }}
              onMouseEnter={e=>e.currentTarget.style.color=TD.lime}
              onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.68)'}>
              {l}
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

/* ─── FAQ Accordion ─────────────────────────────────────────────────────────── */
export const FAQAccordion = ({ items, accentColor, surface = 'dark' }) => {
  const [open, setOpen] = useState(null);
  const light = surface === 'light';
  const accent = accentColor || (light ? TD.forest : TD.lime);
  return (
    <div style={{ maxWidth:780, margin:'0 auto' }}>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom:`1px solid ${light ? 'var(--td-border)' : 'rgba(255,255,255,0.1)'}`, overflow:'hidden' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
            style={{ width:'100%', textAlign:'left', background:'none', border:'none', cursor:'pointer', padding:'22px 0', display:'flex', justifyContent:'space-between', alignItems:'center', gap:16 }}>
            <span style={{ ...TYPE.body, fontWeight:600, color: light ? TD.ink : '#f0f5f0' }}>{item.q}</span>
            <span style={{ width:32, height:32, borderRadius:'50%', border:`1.5px solid ${accent}55`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.25s', background: open===i ? `${accent}18` : 'transparent' }}>
              <i className={`fas fa-chevron-${open===i?'up':'down'}`} aria-hidden="true" style={{ fontSize:13, color:accent }}></i>
            </span>
          </button>
          <div style={{ maxHeight: open===i ? 600 : 0, overflow:'hidden', transition:'max-height 0.35s cubic-bezier(.22,1,.36,1)' }}>
            <p style={{ ...TYPE.body, color: light ? TD.sage : TD.sageOnDark, paddingBottom:22, margin:0, maxWidth:680 }}>{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Links to a long page's sections, kept under the header while you scroll;
 * the one you are reading is marked. `items`: [{ id, label }]
 */
export const SectionNav = ({ items, label = 'On this page' }) => {
  const [current, setCurrent] = useState(items[0]?.id);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return undefined;
    const els = items.map(it => document.getElementById(it.id)).filter(Boolean);
    const obs = new IntersectionObserver(entries => {
      const seen = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (seen[0]) setCurrent(seen[0].target.id);
    }, { rootMargin: '-140px 0px -55% 0px' });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);
  return (
    <nav aria-label={label} className="td-section-nav" style={{ position:'sticky', top:'var(--td-header-h)', zIndex:1400, background:'rgba(246,248,244,0.96)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--td-border)' }}>
      <ul style={{ listStyle:'none', margin:'0 auto', maxWidth:1200, padding:'10px 24px', display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none' }}>
        {items.map(it => (
          <li key={it.id} style={{ flexShrink:0 }}>
            <a href={`#${it.id}`} aria-current={current === it.id ? 'location' : undefined}
              onClick={e => { const el = document.getElementById(it.id); if (el) { e.preventDefault(); el.scrollIntoView({ behavior:'smooth', block:'start' }); window.history.replaceState(null, '', `#${it.id}`); } }}
              style={{ display:'inline-flex', alignItems:'center', minHeight:40, padding:'0 16px', borderRadius:999, ...TYPE.small, fontWeight:600, textDecoration:'none',
                color: current === it.id ? TD.forest : TD.sage, background: current === it.id ? '#e6f2e9' : 'transparent' }}>
              {it.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
        .td-pub-btn { white-space:nowrap; }
        @media(max-width:1023px) { .td-nav-links{display:none!important} .td-mobile-btn{display:block!important} }
        @media(min-width:1024px) { .td-mobile-btn{display:none!important} }
        .td-nav-link:hover { color:#b6ee69 !important; }
        @keyframes td-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes td-pulse-dot { 0%,100%{box-shadow:0 0 0 0 rgba(182,238,105,0.4)} 70%{box-shadow:0 0 0 8px rgba(182,238,105,0)} }
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
