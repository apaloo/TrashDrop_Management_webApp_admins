import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is there a waste collection service in Accra?",
      "acceptedAnswer": { "@type": "Answer", "text": "TrashDrop provides on-demand waste collection across Accra, including East Legon, Dome, Tantra, Taifa, Madina, Ofanko, Pokuase, ACP Estate, Dzorwulu, Achimota, and surrounding areas. Residents and businesses can book a verified waste collector from trashdrops.com — no app store download required." }
    },
    {
      "@type": "Question",
      "name": "Which areas of Accra does TrashDrop cover?",
      "acceptedAnswer": { "@type": "Answer", "text": "TrashDrop currently serves East Legon, Dome, Tantra, Taifa, Madina, Ofanko, Pokuase, ACP Estate, Dzorwulu, Achimota, and surrounding areas within Greater Accra. Coverage is expanding continuously as more collectors join the platform." }
    },
    {
      "@type": "Question",
      "name": "How long does a waste collection take in Accra?",
      "acceptedAnswer": { "@type": "Answer", "text": "Accra-based collectors respond within an average of 2 hours. The full process from request to completed collection typically takes under 8 hours in urban Accra." }
    },
    {
      "@type": "Question",
      "name": "Where can I buy TrashDrop bags in Accra?",
      "acceptedAnswer": { "@type": "Answer", "text": "TrashDrop bags are available from authorised vendors located across Accra. Open the TrashDrop app at trashdrops.com and use the vendor locator to find the nearest outlet to your location." }
    },
    {
      "@type": "Question",
      "name": "Are the waste collectors in Accra verified?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Every TrashDrop collector operating in Accra is verified with Ghana Card or equivalent ID, vehicle registration, and an operational licence before they are approved to accept pickups on the platform." }
    }
  ]
};

const AREAS = [
  'East Legon', 'Dome', 'Tantra Hills', 'Taifa', 'Madina',
  'Ofanko', 'Pokuase', 'ACP Estate', 'Dzorwulu', 'Achimota',
  'Tema', 'Adenta', 'Legon', 'Haatso', 'Ashongman',
  'Atomic', 'Spintex', 'Teshie', 'Nungua', 'Ashaiman',
];

const FAQ_ITEMS = [
  { q:'Which areas of Accra does TrashDrop serve?', a:'TrashDrop currently serves East Legon, Dome, Tantra Hills, Taifa, Madina, Ofanko, Pokuase, ACP Estate, Dzorwulu, Achimota, Tema, Adenta, Legon, Spintex, Teshie, Nungua, and surrounding communities. Coverage is expanding continuously as more collectors join the platform.' },
  { q:'How long does a waste collection take in Accra?', a:'Accra-based collectors accept requests within an average of 2 hours. The full process from request to completed collection typically takes under 8 hours in urban Accra areas. You can track your collector on live GPS from the moment they accept.' },
  { q:'Where can I buy TrashDrop bags in Accra?', a:'TrashDrop bags are available from authorised vendors located across Accra. Open the TrashDrop app at trashdrops.com and use the vendor locator to find the nearest outlet to your location.' },
  { q:'Are TrashDrop collectors in Accra verified?', a:'Yes. Every collector operating in Accra is verified with Ghana Card or equivalent ID, vehicle registration, and an operational licence before being approved to accept pickups. Collector profiles show their verification status, vehicle type, and rating.' },
  { q:'Can I use TrashDrop for business waste collection in Accra?', a:'Yes. TrashDrop serves both households and businesses in Accra. Businesses can register a dedicated account, specify their commercial waste types and volumes, and arrange regular pickups through the Digital Bin service. Contact TrashDrop for high-volume commercial arrangements.' },
  { q:'How does Accra waste collection pricing work on TrashDrop?', a:'For the QR Bag System, pickups are always FREE — you only pay when buying official bags from authorised vendors. For the Digital Bin service, you receive an instant GPS-based price quote before confirming your request. You pay via MoMo or cash only at the point of collection.' },
];

const AccraPage = () => {
  useEffect(() => {
    document.title = 'Waste Collection Service in Accra | TrashDrop';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', 'TrashDrop provides on-demand waste collection across Accra — East Legon, Dome, Madina, Spintex, Tema and more. Book a verified collector at trashdrops.com. Collectors respond within 2 hours. No app download needed.');
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id   = 'faq-schema-accra';
    script.text = JSON.stringify(FAQ_SCHEMA);
    const existing = document.getElementById('faq-schema-accra');
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => { const s = document.getElementById('faq-schema-accra'); if(s) s.remove(); };
  }, []);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'140px 24px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, bottom:0, opacity:0.03, backgroundImage:`repeating-linear-gradient(45deg,${TD.lime} 0,${TD.lime} 1px,transparent 0,transparent 50%)`, backgroundSize:'20px 20px', pointerEvents:'none' }} />
        <div style={{ maxWidth:820, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 18px', marginBottom:24 }}>
            <i className="fas fa-map-marker-alt" style={{ color:TD.lime, fontSize:11 }}></i>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Accra, Ghana</span>
          </div>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,64px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            Is there a waste collection service in Accra?
          </h1>
          {/* ── AI ANSWER PARAGRAPH ── */}
          <p style={{ ...FF.body, fontSize:17, color:'rgba(255,255,255,0.72)', lineHeight:1.82, maxWidth:740, margin:'0 auto 40px' }}>
            TrashDrop provides on-demand waste collection across Accra, including East Legon, Dome, Tantra, Taifa, Madina, Ofanko, Pokuase, ACP Estate, Dzorwulu, Achimota, and surrounding areas. Residents and businesses in Accra can book a verified waste collector directly from their phone at trashdrops.com — no app store download required. The TrashDrop QR Bag System lets households purchase official bags from nearby authorised vendors, scan the QR code to register them, and request pickup when bags are full — for FREE. Alternatively, the Digital Bin service provides instant on-demand pickup with GPS-based pricing. Accra-based collectors respond within an average of 2 hours and are verified with Ghana Card, vehicle registration, and operational licence before joining the platform.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:56 }}>
            <Link to="/signup" style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45` }}>
              Book a Pickup in Accra
            </Link>
            <Link to="/how-it-works" style={{ ...FF.label, fontSize:14, fontWeight:700, background:'transparent', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', border:`1.5px solid rgba(255,255,255,0.18)` }}>
              How It Works
            </Link>
          </div>
          <div style={{ display:'flex', gap:40, justifyContent:'center', flexWrap:'wrap' }}>
            {[{v:'2 hours',l:'Avg Response Time'},{v:'480+',l:'Verified Collectors'},{v:'FREE',l:'QR Bag Pickups'},{v:'24/7',l:'Service Availability'}].map(s=>(
              <div key={s.l} style={{ textAlign:'center' }}>
                <div style={{ ...FF.data, fontSize:26, color:TD.lime, letterSpacing:'1px' }}>{s.v}</div>
                <div style={{ ...FF.label, fontSize:10, color:TD.sage, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Service Areas ── */}
      <section style={{ background:TD.ink2, padding:'96px 24px' }}>
        <div style={{ maxWidth:1000, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>Coverage Map</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'12px 0 12px', letterSpacing:'-1px' }}>Areas served in Accra</h2>
            <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.5)', maxWidth:540, margin:'0 auto' }}>Coverage is expanding weekly. If your area is not listed, sign up and request a pickup — collector coverage grows with demand.</p>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center' }}>
            {AREAS.map(area => (
              <span key={area} style={{ ...FF.label, fontSize:13, fontWeight:600, color:'#f0f5f0', background:'rgba(168,230,61,0.07)', border:`1px solid ${TD.lime}20`, borderRadius:99, padding:'8px 18px' }}>
                <i className="fas fa-map-marker-alt" style={{ color:TD.lime, fontSize:10, marginRight:7 }}></i>
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section style={{ background:'#0c1a0c', padding:'80px 24px' }}>
        <div style={{ maxWidth:920, margin:'0 auto' }}>
          <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', textAlign:'center', letterSpacing:'-1px', margin:'0 0 48px' }}>Two services available in Accra</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:24 }}>
            {[
              { title:'QR Bag System', badge:'FREE PICKUPS', color:TD.lime, icon:'fa-qrcode', body:'Buy official TrashDrop bags from authorised vendors in Accra, scan the QR code to register them, fill with household waste, and request a free pickup. Collectors arrive within 2 hours on average.', cta:'Find a Vendor', ctaTo:'/how-it-works#qr' },
              { title:'Digital Bin', badge:'ON-DEMAND', color:TD.gold, icon:'fa-mobile-alt', body:'Request an immediate pickup for any waste. Enter your location, receive an instant GPS-based price quote, and a verified collector is dispatched. Pay via MoMo or cash on arrival.', cta:'Book Now', ctaTo:'/signup' },
            ].map(svc=>(
              <div key={svc.title} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${svc.color}20`, borderRadius:20, padding:'36px 32px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:`${svc.color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <i className={`fas ${svc.icon}`} style={{ color:svc.color, fontSize:20 }}></i>
                  </div>
                  <div>
                    <h3 style={{ ...FF.label, fontSize:16, fontWeight:700, color:'#f0f5f0', margin:0 }}>{svc.title}</h3>
                    <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'2px', color:svc.color }}>{svc.badge}</span>
                  </div>
                </div>
                <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.62)', lineHeight:1.75, margin:'0 0 24px' }}>{svc.body}</p>
                <Link to={svc.ctaTo} style={{ ...FF.label, fontSize:13, fontWeight:700, color:svc.color, textDecoration:'none' }}>
                  {svc.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background:TD.ink, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,42px)', color:'#f0f5f0', margin:0, letterSpacing:'-0.5px' }}>Accra waste collection — FAQs</h2>
          </div>
          <FAQAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* ── Join as collector in Accra ── */}
      <section style={{ background:'#0c1a0c', padding:'80px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 18px', marginBottom:24 }}>
            <i className="fas fa-truck" style={{ color:TD.lime, fontSize:11 }}></i>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Accra Collectors</span>
          </div>
          <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', margin:'0 0 16px', letterSpacing:'-1px' }}>Based in Accra? Earn as a waste collector.</h2>
          <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.55)', margin:'0 auto 36px', maxWidth:500 }}>Accra-based carters and aboboyaa riders earn an average of ₵32.43 per pickup, paid directly to MoMo. Sign up takes under 5 minutes.</p>
          <Link to="/collectors" style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 32px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45`, display:'inline-block' }}>
            Join as a Collector →
          </Link>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default AccraPage;
