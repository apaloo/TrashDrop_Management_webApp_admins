import React, { useEffect } from 'react';
import PublicPageLayout, { TD, FAQAccordion } from '../components/PublicPageLayout';
import { TYPE, BTN } from '../theme/brand';
import { HOUSEHOLD_APP_URL } from '../config/homepage';
import { ReportScreen } from '../components/landing/AppScreens';

// The page's accent: the error red, readable on white (6.5:1)
const RED = '#b91c1c';

const REPORT_STEPS = [
  { n:'01', icon:'fa-mobile-alt',        title:'Open the App',            body:'Go to app.trashdrops.com on any smartphone. No download required. Sign in or continue anonymously.' },
  { n:'02', icon:'fa-exclamation-triangle','title':'Tap "Report Illegal Dumping"', body:'Find the report button on the home screen or in the main menu — visible without a full account.' },
  { n:'03', icon:'fa-camera',            title:'Photograph the Site',     body:'Take a minimum of one clear photo of the dump site. Multiple photos increase response priority.' },
  { n:'04', icon:'fa-map-marker-alt',    title:'Allow GPS Location',      body:'The app captures your GPS coordinates automatically to pinpoint the exact location of the dump site.' },
  { n:'05', icon:'fa-paper-plane',       title:'Submit the Report',       body:'Tap submit. Your report is logged with timestamp, coordinates, and photos for official use.' },
  { n:'06', icon:'fa-star',             title:'Earn Points & Track',      body:'Once our team verifies your report, you earn points for airtime or data. Track the cleanup status in the app.' },
];

const FAQ_ITEMS = [
  { q:'Is illegal dumping a crime in Ghana?', a:"Yes. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence. Offenders can face fines and prosecution by Environmental Health Officers. Reporting through TrashDrop is the fastest way to trigger formal enforcement action by the relevant Municipal or Metropolitan District Assembly." },
  { q:'What happens after I report?', a:'TrashDrop notifies the relevant municipal authority and dispatches licensed cleanup crews. You can track the cleanup status directly in the app. The report includes GPS coordinates, timestamped photos, and waste type data which municipal environmental health officers can use directly.' },
  { q:'Do I earn anything for reporting?', a:"Yes. Every report you send from your TrashDrop account earns points once our team has verified it: 10 points for a small dump, 15 for a medium one and 20 for a large or hazardous one. Swap your points for airtime or data in the app's Rewards: 200 points = GH₵1, with airtime and data bundles worth GH₵5, GH₵10 or GH₵20." },
  { q:'What can I get with my points?', a:"Mobile airtime or a data bundle on MTN, Telecel or AirtelTigo, worth GH₵5 (1,000 points), GH₵10 (2,000 points) or GH₵20 (4,000 points). Open Rewards in the app, choose one, and enter your phone number and network. The TrashDrop team sends it to that number, and the app shows it as Sent." },
  { q:'Why do I only get points once my report is verified?', a:"Points are worth real airtime and data, so our team checks each report first, from its photo and location. Verified reports earn their points automatically; you can see each report's status, and its points, under Activity in the app." },
  { q:'What is a trash walk?', a:"A walk around your neighbourhood where you report every illegal dump you pass. It's good for your health, it puts each site on the map for cleanup crews, and every verified report earns you points. Go alone, with friends, or as a community group." },
  { q:'Can I report anonymously?', a:"Yes. TrashDrop supports anonymous reporting. Your identity is not shared with the municipal authority or the public. You can optionally include your contact details for follow-up communication if you'd like to receive updates." },
  { q:'Which cities can I report in?', a:'You can report illegal dumping anywhere in Ghana where TrashDrop operates — currently Accra, Kumasi, Takoradi, and Tamale. GPS coordinates are captured regardless of location, and reports are routed to the nearest municipal authority.' },
  { q:'What counts as illegal dumping?', a:"Illegal dumping includes disposing of any waste — household rubbish, construction debris, industrial waste, e-waste, or hazardous materials — in any location not designated as an authorised disposal or recycling facility. Common sites in Ghana include roadsides, drainage channels, beaches, farmland, and vacant plots." },
];

// Google's FAQ rich results: the same questions and answers as on the page
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { q:'How do I report illegal dumping in Ghana?', a:"Open the TrashDrop app at app.trashdrops.com, tap 'Report Illegal Dumping,' photograph the dump site (minimum one clear photo), allow the app to capture your GPS coordinates to pinpoint the location, and submit the report. Once our team verifies it, you earn points you can swap for mobile airtime or data." },
    ...FAQ_ITEMS,
  ].map(({ q, a }) => ({ "@type": "Question", "name": q, "acceptedAnswer": { "@type": "Answer", "text": a } })),
};

// Points per verified report, and what they buy (household app: 200 points = GH₵1)
const REWARD_CARDS = [
  { icon:'fa-camera', title:'Earn', body:'10 points for a small dump, 15 for a medium one and 20 for a large or hazardous one, once our team has verified your report.' },
  { icon:'fa-exchange-alt', title:'Swap', body:'200 points = GH₵1. Choose airtime or a data bundle worth GH₵5, GH₵10 or GH₵20 (1,000, 2,000 or 4,000 points).' },
  { icon:'fa-mobile-alt', title:'Receive', body:'Open Rewards in the app, pick your reward and enter your number and network (MTN, Telecel or AirtelTigo). We send it to your phone.' },
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
            Illegal dumping — the disposal of waste in unauthorised locations — can be reported quickly and easily through the TrashDrop app at app.trashdrops.com. Open the app, tap "Report Illegal Dumping," photograph the dump site (minimum one clear photo), allow the app to capture your GPS coordinates to pinpoint the location, and submit the report. Once our team verifies your report, you earn points you can swap for mobile airtime or data. TrashDrop notifies the relevant municipal authority and dispatches licensed cleanup crews, and you can track the cleanup status directly in the app. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence — reporting through TrashDrop is the fastest way to trigger enforcement action in Accra, Kumasi, Takoradi or Tamale.
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
          <div className="td-with-phone">
          <ol style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap:16 }}>
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
          <ReportScreen />
          </div>
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
              { step:'Immediately',     text:'Your report is logged with GPS coordinates, timestamped photos, and waste type classification. Our team checks it, and once it is verified your points are added.', color:'#15803d' },
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

      {/* ── Rewards ── */}
      <section id="rewards" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:40 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Rewards</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 12px' }}>Get rewarded for every verified report</h2>
            <p style={{ ...TYPE.body, color:TD.sage, margin:0 }}>Report from your TrashDrop account and your points add up. Swap them for airtime or data whenever you have enough.</p>
          </div>
          <ol style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(260px,100%),1fr))', gap:16 }}>
            {REWARD_CARDS.map(c => (
              <li key={c.title} style={{ background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'24px' }}>
                <i className={`fas ${c.icon}`} aria-hidden="true" style={{ color:TD.forest, fontSize:20, marginBottom:14, display:'block' }}></i>
                <h3 style={{ ...TYPE.card, color:TD.ink, margin:'0 0 8px' }}>{c.title}</h3>
                <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{c.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Trashwalk ── */}
      <section id="trashwalk" style={{ background:TD.lime, padding:'var(--td-section-y) 24px' }}>
        <style>{`@media(max-width:800px){ .td-idp-walk{grid-template-columns:1fr!important; gap:28px!important} .td-idp-walk img{max-width:420px; margin:0 auto} }`}</style>
        <div className="td-idp-walk" style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'0.8fr 1.2fr', alignItems:'center', gap:48 }}>
          <img src="/images/partners/trashwalk.jpg" width="720" height="770" loading="lazy" decoding="async"
            alt="A resident on a trash walk holds up the TrashDrop app, with map pins over dump sites along the street"
            style={{ width:'100%', height:'auto', aspectRatio:'720 / 770', objectFit:'cover', borderRadius:'var(--td-radius-panel)', border:`3px solid ${TD.ink}`, display:'block' }} />
          <div style={{ minWidth:0 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.forestDk, display:'block', marginBottom:12 }}>Trashwalk</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 16px' }}>Turn your walk into a cleaner street</h2>
            <p style={{ ...TYPE.lead, fontWeight:600, color:TD.ink, margin:'0 0 16px' }}>Trash walk is a health walk: one photo, cleaner community.</p>
            <p style={{ ...TYPE.body, color:TD.ink, margin:'0 0 16px' }}>
              Walk your neighbourhood and report every dump you pass. Each report puts the site on the map for cleanup crews, and every verified report earns you points.
            </p>
            <p style={{ ...TYPE.body, color:TD.ink, margin:'0 0 28px' }}>
              <strong>For example:</strong> report four sites on a morning walk and earn up to 80 points once they are verified. Keep walking and reporting, and you'll get your first GH₵5 airtime.
            </p>
            <a href={HOUSEHOLD_APP_URL} style={{ display:'inline-flex', alignItems:'center', gap:8, background:TD.ink, color:TD.lime, fontWeight:700, padding:'14px 24px', borderRadius:10, textDecoration:'none' }}>
              <i className="fas fa-walking" aria-hidden="true"></i> Start a trash walk
            </a>
          </div>
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
