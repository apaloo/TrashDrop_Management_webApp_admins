import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I report illegal dumping in Ghana?",
      "acceptedAnswer": { "@type": "Answer", "text": "Open the TrashDrop app at trashdrops.com, tap 'Report Illegal Dumping,' photograph the dump site (minimum one clear photo), allow the app to capture your GPS coordinates to pinpoint the location, and submit the report. You will immediately earn reward points that can be redeemed for discounts on future pickups or donated to community projects." }
    },
    {
      "@type": "Question",
      "name": "Is illegal dumping a crime in Ghana?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence. Offenders can face fines and prosecution. Reporting through TrashDrop is the fastest way to trigger enforcement action by the relevant municipal authority." }
    },
    {
      "@type": "Question",
      "name": "What happens after I report an illegal dump on TrashDrop?",
      "acceptedAnswer": { "@type": "Answer", "text": "TrashDrop notifies the relevant municipal authority and dispatches licensed cleanup crews. You can track the cleanup status directly in the app. The report is logged with GPS coordinates, photos, and a timestamp for official use as evidence if required." }
    },
    {
      "@type": "Question",
      "name": "Do I get a reward for reporting illegal dumping?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. You immediately earn reward points when you submit a valid illegal dumping report. Points can be redeemed for discounts on future waste pickups or donated to community environmental projects." }
    },
    {
      "@type": "Question",
      "name": "Can I report anonymously?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. TrashDrop supports anonymous reporting. Your identity is not shared with the municipal authority or the public unless you choose to include your details for follow-up communication." }
    }
  ]
};

const REPORT_STEPS = [
  { n:'01', icon:'fa-mobile-alt',        title:'Open the App',            body:'Go to trashdrops.com on any smartphone. No download required. Sign in or continue anonymously.' },
  { n:'02', icon:'fa-exclamation-triangle','title':'Tap "Report Illegal Dumping"', body:'Find the report button on the home screen or in the main menu — visible without a full account.' },
  { n:'03', icon:'fa-camera',            title:'Photograph the Site',     body:'Take a minimum of one clear photo of the dump site. Multiple photos increase response priority.' },
  { n:'04', icon:'fa-map-marker-alt',    title:'Allow GPS Location',      body:'The app captures your GPS coordinates automatically to pinpoint the exact location of the dump site.' },
  { n:'05', icon:'fa-paper-plane',       title:'Submit the Report',       body:'Tap submit. Your report is logged with timestamp, coordinates, and photos for official use.' },
  { n:'06', icon:'fa-star',             title:'Earn Points & Track',      body:'You immediately earn reward points. Track the cleanup status directly in the app in real time.' },
];

const FAQ_ITEMS = [
  { q:'Is illegal dumping a crime in Ghana?', a:"Yes. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence. Offenders can face fines and prosecution by Environmental Health Officers. Reporting through TrashDrop is the fastest way to trigger formal enforcement action by the relevant Municipal or Metropolitan District Assembly." },
  { q:'What happens after I report?', a:'TrashDrop notifies the relevant municipal authority and dispatches licensed cleanup crews. You can track the cleanup status directly in the app. The report includes GPS coordinates, timestamped photos, and waste type data which municipal environmental health officers can use directly.' },
  { q:'Do I earn anything for reporting?', a:'Yes. You immediately earn reward points when you submit a valid illegal dumping report. Points can be redeemed for discounts on future waste pickups or donated to community environmental projects.' },
  { q:'Can I report anonymously?', a:"Yes. TrashDrop supports anonymous reporting. Your identity is not shared with the municipal authority or the public. You can optionally include your contact details for follow-up communication if you'd like to receive updates." },
  { q:'Which cities can I report in?', a:'You can report illegal dumping anywhere in Ghana where TrashDrop operates — currently Accra, Kumasi, Takoradi, and Tamale. GPS coordinates are captured regardless of location, and reports are routed to the nearest municipal authority.' },
  { q:'What counts as illegal dumping?', a:"Illegal dumping includes disposing of any waste — household rubbish, construction debris, industrial waste, e-waste, or hazardous materials — in any location not designated as an authorised disposal or recycling facility. Common sites in Ghana include roadsides, drainage channels, beaches, farmland, and vacant plots." },
];

const IllegalDumpingPublicPage = () => {
  useEffect(() => {
    document.title = 'Report Illegal Dumping in Ghana | TrashDrop';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', 'Report illegal dumping in Ghana in under 2 minutes via the TrashDrop app at trashdrops.com. Get GPS-pinpointed enforcement, earn reward points, and track cleanup. Available in Accra, Kumasi, Takoradi and Tamale.');

    // Fix canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://trashdrops.com/illegal-dumping';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/illegal-dumping');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/illegal-dumping');

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id   = 'faq-schema-illegal-dumping-public';
    script.text = JSON.stringify(FAQ_SCHEMA);
    const existing = document.getElementById('faq-schema-illegal-dumping-public');
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => {
      const s = document.getElementById('faq-schema-illegal-dumping-public'); if (s) s.remove();
      const can = document.querySelector('link[rel="canonical"]'); if (can) can.href = 'https://trashdrops.com/';
      const ogU = document.querySelector('meta[property="og:url"]'); if (ogU) ogU.setAttribute('content', 'https://trashdrops.com/');
      const twU = document.querySelector('meta[name="twitter:url"]'); if (twU) twU.setAttribute('content', 'https://trashdrops.com/');
    };
  }, []);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <section style={{ background:`linear-gradient(160deg,#1a0a0a 0%,#120808 50%,${TD.ink} 100%)`, padding:'140px 24px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:`linear-gradient(rgba(220,38,38,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(220,38,38,0.3) 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none' }} />
        <div style={{ maxWidth:820, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.3)', borderRadius:99, padding:'6px 18px', marginBottom:24 }}>
            <i className="fas fa-exclamation-triangle" style={{ color:'#ef4444', fontSize:11 }}></i>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:'#f87171', textTransform:'uppercase' }}>Report Illegal Dumping</span>
          </div>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,64px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            How do I report illegal dumping in Ghana?
          </h1>
          {/* ── AI ANSWER PARAGRAPH ── */}
          <p style={{ ...FF.body, fontSize:17, color:'rgba(255,255,255,0.72)', lineHeight:1.82, maxWidth:740, margin:'0 auto 40px' }}>
            Illegal dumping — the disposal of waste in unauthorised locations — can be reported quickly and easily through the TrashDrop app at trashdrops.com. Open the app, tap "Report Illegal Dumping," photograph the dump site (minimum one clear photo), allow the app to capture your GPS coordinates to pinpoint the location, and submit the report. You will immediately earn reward points that can be redeemed for discounts on future pickups or donated to community projects. TrashDrop notifies the relevant municipal authority and dispatches licensed cleanup crews, and you can track the cleanup status directly in the app. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence — reporting through TrashDrop is the fastest way to trigger enforcement action in Accra, Kumasi, Takoradi or Tamale.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ ...FF.label, fontSize:14, fontWeight:700, background:'#ef4444', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:'0 8px 32px rgba(239,68,68,0.4)' }}>
              Report a Dump Site
            </Link>
            <a href="#how-to-report" style={{ ...FF.label, fontSize:14, fontWeight:700, background:'transparent', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', border:`1.5px solid rgba(255,255,255,0.18)` }}>
              See How It Works ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── Scale stat bar ── */}
      <section style={{ background:'#100808', padding:'48px 24px', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ maxWidth:900, margin:'0 auto', display:'flex', gap:40, justifyContent:'center', flexWrap:'wrap' }}>
          {[{v:'12M+',l:'Tonnes of Waste Generated Annually in Ghana'},{v:'Act 490',l:'Ghana Environmental Sanitation Law'},{v:'<2 min',l:'Time to Submit a Report'},{v:'4 Cities',l:'Active Enforcement Coverage'}].map(s=>(
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ ...FF.data, fontSize:30, color:'#f87171', letterSpacing:'1px' }}>{s.v}</div>
              <div style={{ ...FF.label, fontSize:10, color:TD.sage, fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', maxWidth:140 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Steps ── */}
      <section id="how-to-report" style={{ background:TD.ink2, padding:'96px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>Step by Step</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'12px 0 0', letterSpacing:'-1px' }}>Report in under two minutes</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {REPORT_STEPS.map((s,i) => (
              <div key={i} style={{ background:'rgba(220,38,38,0.04)', border:'1px solid rgba(220,38,38,0.12)', borderRadius:18, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:12, right:18, ...FF.data, fontSize:48, color:'rgba(220,38,38,0.08)' }}>{s.n}</div>
                <div style={{ width:44, height:44, borderRadius:12, background:'rgba(220,38,38,0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                  <i className={`fas ${s.icon}`} style={{ color:'#f87171', fontSize:17 }}></i>
                </div>
                <h3 style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#f0f5f0', marginBottom:8 }}>{s.title}</h3>
                <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7, margin:0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What Happens After ── */}
      <section style={{ background:'#0c0808', padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', letterSpacing:'-1px', margin:0 }}>What happens after you report</h2>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { step:'Immediately', text:'Your report is logged with GPS coordinates, timestamped photos, and waste type classification. You earn reward points instantly.', color:'#22c55e' },
              { step:'Within 1 hour', text:'TrashDrop routes the report to the relevant Municipal District Assembly and environmental enforcement unit.', color:TD.lime },
              { step:'Within 24 hours', text:'A licensed cleanup team is dispatched to the site. The report is assigned a reference number for tracking.', color:TD.gold },
              { step:'Ongoing',        text:'You track cleanup progress directly in the TrashDrop app. Once the site is confirmed clean, your report is marked resolved.', color:'#3b82f6' },
            ].map((r,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:20, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'20px 24px' }}>
                <span style={{ ...FF.label, fontSize:11, fontWeight:700, color:r.color, letterSpacing:'1px', whiteSpace:'nowrap', marginTop:2 }}>{r.step}</span>
                <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.62)', lineHeight:1.7, margin:0 }}>{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ghana Law Box ── */}
      <section style={{ background:TD.ink, padding:'80px 24px' }}>
        <div style={{ maxWidth:820, margin:'0 auto', background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.18)', borderRadius:20, padding:'40px 40px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
            <i className="fas fa-gavel" style={{ color:'#f87171', fontSize:28, marginTop:4, flexShrink:0 }}></i>
            <div>
              <h3 style={{ ...FF.label, fontSize:16, fontWeight:700, color:'#f0f5f0', marginBottom:12 }}>Ghana's Environmental Sanitation Law</h3>
              <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.65)', lineHeight:1.8, margin:'0 0 12px' }}>
                Under <strong style={{ color:'#f0f5f0' }}>Act 490 (Environmental Sanitation Policy)</strong>, illegal dumping is a fineable offence in Ghana. Environmental Health Officers attached to Municipal and Metropolitan District Assemblies are empowered to issue fines and prosecute offenders.
              </p>
              <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.65)', lineHeight:1.8, margin:0 }}>
                Reporting through TrashDrop provides authorities with GPS-verified, photo-documented evidence — the fastest pathway to formal enforcement action in Accra, Kumasi, Takoradi or Tamale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background:TD.ink2, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,42px)', color:'#f0f5f0', margin:'0 0 0', letterSpacing:'-0.5px' }}>Frequently asked questions</h2>
          </div>
          <FAQAccordion items={FAQ_ITEMS} accentColor="#f87171" />
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background:`linear-gradient(135deg,#1a0808 0%,${TD.ink} 100%)`, padding:'80px 24px', textAlign:'center' }}>
        <i className="fas fa-exclamation-triangle" style={{ color:'#ef4444', fontSize:32, marginBottom:16, display:'block' }}></i>
        <h2 style={{ ...FF.display, fontSize:'clamp(26px,4vw,44px)', color:'#f0f5f0', margin:'0 0 16px', letterSpacing:'-1px' }}>See an illegal dump site?</h2>
        <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.5)', margin:'0 auto 36px', maxWidth:480 }}>Report it in under 2 minutes. Earn reward points. Help keep your community clean.</p>
        <Link to="/signup" style={{ ...FF.label, fontSize:15, fontWeight:700, background:'#ef4444', color:'#fff', padding:'16px 40px', borderRadius:12, textDecoration:'none', boxShadow:'0 8px 32px rgba(239,68,68,0.4)', display:'inline-block' }}>
          Report a Dump Site Now
        </Link>
      </section>
    </PublicPageLayout>
  );
};

export default IllegalDumpingPublicPage;
