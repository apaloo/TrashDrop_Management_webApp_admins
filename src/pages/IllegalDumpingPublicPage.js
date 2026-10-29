import React, { useEffect } from 'react';
import PublicPageLayout, { TD, FAQAccordion } from '../components/PublicPageLayout';
import { TYPE, BTN } from '../theme/brand';
import { HOUSEHOLD_APP_URL } from '../config/homepage';

// The page's accent: the error red, readable on white (6.5:1)
const RED = '#b91c1c';

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I report illegal dumping in Ghana?",
      "acceptedAnswer": { "@type": "Answer", "text": "Open the TrashDrop app at app.trashdrops.com, tap 'Report Illegal Dumping,' photograph the dump site (minimum one clear photo), allow the app to capture your GPS coordinates to pinpoint the location, and submit the report. You will immediately earn reward points that can be redeemed for discounts on future pickups or donated to community projects." }
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
  { n:'01', icon:'fa-mobile-alt',        title:'Open the App',            body:'Go to app.trashdrops.com on any smartphone. No download required. Sign in or continue anonymously.' },
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
    if (el) el.setAttribute('content', 'Report illegal dumping in Ghana in under 2 minutes via the TrashDrop app at app.trashdrops.com. Get GPS-pinpointed enforcement, earn reward points, and track cleanup. Available in Accra, Kumasi, Takoradi and Tamale.');

    // Fix canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://trashdrops.com/illegal-dumping/';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/illegal-dumping/');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/illegal-dumping/');

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
      <style>{`
        @media(max-width:900px){ .td-idp-hero{grid-template-columns:1fr!important; gap:40px!important} .td-idp-photo{max-width:440px; width:100%; margin:0 auto!important} .td-idp-photo img{height:440px!important} }
        #how-to-report { scroll-margin-top: 88px; }
      `}</style>
      {/* ── Hero ── */}
      <section data-surface="dark" style={{ background:TD.ink, padding:'calc(var(--td-header-h) + var(--td-section-y)) 24px var(--td-section-y-compact)' }}>
        <div className="td-idp-hero" style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'1.2fr 0.8fr', gap:56, alignItems:'center' }}>
        <div style={{ minWidth:0 }}>
          <span style={{ ...TYPE.eyebrow, color:'#fca5a5', display:'inline-flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <i className="fas fa-exclamation-triangle" aria-hidden="true"></i> Report illegal dumping
          </span>
          <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 20px' }}>
            How do I report illegal dumping in Ghana?
          </h1>
          {/* ── AI ANSWER PARAGRAPH ── */}
          <p style={{ ...TYPE.body, color:TD.sageOnDark, maxWidth:680, margin:'0 0 32px' }}>
            Illegal dumping — the disposal of waste in unauthorised locations — can be reported quickly and easily through the TrashDrop app at app.trashdrops.com. Open the app, tap "Report Illegal Dumping," photograph the dump site (minimum one clear photo), allow the app to capture your GPS coordinates to pinpoint the location, and submit the report. You will immediately earn reward points that can be redeemed for discounts on future pickups or donated to community projects. TrashDrop notifies the relevant municipal authority and dispatches licensed cleanup crews, and you can track the cleanup status directly in the app. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence — reporting through TrashDrop is the fastest way to trigger enforcement action in Accra, Kumasi, Takoradi or Tamale.
          </p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <a href={HOUSEHOLD_APP_URL} style={BTN.primaryOnDark}>
              <i className="fas fa-camera" aria-hidden="true"></i> Report illegal dumping
            </a>
            <a href="#how-to-report" style={BTN.ghostOnDark}>How reporting works</a>
          </div>
        </div>
        {/* One photo is all a report needs */}
        <figure className="td-idp-photo" style={{ position:'relative', margin:0 }}>
          <img src="/images/illegal-dumping/report-with-phone.jpg" width="720" height="1073" decoding="async"
            alt="A young man on a busy street photographs a pile of dumped rubbish with his phone to report it"
            style={{ width:'100%', height:540, objectFit:'cover', borderRadius:'var(--td-radius-panel)', display:'block' }} />
          <figcaption style={{ position:'absolute', left:16, bottom:16, display:'inline-flex', alignItems:'center', gap:8, ...TYPE.small, fontWeight:600, color:'#fff', background:'#b91c1c', padding:'6px 14px', borderRadius:999 }}>
            <i className="fas fa-camera" aria-hidden="true"></i> Snap it. Report it.
          </figcaption>
        </figure>
        </div>

        {/* ── Scale facts ── */}
        <ul style={{ listStyle:'none', maxWidth:1200, margin:'56px auto 0', padding:'28px 0 0', borderTop:'1px solid rgba(255,255,255,0.12)', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:24 }}>
          {[{v:'12M+',l:'Tonnes of waste generated in Ghana a year'},{v:'Act 490',l:'Ghana Environmental Sanitation Law'},{v:'<2 min',l:'Time to submit a report'},{v:'4 cities',l:'Active enforcement coverage'}].map(f=>(
            <li key={f.l}>
              <div style={{ ...TYPE.stat, color:'#fca5a5' }}>{f.v}</div>
              <div style={{ ...TYPE.small, color:TD.sageOnDark, maxWidth:200 }}>{f.l}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Steps ── */}
      <section id="how-to-report" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:40 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Step by step</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:0 }}>Report in under two minutes</h2>
          </div>
          <ol style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
            {REPORT_STEPS.map(s => (
              <li key={s.n} style={{ background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <span style={{ ...TYPE.small, fontWeight:700, color:RED, fontVariantNumeric:'tabular-nums' }}>{s.n}</span>
                  <i className={`fas ${s.icon}`} aria-hidden="true" style={{ color:RED, fontSize:18 }}></i>
                </div>
                <h3 style={{ ...TYPE.card, color:TD.ink, margin:'0 0 8px' }}>{s.title}</h3>
                <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{s.body}</p>
              </li>
            ))}
          </ol>
          <div style={{ marginTop:32 }}>
            <a href={HOUSEHOLD_APP_URL} style={BTN.primary}><i className="fas fa-camera" aria-hidden="true"></i> Report illegal dumping</a>
          </div>
        </div>
      </section>

      {/* ── What Happens After ── */}
      <section style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 32px' }}>What happens after you report</h2>
          <ol style={{ listStyle:'none', margin:0, padding:0, display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { step:'Immediately',     text:'Your report is logged with GPS coordinates, timestamped photos, and waste type classification. You earn reward points instantly.', color:'#15803d' },
              { step:'Within 1 hour',   text:'TrashDrop routes the report to the relevant Municipal District Assembly and environmental enforcement unit.', color:TD.forest },
              { step:'Within 24 hours', text:'A licensed cleanup team is dispatched to the site. The report is assigned a reference number for tracking.', color:TD.orangeText },
              { step:'Ongoing',         text:'You track cleanup progress directly in the TrashDrop app. Once the site is confirmed clean, your report is marked resolved.', color:'#1d4ed8' },
            ].map(r=>(
              <li key={r.step} style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:20, background:TD.cream, border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'20px 24px' }} className="td-idp-when">
                <span style={{ ...TYPE.small, fontWeight:700, color:r.color }}>{r.step}</span>
                <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{r.text}</p>
              </li>
            ))}
          </ol>
          <style>{`@media(max-width:560px){ .td-idp-when{grid-template-columns:1fr!important; gap:6px!important} }`}</style>
        </div>
      </section>

      {/* ── Ghana Law Box ── */}
      <section style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto', background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-panel)', padding:'36px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', gap:20 }}>
            <i className="fas fa-gavel" aria-hidden="true" style={{ color:RED, fontSize:24, marginTop:6, flexShrink:0 }}></i>
            <div style={{ minWidth:0 }}>
              <h2 style={{ ...TYPE.h3, color:TD.ink, margin:'0 0 12px' }}>Ghana's Environmental Sanitation Law</h2>
              <p style={{ ...TYPE.body, color:TD.sage, margin:'0 0 12px' }}>
                Under <strong style={{ color:TD.ink }}>Act 490 (Environmental Sanitation Policy)</strong>, illegal dumping is a fineable offence in Ghana. Environmental Health Officers attached to Municipal and Metropolitan District Assemblies are empowered to issue fines and prosecute offenders.
              </p>
              <p style={{ ...TYPE.body, color:TD.sage, margin:0 }}>
                Reporting through TrashDrop provides authorities with GPS-verified, photo-documented evidence — the fastest pathway to formal enforcement action in Accra, Kumasi, Takoradi or Tamale.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 auto 32px', maxWidth:780 }}>Frequently asked questions</h2>
          <FAQAccordion items={FAQ_ITEMS} surface="light" accentColor={RED} />
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default IllegalDumpingPublicPage;
