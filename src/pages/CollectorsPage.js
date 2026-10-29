import React, { useEffect } from 'react';
import PublicPageLayout, { TD, FAQAccordion, SectionNav } from '../components/PublicPageLayout';
import { TYPE, BTN } from '../theme/brand';
import { COLLECTOR_APP_URL } from '../config/homepage';
import { BUSINESS } from '../utils/seo';

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need a smartphone to use the TrashDrop Carter App?",
      "acceptedAnswer": { "@type": "Answer", "text": "Any smartphone with a modern browser (Chrome, Firefox, or Safari) can run the TrashDrop Carter App at collector.trashdrops.com. No app store installation is required. The app works offline — it caches your accepted requests, map tiles, and profile locally, queuing any actions you take without internet until your connection is restored." }
    },
    {
      "@type": "Question",
      "name": "How quickly will I receive payment after completing a pickup?",
      "acceptedAnswer": { "@type": "Answer", "text": "Earnings are added to your available balance immediately after the waste disposal step is confirmed at an authorised disposal site. Funds are available for withdrawal immediately after disposal via MoMo payouts. The minimum withdrawal is ₵10 and the daily maximum is ₵5,000." }
    },
    {
      "@type": "Question",
      "name": "What documents do I need to sign up as a collector?",
      "acceptedAnswer": { "@type": "Answer", "text": "You need a valid Ghana ID (Ghana Card, Passport, or Voters ID — front and back photos), your vehicle details (type, licence plate number, colour, and a vehicle photo), and a company or organisation ID. Your phone number must be a valid Ghana number in +233 format, used as your login — no email required." }
    },
    {
      "@type": "Question",
      "name": "What are authority assignments and how do I access them?",
      "acceptedAnswer": { "@type": "Answer", "text": "Authority assignments are government and municipal cleanup contracts for illegal dump sites, construction debris, industrial waste, and public spaces. They pay ₵50–₵500 per assignment and are listed in the Assign tab of the Carter App. Unlike regular pickups, assignments are allocated directly to you — there is no competition with other collectors — and require a detailed completion report plus before-and-after photos." }
    },
    {
      "@type": "Question",
      "name": "How much can I earn collecting waste in Ghana with TrashDrop?",
      "acceptedAnswer": { "@type": "Answer", "text": "The average earnings per pickup are ₵32.43, made up of a core collection fee, urgent request bonuses, 100% of customer tips, and 60% of recyclable material revenue. A full-time collector completing 8–12 pickups per day, five days a week, can earn between ₵2,500 and ₵8,000 per month." }
    }
  ]
};

const SIGNUP_STEPS = [
  { n:'01', icon:'fa-mobile-alt',    title:'Open Carter App',         body:'Visit collector.trashdrops.com on any modern smartphone browser. No app store download required.' },
  { n:'02', icon:'fa-phone',         title:'Verify Phone Number',     body:'Enter your Ghana phone number (+233 format). Verify via SMS OTP. Your phone number is your login — no email needed.' },
  { n:'03', icon:'fa-id-card',       title:'Upload Ghana ID',         body:'Upload front and back photos of your Ghana Card, Passport, or Voters ID for identity verification.' },
  { n:'04', icon:'fa-truck',         title:'Add Vehicle Details',     body:'Enter your vehicle type, licence plate number, colour, and upload a vehicle photo.' },
  { n:'05', icon:'fa-clock',         title:'Submit for Approval',     body:'Submit your profile. Verification typically completes within 24 hours — you\'ll receive an SMS when approved.' },
  { n:'06', icon:'fa-money-bill-wave','title':'Start Earning',        body:'Browse pickup requests on the map and accept jobs near you. At each pickup, scan the QR code to confirm collection, take three photos as evidence and submit.' },
];

const EARNINGS = [
  { label:'Core Collection Fee',       desc:'Base payment per completed pickup, set by request type and distance.',                 color:TD.lime  },
  { label:'Urgent Request Bonus',      desc:'Extra payment for accepting and completing high-priority urgent requests.',            color:TD.orange  },
  { label:'Surge Multiplier (up to 3×)', desc:'Earnings multiply up to 3× during high-demand periods — peak hours and weekends.', color:'#f97316' },
  { label:'Tips (100% yours)',          desc:'Any tip a user adds goes entirely to you — TrashDrop takes nothing from tips.',       color:'#22c55e' },
  { label:'Recyclables Revenue (60%)',  desc:'You keep 60% of the value of any recyclable materials in the waste you collect.',    color:'#3b82f6' },
  { label:'Authority Assignments',      desc:'Government and municipal contracts paying ₵50–₵500 per assignment.',                 color:'#a78bfa' },
];

// The page's sections, for the links bar under the hero
const SECTIONS = [
  { id:'join',         label:'Join' },
  { id:'steps',        label:'Steps' },
  { id:'earnings',     label:'Pay' },
  { id:'requirements', label:'What you need' },
  { id:'faq',          label:'FAQ' },
];

const FAQ_ITEMS = [
  { q:'Do I need a smartphone to use the TrashDrop Carter App?', a:'Any smartphone with a modern browser (Chrome, Firefox, or Safari) can run the TrashDrop Carter App at collector.trashdrops.com. No app store installation is required. The app works offline — it caches your accepted requests, map tiles, and profile locally, queuing any actions you take without internet until your connection is restored.' },
  { q:'How quickly will I receive payment after completing a pickup?', a:'Earnings are added to your available balance immediately after the waste disposal step is confirmed at an authorised disposal site. Funds are available for withdrawal immediately after disposal via MoMo payouts. The minimum withdrawal is ₵10 and the daily maximum is ₵5,000.' },
  { q:'What documents do I need to sign up as a collector?', a:'You need a valid Ghana ID (Ghana Card, Passport, or Voters ID — front and back photos), your vehicle details (type, licence plate number, colour, and a vehicle photo), and a company or organisation ID. Your phone number must be a valid Ghana number in +233 format, used as your login — no email required.' },
  { q:'What are authority assignments and how do I access them?', a:'Authority assignments are government and municipal cleanup contracts for illegal dump sites, construction debris, industrial waste, and public spaces. They pay ₵50–₵500 per assignment and are listed in the Assign tab of the Carter App. Unlike regular pickups, assignments are allocated directly to you — there is no competition with other collectors — and require a detailed completion report plus before-and-after photos.' },
  { q:'What types of waste can I collect on TrashDrop?', a:'You can collect recyclable waste (plastic, paper, metal, glass), general household waste, and hazardous materials. Hazardous waste pickups require users to select the special handling option when booking and carry a higher payout. Authority assignments may also include construction debris and industrial waste.' },
  { q:'Can I collect waste using a tricycle (aboboyaa)?', a:'Yes. Aboboyaa riders (tricycle operators) are the most common vehicle type on TrashDrop. When registering your vehicle, select the appropriate vehicle type. You will be matched to requests compatible with your vehicle\'s capacity.' },
];

const WEBPAGE_SCHEMA_COLLECTORS = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://trashdrops.com/collectors/",
  "name": "Earn Money Collecting Waste in Ghana | TrashDrop Carter App",
  "description": "TrashDrop pays waste collectors in Ghana ₵32.43 average per pickup, paid to your MoMo wallet. Join as a carter or aboboyaa rider. No app download needed.",
  "url": "https://trashdrops.com/collectors/",
  "inLanguage": "en-GH",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home",       "item": "https://trashdrops.com" },
      { "@type": "ListItem", "position": 2, "name": "Collectors", "item": "https://trashdrops.com/collectors/" }
    ]
  },
  "publisher": { "@type": "Organization", "name": "Infobrix Limited", "url": "https://trashdrops.com", "logo": { "@type": "ImageObject", "url": "https://trashdrops.com/icon-512x512.png" } }
};

const CollectorsPage = () => {
  useEffect(() => {
    document.title = 'Earn Money Collecting Waste in Ghana | TrashDrop Carter App';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', 'TrashDrop pays waste collectors in Ghana ₵32.43 average per pickup, paid to your MoMo wallet. Join as a carter or aboboyaa rider. No app download needed. Sign up at trashdrops.com.');

    // Fix canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://trashdrops.com/collectors/';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/collectors/');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/collectors/');

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id   = 'faq-schema-collectors';
    script.text = JSON.stringify(FAQ_SCHEMA);
    const existing = document.getElementById('faq-schema-collectors');
    if (existing) existing.remove();
    document.head.appendChild(script);

    const wpScript = document.createElement('script');
    wpScript.type = 'application/ld+json';
    wpScript.id   = 'webpage-schema-collectors';
    wpScript.text = JSON.stringify(WEBPAGE_SCHEMA_COLLECTORS);
    const existingWp = document.getElementById('webpage-schema-collectors');
    if (existingWp) existingWp.remove();
    document.head.appendChild(wpScript);

    return () => {
      const s1 = document.getElementById('faq-schema-collectors'); if (s1) s1.remove();
      const s2 = document.getElementById('webpage-schema-collectors'); if (s2) s2.remove();
      const can = document.querySelector('link[rel="canonical"]'); if (can) can.href = 'https://trashdrops.com/';
      const ogU = document.querySelector('meta[property="og:url"]'); if (ogU) ogU.setAttribute('content', 'https://trashdrops.com/');
      const twU = document.querySelector('meta[name="twitter:url"]'); if (twU) twU.setAttribute('content', 'https://trashdrops.com/');
    };
  }, []);

  return (
    <PublicPageLayout>
      <style>{`
        @media(max-width:1000px){ .td-steps-poster{grid-template-columns:1fr!important} .td-steps-poster figure{position:static!important; max-width:440px; width:100%; margin:0 auto!important} }
        @media(max-width:820px){ .td-carter-flyer{grid-template-columns:1fr!important; gap:32px!important} .td-carter-flyer > img{max-width:420px; margin:0 auto} }
        @media(max-width:768px){ .td-carter-qr{display:none!important} }
        .td-carter-section { scroll-margin-top: 132px; }
      `}</style>
      {/* ── Hero ── */}
      <section data-surface="dark" style={{ background:TD.ink, padding:'calc(var(--td-header-h) + var(--td-section-y)) 24px var(--td-section-y)', position:'relative', overflow:'hidden' }}>
        {/* TrashDrop-branded tricycle behind a dark overlay so the text stays readable */}
        <div aria-hidden="true" style={{ position:'absolute', inset:0, backgroundImage:'url(/images/collectors/hero-tricycle.jpg)', backgroundSize:'cover', backgroundPosition:'center 40%', opacity:0.6 }} />
        <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, rgba(9,21,9,0.88) 0%, rgba(9,21,9,0.8) 45%, ${TD.ink} 100%)` }} />
        <div style={{ maxWidth:820, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <span style={{ ...TYPE.eyebrow, color:TD.lime, display:'block', marginBottom:16 }}>Earn as a carter</span>
          <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 20px' }}>
            How can I earn money collecting waste in Ghana?
          </h1>
          <p style={{ ...TYPE.lead, color:'rgba(255,255,255,0.9)', maxWidth:620, margin:'0 auto 32px' }}>
            Earn with your aboboyaa or tricycle. Accept pickups near you and get paid to MoMo — ₵32.43 a pickup on average.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <a href={COLLECTOR_APP_URL} style={BTN.primaryOnDark}>Join as a collector</a>
            <a href="#earnings" style={BTN.ghostOnDark}>How pay works</a>
          </div>
          {/* ── Stat bar ── */}
          <div style={{ display:'flex', gap:48, justifyContent:'center', flexWrap:'wrap', margin:'48px 0 0' }}>
            {[{v:'₵32.43', l:'Average per pickup'},{v:'480+',l:'Active collectors'}].map(s => (
              <div key={s.l} style={{ textAlign:'center' }}>
                <div style={{ ...TYPE.stat, color:TD.lime }}>{s.v}</div>
                <div style={{ ...TYPE.small, color:TD.sageOnDark }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionNav items={SECTIONS} />

      {/* ── Join flyer ── */}
      <section id="join" className="td-carter-section" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div className="td-carter-flyer" style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'minmax(0,420px) minmax(0,1fr)', gap:48, alignItems:'center' }}>
          <img src="/images/collectors/earn-flyer.jpg" alt="TrashDrop carter flyer: a rider on a TrashDrop tricycle. What you'll earn: steady pay, your tricycle, ID verified. Collector gets free GHC 250 worth of PPE. WhatsApp +233 20 933 8885."
            width="760" height="1048" loading="lazy" decoding="async"
            style={{ width:'100%', height:'auto', aspectRatio:'760 / 1048', borderRadius:'var(--td-radius-panel)', display:'block' }} />
          <div style={{ minWidth:0 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Join as a carter</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 16px' }}>Earn more on every pickup with your own tricycle</h2>
            <p style={{ ...TYPE.body, color:TD.sage, margin:'0 0 24px', maxWidth:520 }}>
              Bring your aboboyaa or tricycle. We send you pickup jobs near you and pay you to mobile money.
            </p>
            <ul style={{ listStyle:'none', padding:0, margin:'0 0 32px', display:'grid', gap:16 }}>
              {[['fa-hand-holding-usd','Steady pay','Jobs near you every day, paid straight to MoMo.'],
                ['fa-truck','Your tricycle','Use the vehicle you already ride.'],
                ['fa-id-card','ID verified','Every carter is checked, so households trust you at the door.']].map(([icon, t, d]) => (
                <li key={t} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                  <i className={`fas ${icon}`} style={{ color:TD.forest, fontSize:18, width:24, textAlign:'center', marginTop:3 }} aria-hidden="true"></i>
                  <span><strong style={{ ...TYPE.body, fontWeight:600, color:TD.ink, display:'block' }}>{t}</strong><span style={{ ...TYPE.small, color:TD.sage }}>{d}</span></span>
                </li>
              ))}
            </ul>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <a href={COLLECTOR_APP_URL} style={BTN.primary}>Join as a collector</a>
              <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer" style={BTN.tonal}>
                <i className="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp {BUSINESS.phoneDisplay}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── How to Sign Up ── */}
      <section id="steps" className="td-carter-section" style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:40 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Getting started</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:0 }}>Six steps to your first pickup</h2>
          </div>
          <div className="td-steps-poster" style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:32, alignItems:'start' }}>
            <ol style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:16 }}>
              {SIGNUP_STEPS.map(s => (
                <li key={s.n} style={{ background:TD.cream, border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'24px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                    <span style={{ ...TYPE.small, fontWeight:700, color:TD.forest, fontVariantNumeric:'tabular-nums' }}>{s.n}</span>
                    <i className={`fas ${s.icon}`} aria-hidden="true" style={{ color:TD.forest, fontSize:18 }}></i>
                  </div>
                  <h3 style={{ ...TYPE.card, color:TD.ink, margin:'0 0 8px' }}>{s.title}</h3>
                  <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{s.body}</p>
                </li>
              ))}
            </ol>
            {/* The TrashDrop network poster: every region, one network */}
            <figure style={{ margin:0, position:'sticky', top:140 }}>
              <img src="/images/collectors/trashdrop-network-poster.jpg" width="800" height="1132" loading="lazy" decoding="async"
                alt="TrashDrop poster: Ghana's on-demand waste collection network linking collectors in every region, from Accra and Kumasi to Takoradi and Tamale. One network. Every street. Zero waste."
                style={{ width:'100%', height:'auto', borderRadius:'var(--td-radius-card)', display:'block' }} />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Earnings Breakdown ── */}
      <section id="earnings" className="td-carter-section" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:40 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Earnings formula</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 12px' }}>Exactly how your pay is calculated</h2>
            <p style={{ ...TYPE.body, color:TD.sage, margin:0 }}>Full-time collectors earn between <strong style={{ color:TD.ink }}>₵2,500 and ₵8,000 per month</strong> not counting surge bonuses and authority assignments.</p>
          </div>
          <ul style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
            {EARNINGS.map(e => (
              <li key={e.label} style={{ background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'22px', display:'flex', alignItems:'flex-start', gap:14 }}>
                <span aria-hidden="true" style={{ width:10, height:10, borderRadius:'50%', background:e.color, flexShrink:0, marginTop:8 }} />
                <span>
                  <span style={{ ...TYPE.body, fontWeight:600, color:TD.ink, display:'block', marginBottom:4 }}>{e.label}</span>
                  <span style={{ ...TYPE.small, color:TD.sage }}>{e.desc}</span>
                </span>
              </li>
            ))}
          </ul>
          {[
            { icon:'fa-calculator', title:'Example: 10 pickups/day × 5 days/week', body:<>10 pickups × ₵32.43 avg × 20 working days = <strong style={{ color:TD.ink }}>₵6,486/month</strong> before bonuses, tips, and recyclables.</> },
            { icon:'fa-wallet', title:'Cash out to MoMo any time', body:<>Earnings reach your balance as soon as the disposal step is confirmed. Withdraw to MTN, Telecel or AirtelTigo mobile money: <strong style={{ color:TD.ink }}>minimum ₵10, up to ₵5,000 a day</strong>.</> },
          ].map(n => (
            <div key={n.title} style={{ marginTop:16, background:'#e6f2e9', borderRadius:'var(--td-radius-card)', padding:'24px 28px', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
              <i className={`fas ${n.icon}`} style={{ color:TD.forest, fontSize:24 }} aria-hidden="true"></i>
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ ...TYPE.body, fontWeight:600, color:TD.forest, marginBottom:4 }}>{n.title}</div>
                <div style={{ ...TYPE.small, color:TD.sage }}>{n.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Electric tricycles (partnership) ── */}
      <section style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:32 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Coming for TrashDrop carters</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 12px' }}>From manual lifting to electric bin-lifter tricycles</h2>
            <p style={{ ...TYPE.body, color:TD.sage, margin:0 }}>
              TrashDrop is working with a partner provider to help carters move to electric tricycles with automatic hydraulic bin lifters: less heavy lifting, safer work and faster pickups.
            </p>
          </div>
          <img src="/images/collectors/ev-bin-lifter.jpg" alt="Left: TrashDrop carters lifting a bin by hand onto a motor tricycle. Right: an electric TrashDrop tricycle with an automatic hydraulic bin lifter. Manual lifting, labour intensive; automated lifting, smarter, safer, faster."
            width="1600" height="900" loading="lazy" decoding="async"
            style={{ width:'100%', height:'auto', aspectRatio:'16 / 9', objectFit:'cover', borderRadius:'var(--td-radius-panel)', display:'block' }} />
        </div>
      </section>

      {/* ── Requirements ── */}
      <section id="requirements" className="td-carter-section" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 32px' }}>What you need to join</h2>
          <ul style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16 }}>
            {[
              { icon:'fa-id-card',    title:'Valid Ghana ID', body:'Ghana Card, Passport, or Voters ID — front and back photos required.' },
              { icon:'fa-phone',      title:'Ghana Phone Number', body:'+233 format. Used as your login. No email address required.' },
              { icon:'fa-truck',      title:'Vehicle Details', body:'Type, licence plate, colour, and a vehicle photo. Tricycles (aboboyaa) accepted.' },
              { icon:'fa-building',   title:'Company / Org ID', body:'Organisation or company ID to verify professional affiliation where applicable.' },
            ].map(r => (
              <li key={r.title} style={{ background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'22px' }}>
                <i className={`fas ${r.icon}`} aria-hidden="true" style={{ color:TD.forest, fontSize:20, marginBottom:12, display:'block' }}></i>
                <div style={{ ...TYPE.body, fontWeight:600, color:TD.ink, marginBottom:6 }}>{r.title}</div>
                <div style={{ ...TYPE.small, color:TD.sage }}>{r.body}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="td-carter-section" style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ maxWidth:780, margin:'0 auto 32px' }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>FAQ</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:0 }}>Collector questions answered</h2>
          </div>
          <FAQAccordion items={FAQ_ITEMS} surface="light" />
        </div>
      </section>

      {/* ── CTA ── */}
      <section data-surface="dark" style={{ background:TD.ink, padding:'var(--td-section-y) 24px', textAlign:'center' }}>
        <h2 style={{ ...TYPE.h2, color:'#f0f5f0', margin:'0 0 16px' }}>Start earning today</h2>
        <p style={{ ...TYPE.body, color:TD.sageOnDark, margin:'0 auto 32px', maxWidth:480 }}>Join over 480 verified collectors across Ghana. Sign up takes less than 5 minutes.</p>
        {/* ── Carter app QR code for a second screen; links to #download-app still land here ── */}
        <div id="download-app" data-scroll-align="center" style={{ margin:'0 auto', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div className="td-carter-qr" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <div style={{ background:'#fff', borderRadius:18, padding:10 }}>
              <img src="/images/TrashDrop Carter App QR code.jpeg" alt="Scan to open the TrashDrop Carter app"
                style={{ width:180, height:180, borderRadius:8, objectFit:'cover', display:'block' }} />
            </div>
            <span style={{ ...TYPE.eyebrow, color:TD.lime }}>Scan to open the Carter app</span>
          </div>
          <a href={COLLECTOR_APP_URL} style={BTN.primaryOnDark}>Open the Carter app</a>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default CollectorsPage;
