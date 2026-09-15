import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicPageLayout, { TD, FF } from '../components/PublicPageLayout';

/* Popular destinations — doubles as internal linking for crawlers that land here. */
const DESTINATIONS = [
  { to:'/how-it-works',    icon:'fa-circle-nodes',      title:'How It Works',        desc:'The QR Bag System and Digital Bin, explained in six steps.' },
  { to:'/users',           icon:'fa-house-chimney',     title:'For Households',      desc:'Book a pickup, track your collector, pay per bag.' },
  { to:'/collectors',      icon:'fa-truck-fast',        title:'Earn as a Carter',    desc:'Join 480+ verified collectors earning on their own schedule.' },
  { to:'/illegal-dumping', icon:'fa-triangle-exclamation', title:'Report Dumping',   desc:'Flag an illegal dump site and track the cleanup.' },
  { to:'/accra',           icon:'fa-location-dot',      title:'Waste in Accra',      desc:'Coverage, collection days and local drop-off points.' },
  { to:'/blog',            icon:'fa-newspaper',         title:'Blog',                desc:'Field notes on waste, recycling and city operations.' },
];

const NotFound = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = 'Page Not Found (404) | TrashDrop';

    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc ? desc.getAttribute('content') : null;
    if (desc) desc.setAttribute('content', 'The page you are looking for does not exist. Browse TrashDrop’s waste collection services, collector signup, and illegal dumping reports.');

    // Tell crawlers not to index error pages. Without this a SPA catch-all
    // returns HTTP 200 for every bad URL, which Google treats as a soft 404.
    let robots = document.querySelector('meta[name="robots"]');
    const prevRobots = robots ? robots.getAttribute('content') : null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, follow');

    // An error page must not claim to be the canonical homepage.
    const canonical = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonical ? canonical.getAttribute('href') : null;
    if (canonical) canonical.remove();

    return () => {
      if (desc && prevDesc !== null) desc.setAttribute('content', prevDesc);
      if (prevRobots !== null) {
        robots.setAttribute('content', prevRobots);
      } else if (robots && robots.parentNode) {
        robots.parentNode.removeChild(robots);
      }
      if (prevCanonical !== null && !document.querySelector('link[rel="canonical"]')) {
        const restored = document.createElement('link');
        restored.rel = 'canonical';
        restored.href = prevCanonical;
        document.head.appendChild(restored);
      }
    };
  }, []);

  return (
    <PublicPageLayout>
      <section style={{ position:'relative', padding:'160px 24px 90px', overflow:'hidden' }}>
        {/* Ambient glow, consistent with the hero treatment elsewhere */}
        <div aria-hidden="true" style={{
          position:'absolute', top:'-20%', left:'50%', transform:'translateX(-50%)',
          width:680, height:680, maxWidth:'140%',
          background:`radial-gradient(circle, ${TD.lime}14 0%, transparent 68%)`,
          pointerEvents:'none'
        }} />

        <div style={{ position:'relative', zIndex:1, maxWidth:960, margin:'0 auto', textAlign:'center' }}>
          <div aria-hidden="true" style={{
            ...FF.data, fontSize:'clamp(96px,17vw,190px)', lineHeight:0.85,
            color:'transparent', WebkitTextStroke:`2px ${TD.lime}55`,
            letterSpacing:'6px', marginBottom:20, userSelect:'none'
          }}>404</div>

          <h1 style={{
            ...FF.display, fontSize:'clamp(32px,4.6vw,56px)', lineHeight:1.05,
            letterSpacing:'-1.2px', color:'#f0f5f0', margin:'0 0 18px'
          }}>
            This page went out with the bins.
          </h1>

          <p style={{
            ...FF.body, fontSize:17, fontWeight:300, lineHeight:1.75,
            color:'rgba(255,255,255,0.55)', maxWidth:560, margin:'0 auto 14px'
          }}>
            We couldn’t find anything at that address. It may have been moved, renamed,
            or it never existed in the first place.
          </p>

          <p style={{
            ...FF.label, fontSize:12, letterSpacing:'1px',
            color:'rgba(255,255,255,0.3)', margin:'0 0 40px', wordBreak:'break-all'
          }}>
            {pathname}
          </p>

          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:72 }}>
            <Link to="/" style={{
              ...FF.label, fontSize:13, fontWeight:700, background:TD.lime, color:TD.ink,
              padding:'13px 30px', borderRadius:8, textDecoration:'none',
              boxShadow:`0 4px 20px ${TD.lime}40`, transition:'transform 0.2s'
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';}}
              onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';}}>
              Back to Home
            </Link>
            <Link to="/illegal-dumping" style={{
              ...FF.label, fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.8)',
              padding:'13px 30px', borderRadius:8, textDecoration:'none',
              border:'1px solid rgba(255,255,255,0.16)', transition:'all 0.2s'
            }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}60`;e.currentTarget.style.color=TD.lime;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.16)';e.currentTarget.style.color='rgba(255,255,255,0.8)';}}>
              Report Illegal Dumping
            </Link>
          </div>

          <h2 style={{
            ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px',
            textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:24
          }}>
            Popular pages
          </h2>

          <div style={{
            display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',
            gap:14, textAlign:'left'
          }}>
            {DESTINATIONS.map(d => (
              <Link key={d.to} to={d.to} style={{
                display:'block', padding:'20px 22px', borderRadius:14,
                background:'rgba(255,255,255,0.03)',
                border:'1px solid rgba(255,255,255,0.08)',
                textDecoration:'none', transition:'all 0.25s'
              }}
                onMouseEnter={e=>{
                  e.currentTarget.style.borderColor=`${TD.lime}45`;
                  e.currentTarget.style.background='rgba(255,255,255,0.055)';
                  e.currentTarget.style.transform='translateY(-3px)';
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';
                  e.currentTarget.style.background='rgba(255,255,255,0.03)';
                  e.currentTarget.style.transform='translateY(0)';
                }}>
                <i className={`fas ${d.icon}`} aria-hidden="true" style={{ color:TD.lime, fontSize:15, marginBottom:10, display:'block' }} />
                <span style={{ ...FF.display, display:'block', fontSize:17, color:'#f0f5f0', marginBottom:6, letterSpacing:'-0.3px' }}>{d.title}</span>
                <span style={{ ...FF.body, display:'block', fontSize:13, fontWeight:300, color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>{d.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default NotFound;
