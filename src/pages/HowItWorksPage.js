import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FAQAccordion, SectionNav } from '../components/PublicPageLayout';
import { HouseholdPricing } from './HomePageNew';
import { TYPE, BTN } from '../theme/brand';
import { HOUSEHOLD_APP_URL } from '../config/homepage';
import { QrScanScreen } from '../components/landing/AppScreens';

/* ─── FAQPage JSON-LD schema ────────────────────────────────────────────────── */
/* All questions here MUST be visible on the page — Google Rich Results requirement */
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "url": "https://trashdrops.com/how-it-works/",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How does TrashDrop work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TrashDrop is a Progressive Web App available at trashdrops.com that connects Ghanaian households and businesses with verified waste collectors in six simple steps. Users sign up with their email, set their location, and choose between the QR Bag System (purchase official TrashDrop bags, scan the QR code to activate them, then request a free pickup when ready) or the Digital Bin service (enter waste details, receive an instant GPS-location based quote, schedule collection — you only pay via MoMo or cash at the point of waste collection). A verified collector accepts the request within 2 hours, travels to the location with live GPS tracking visible to the user, arrives and scans a soft QR code to confirm collection, delivers waste to an authorised disposal site, and the user receives confirmation plus reward points. Collectors are paid directly to their mobile money wallet, earning an average of ₵32.43 per completed pickup."
      }
    },
    {
      "@type": "Question",
      "name": "How does the TrashDrop QR bag system work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The TrashDrop QR Bag System is a free prepaid waste collection service that uses QR-coded bags purchased from authorised vendors across Accra, Kumasi, Takoradi and Tamale. Each bag bundle carries a printed QR code. To activate it, open the TrashDrop app at app.trashdrops.com, tap the QR scanner, and scan the code — this registers the bags to your account and updates your inventory. Fill the bags with household or business waste, then open the app and tap Request Pickup to enjoy FREE PICKUPS. TrashDrop matches you with the nearest available verified collector, who travels to your location (visible on live GPS tracking), scans the same QR code on arrival to confirm authenticity and location, loads the waste, and transports it to an authorised disposal facility. You receive a completion notification and reward points credited to your account. The entire process from request to collection typically completes within 8 hours in urban Accra."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need to download an app to use TrashDrop?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. TrashDrop is a Progressive Web App (PWA) — it runs entirely in your mobile or desktop browser at app.trashdrops.com. Open the URL, sign up with your email, and you are ready. No app store required."
      }
    },
    {
      "@type": "Question",
      "name": "How long does it take for a collector to arrive?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "A verified collector accepts requests within 2 hours. The full process — from request submission to completed collection — typically finishes within 8 hours in urban Accra. You can track the collector's live GPS position from the moment they accept."
      }
    },
    {
      "@type": "Question",
      "name": "What is the difference between the QR Bag System and the Digital Bin?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The QR Bag System uses pre-purchased official bags. Scan the QR code to register them, fill the bags, and request a FREE pickup when ready — no extra payment at collection. The Digital Bin is for on-demand pickup of any waste: enter the details, receive a GPS-based price quote instantly, and pay via MoMo or cash only at the point of collection."
      }
    },
    {
      "@type": "Question",
      "name": "What happens to my waste after it is collected?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TrashDrop collectors deliver waste only to authorised disposal sites holding valid environmental permits from the Ghana EPA. Recyclables go to licensed recycling facilities, organic waste goes to composting sites, and general waste goes to approved municipal landfills. No illegal dumping — every trip is tracked."
      }
    },
    {
      "@type": "Question",
      "name": "How do I earn reward points?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You earn reward points automatically when a pickup is completed, when you report illegal dumping sites, when you refer new users, and when you separate waste by type before collection. Points can be redeemed for discounts on future pickups or donated to community environmental projects."
      }
    }
  ]
};

/* ─── WebPage JSON-LD schema (BreadcrumbList + publisher for AI crawlability) ── */
const WEBPAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://trashdrops.com/how-it-works/",
  "name": "How TrashDrop Works | Waste Collection App Ghana | trashdrops.com",
  "description": "TrashDrop connects Ghanaian households with verified waste collectors in 6 steps. Choose the QR Bag System for free pickups or the Digital Bin for on-demand collection. Available at trashdrops.com — no app download needed.",
  "url": "https://trashdrops.com/how-it-works/",
  "inLanguage": "en-GH",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trashdrops.com" },
      { "@type": "ListItem", "position": 2, "name": "How It Works", "item": "https://trashdrops.com/how-it-works/" }
    ]
  },
  "publisher": {
    "@type": "Organization",
    "name": "Infobrix Limited",
    "url": "https://trashdrops.com",
    "logo": { "@type": "ImageObject", "url": "https://trashdrops.com/icon-512x512.png" }
  }
};

const STEPS = [
  { n:'01', icon:'fa-user-plus',        title:'Sign Up',            body:'Create your free account at app.trashdrops.com using your email. No app store download required — it runs entirely in your browser.' },
  { n:'02', icon:'fa-map-marker-alt',   title:'Set Your Location',  body:'Enable GPS or enter your address manually. TrashDrop pinpoints your location for accurate collector matching.' },
  { n:'03', icon:'fa-qrcode',           title:'Choose Your Service', body:'Select the QR Bag System for free pickups with pre-purchased bags, or the Digital Bin for instant on-demand collection with a GPS-based quote.' },
  { n:'04', icon:'fa-check-circle',     title:'Collector Accepts',  body:'A verified, ID-checked collector in your area accepts your request within 2 hours. You see their live GPS position in real time.' },
  { n:'05', icon:'fa-truck',            title:'Collector Arrives',  body:'The collector travels to your location and scans the soft QR code on arrival to confirm authenticity and log the collection.' },
  { n:'06', icon:'fa-star',             title:'Earn & Confirm',     body:'Waste is transported to an authorised disposal site. You receive a completion notification plus reward points credited to your account.' },
];


// The page's sections, for the links bar under the hero
const SECTIONS = [
  { id:'steps',    label:'Steps' },
  { id:'services', label:'Services' },
  { id:'pricing',  label:'Pricing' },
  { id:'qr',       label:'QR Bags' },
  { id:'faq',      label:'FAQ' },
];

const FAQ_ITEMS = [
  { q: 'Do I need to download an app to use TrashDrop?', a: 'No. TrashDrop is a Progressive Web App (PWA) — it runs entirely in your mobile or desktop browser at app.trashdrops.com. Open the URL, sign up with your email, and you are ready. No app store required.' },
  { q: 'How long does it take for a collector to arrive?', a: 'A verified collector accepts requests within 2 hours. The full process — from request submission to completed collection — typically finishes within 8 hours in urban Accra. You can track the collector\'s live GPS position from the moment they accept.' },
  { q: 'What is the difference between the QR Bag System and the Digital Bin?', a: 'The QR Bag System uses pre-purchased official bags. Scan the QR code to register them, fill the bags, and request a FREE pickup when ready — no extra payment at collection. The Digital Bin is for on-demand pickup of any waste: enter the details, receive a GPS-based price quote instantly, and pay via MoMo or cash only at the point of collection.' },
  { q: 'What happens to my waste after it is collected?', a: 'TrashDrop collectors deliver waste only to authorised disposal sites holding valid environmental permits from the Ghana EPA. Recyclables go to licensed recycling facilities, organic waste goes to composting sites, and general waste goes to approved municipal landfills. No illegal dumping — every trip is tracked.' },
  { q: 'How do I earn reward points?', a: 'You earn reward points automatically when a pickup is completed, when you report illegal dumping sites, when you refer new users, and when you separate waste by type before collection. Points can be redeemed for discounts on future pickups or donated to community environmental projects.' },
];

const HowItWorksPage = () => {
  useEffect(() => {
    document.title = 'How TrashDrop Works | Waste Collection App Ghana | trashdrops.com';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', 'TrashDrop connects Ghanaian households with verified waste collectors in 6 steps. Choose the QR Bag System for free pickups or the Digital Bin for on-demand collection. Available at trashdrops.com — no app download needed.');

    // Fix canonical URL for this page (index.html defaults to root)
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://trashdrops.com/how-it-works/';
    // Fix OG URL
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/how-it-works/');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/how-it-works/');

    // Inject FAQPage schema
    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.id   = 'faq-schema-how-it-works';
    faqScript.text = JSON.stringify(FAQ_SCHEMA);
    const existingFaq = document.getElementById('faq-schema-how-it-works');
    if (existingFaq) existingFaq.remove();
    document.head.appendChild(faqScript);

    // Inject WebPage schema
    const wpScript = document.createElement('script');
    wpScript.type = 'application/ld+json';
    wpScript.id   = 'webpage-schema-how-it-works';
    wpScript.text = JSON.stringify(WEBPAGE_SCHEMA);
    const existingWp = document.getElementById('webpage-schema-how-it-works');
    if (existingWp) existingWp.remove();
    document.head.appendChild(wpScript);

    return () => {
      const s1 = document.getElementById('faq-schema-how-it-works'); if (s1) s1.remove();
      const s2 = document.getElementById('webpage-schema-how-it-works'); if (s2) s2.remove();
      // Restore canonical and OG URL to root on unmount
      const can = document.querySelector('link[rel="canonical"]');
      if (can) can.href = 'https://trashdrops.com/';
      const ogU = document.querySelector('meta[property="og:url"]');
      if (ogU) ogU.setAttribute('content', 'https://trashdrops.com/');
      const twU = document.querySelector('meta[name="twitter:url"]');
      if (twU) twU.setAttribute('content', 'https://trashdrops.com/');
    };
  }, []);

  return (
    <PublicPageLayout>
      <style>{`
        @media(max-width:900px) {
          .td-hiw-hero { grid-template-columns:1fr!important; gap:40px!important; }
          .td-hiw-photos { height:440px!important; max-width:480px; width:100%; margin:0 auto; }
          .td-hiw-photos img { height:330px!important; }
        }
        .td-hiw-section { scroll-margin-top: 132px; }
      `}</style>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section data-surface="dark" style={{ background:TD.ink, padding:'calc(var(--td-header-h) + var(--td-section-y)) 24px var(--td-section-y)' }}>
        <div className="td-hiw-hero" style={{ maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'1.15fr 0.85fr', gap:56, alignItems:'center' }}>
          <div style={{ minWidth:0 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.lime, display:'block', marginBottom:16 }}>How it works</span>
            <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 24px' }}>
              Bin full? <em style={{ color:TD.lime }}>Request pickup.</em>
            </h1>
            <h2 style={{ ...TYPE.h3, color:'#f0f5f0', margin:'0 0 12px' }}>How does TrashDrop work?</h2>
            {/* ── AI ANSWER PARAGRAPH — first 100–150 words extracted by AI ── */}
            <p style={{ ...TYPE.body, color:TD.sageOnDark, maxWidth:620, margin:'0 0 32px' }}>
              TrashDrop is a Progressive Web App available at trashdrops.com that connects Ghanaian households and businesses with verified waste collectors in six simple steps. Users sign up with their email, set their location, and choose between the QR Bag System (purchase official TrashDrop bags, scan the QR code to activate them, then request a free pickup when ready) or the Digital Bin service (enter waste details, receive an instant GPS-location based quote, schedule collection — you only pay via MoMo or cash at the point of waste collection). A verified collector accepts the request within 2 hours, travels to the location with live GPS tracking visible to the user, arrives and scans a soft QR code to confirm collection, delivers waste to an authorised disposal site, and the user receives confirmation plus reward points. Collectors are paid directly to their mobile money wallet, earning an average of ₵32.43 per completed pickup.
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <Link to="/#book-app" style={BTN.primaryOnDark}>Book a pickup</Link>
              <a href="#qr" style={BTN.ghostOnDark}>How QR Bags work</a>
            </div>
          </div>
          {/* Bin full -> collector at the gate */}
          <div className="td-hiw-photos" style={{ position:'relative', height:560 }}>
            <figure style={{ position:'absolute', top:0, left:0, width:'64%', margin:0 }}>
              <img src="/images/how-it-works/bin-full.jpg" width="608" height="1080" alt="An overflowing household wheelie bin with rubbish piled beside it"
                style={{ width:'100%', height:420, objectFit:'cover', borderRadius:'var(--td-radius-panel)', display:'block' }} />
              <figcaption style={{ position:'absolute', top:16, left:16, ...TYPE.small, fontWeight:600, color:'#fff', background:'rgba(10,15,10,0.78)', padding:'6px 14px', borderRadius:999 }}>Bin full?</figcaption>
            </figure>
            <figure style={{ position:'absolute', bottom:0, right:0, width:'58%', margin:0 }}>
              <img src="/images/how-it-works/pickup-at-gate.jpg" width="720" height="1073" alt="A TrashDrop collector in a hi-vis vest meets a resident at his gate to collect bagged waste"
                style={{ width:'100%', height:380, objectFit:'cover', objectPosition:'center top', borderRadius:'var(--td-radius-panel)', border:`3px solid ${TD.ink}`, display:'block' }} />
              <figcaption style={{ position:'absolute', bottom:16, left:16, ...TYPE.small, fontWeight:600, color:TD.ink, background:TD.lime, padding:'6px 14px', borderRadius:999 }}>Request pickup.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <SectionNav items={SECTIONS} />

      {/* ── The steps, once ─────────────────────────────────────────────── */}
      <section id="steps" className="td-hiw-section" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:48 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>The process</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:0 }}>Six steps from door to disposal</h2>
          </div>
          <ol style={{ listStyle:'none', margin:0, padding:0, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
            {STEPS.map(s => (
              <li key={s.n} style={{ background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <span style={{ ...TYPE.small, fontWeight:700, color:TD.forest, fontVariantNumeric:'tabular-nums' }}>{s.n}</span>
                  <i className={`fas ${s.icon}`} aria-hidden="true" style={{ color:TD.forest, fontSize:18 }}></i>
                </div>
                <h3 style={{ ...TYPE.card, color:TD.ink, margin:'0 0 8px' }}>{s.title}</h3>
                <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Services Comparison ──────────────────────────────────────────── */}
      {/* The menu's "Two ways to drop your waste" opens here (/how-it-works/#services) */}
      <section id="services" className="td-hiw-section" style={{ background:TD.cream, padding:'0 24px var(--td-section-y)' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ maxWidth:720, marginBottom:40 }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>Services</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:0 }}>Two services. One platform.</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
            {[
              { title:'QR Bag System', badge:'Free pickups', icon:'fa-qrcode', color:TD.forest, features:['Buy official bags from authorised vendors','Scan QR code to register bags to your account','Fill bags with household or business waste','Request free pickup when bags are full','Track collector live on GPS','Earn reward points on every pickup'] },
              { title:'Digital Bin',   badge:'On demand',   icon:'fa-mobile-alt', color:TD.orangeText, features:['Enter waste details and location','Receive instant GPS-based price quote','Schedule collection at your preferred time','Pay only at point of collection (MoMo or cash)','Matched with nearest verified collector','Real-time tracking and completion notification'] },
            ].map(svc => (
              <div key={svc.title} style={{ background:'#fff', border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'28px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                  <i className={`fas ${svc.icon}`} aria-hidden="true" style={{ color:svc.color, fontSize:22, width:28, textAlign:'center' }}></i>
                  <div>
                    <h3 style={{ ...TYPE.card, color:TD.ink, margin:0 }}>{svc.title}</h3>
                    <span style={{ ...TYPE.eyebrow, color:svc.color }}>{svc.badge}</span>
                  </div>
                </div>
                <ul style={{ listStyle:'none', margin:0, padding:0, display:'grid', gap:10 }}>
                  {svc.features.map(f => (
                    <li key={f} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <i className="fas fa-check" aria-hidden="true" style={{ color:svc.color, fontSize:13, marginTop:5, flexShrink:0 }}></i>
                      <span style={{ ...TYPE.small, color:TD.sage }}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bag pricing (shared with the homepage design) ─────────────────── */}
      <HouseholdPricing />

      {/* ── QR Bag System, in a paragraph ────────────────────────────────── */}
      <section id="qr" className="td-hiw-section" style={{ background:TD.cream, padding:'var(--td-section-y) 24px' }}>
        <div className="td-with-phone" style={{ maxWidth:1100, margin:'0 auto' }}>
        <div>
          <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>QR Bag System</span>
          <h2 style={{ ...TYPE.h2, color:TD.ink, margin:'0 0 16px' }}>
            How does the TrashDrop QR bag system work?
          </h2>
          {/* ── AI ANSWER PARAGRAPH for #qr anchor ── */}
          <p style={{ ...TYPE.body, color:TD.sage, margin:'0 0 32px' }}>
            The TrashDrop QR Bag System is a free prepaid waste collection service that uses QR-coded bags purchased from authorised vendors across Accra, Kumasi, Takoradi and Tamale. Each bag bundle carries a printed QR code. To activate it, open the TrashDrop app at app.trashdrops.com, tap the QR scanner, and scan the code — this registers the bags to your account and updates your inventory. Fill the bags with household or business waste, then open the app and tap "Request Pickup" to enjoy FREE PICKUPS. TrashDrop matches you with the nearest available verified collector, who travels to your location (visible on live GPS tracking), scans the same QR code on arrival to confirm authenticity and location, loads the waste, and transports it to an authorised disposal facility. You receive a completion notification and reward points credited to your account. The entire process from request to collection typically completes within 8 hours in urban Accra.
          </p>
          <Link to="/#book-app" style={BTN.primary}>Book a pickup</Link>
        </div>
        <QrScanScreen />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section id="faq" className="td-hiw-section" style={{ background:'#fff', padding:'var(--td-section-y) 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ maxWidth:780, margin:'0 auto 32px' }}>
            <span style={{ ...TYPE.eyebrow, color:TD.sage, display:'block', marginBottom:12 }}>FAQ</span>
            <h2 style={{ ...TYPE.h2, color:TD.ink, margin:0 }}>Frequently asked questions</h2>
          </div>
          <FAQAccordion items={FAQ_ITEMS} surface="light" />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section data-surface="dark" style={{ background:TD.ink, padding:'var(--td-section-y) 24px', textAlign:'center' }}>
        <h2 style={{ ...TYPE.h2, color:'#f0f5f0', margin:'0 0 16px' }}>Ready to clean up your community?</h2>
        <p style={{ ...TYPE.body, color:TD.sageOnDark, margin:'0 auto 32px', maxWidth:520 }}>Join thousands of Ghanaian households using TrashDrop today. Scan the code to get the app.</p>
        {/* Household app QR code: the page's buttons used to scroll here; links to it still land here */}
        <div id="download-app" data-scroll-align="center" className="td-hiw-qr" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, margin:'0 auto 32px' }}>
          <div style={{ background:'#fff', borderRadius:18, padding:12 }}>
            <img src="/images/how-it-works/household-app-qr.png" width="640" height="640" alt="QR code: scan to download the TrashDrop app"
              style={{ width:200, height:200, display:'block', borderRadius:10 }} />
          </div>
          <span style={{ ...TYPE.eyebrow, color:TD.lime }}>Scan to download</span>
        </div>
        <a href={HOUSEHOLD_APP_URL} style={BTN.primaryOnDark}>Open the TrashDrop app</a>
      </section>
    </PublicPageLayout>
  );
};

export default HowItWorksPage;
