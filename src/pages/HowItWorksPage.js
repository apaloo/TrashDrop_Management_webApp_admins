import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';

/* ─── FAQPage JSON-LD schema ────────────────────────────────────────────────── */
/* All questions here MUST be visible on the page — Google Rich Results requirement */
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "url": "https://trashdrops.com/how-it-works",
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
        "text": "The TrashDrop QR Bag System is a free prepaid waste collection service that uses QR-coded bags purchased from authorised vendors across Accra, Kumasi, Takoradi and Tamale. Each bag bundle carries a printed QR code. To activate it, open the TrashDrop app at trashdrops.com, tap the QR scanner, and scan the code — this registers the bags to your account and updates your inventory. Fill the bags with household or business waste, then open the app and tap Request Pickup to enjoy FREE PICKUPS. TrashDrop matches you with the nearest available verified collector, who travels to your location (visible on live GPS tracking), scans the same QR code on arrival to confirm authenticity and location, loads the waste, and transports it to an authorised disposal facility. You receive a completion notification and reward points credited to your account. The entire process from request to collection typically completes within 8 hours in urban Accra."
      }
    },
    {
      "@type": "Question",
      "name": "Do I need to download an app to use TrashDrop?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. TrashDrop is a Progressive Web App (PWA) — it runs entirely in your mobile or desktop browser at trashdrops.com. Open the URL, sign up with your email, and you are ready. No app store required."
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
  "@id": "https://trashdrops.com/how-it-works",
  "name": "How TrashDrop Works | Waste Collection App Ghana | trashdrops.com",
  "description": "TrashDrop connects Ghanaian households with verified waste collectors in 6 steps. Choose the QR Bag System for free pickups or the Digital Bin for on-demand collection. Available at trashdrops.com — no app download needed.",
  "url": "https://trashdrops.com/how-it-works",
  "inLanguage": "en-GH",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trashdrops.com" },
      { "@type": "ListItem", "position": 2, "name": "How It Works", "item": "https://trashdrops.com/how-it-works" }
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
  { n:'01', icon:'fa-user-plus',        title:'Sign Up',            body:'Create your free account at trashdrops.com using your email. No app store download required — it runs entirely in your browser.' },
  { n:'02', icon:'fa-map-marker-alt',   title:'Set Your Location',  body:'Enable GPS or enter your address manually. TrashDrop pinpoints your location for accurate collector matching.' },
  { n:'03', icon:'fa-qrcode',           title:'Choose Your Service', body:'Select the QR Bag System for free pickups with pre-purchased bags, or the Digital Bin for instant on-demand collection with a GPS-based quote.' },
  { n:'04', icon:'fa-check-circle',     title:'Collector Accepts',  body:'A verified, ID-checked collector in your area accepts your request within 2 hours. You see their live GPS position in real time.' },
  { n:'05', icon:'fa-truck',            title:'Collector Arrives',  body:'The collector travels to your location and scans the soft QR code on arrival to confirm authenticity and log the collection.' },
  { n:'06', icon:'fa-star',             title:'Earn & Confirm',     body:'Waste is transported to an authorised disposal site. You receive a completion notification plus reward points credited to your account.' },
];

const QR_STEPS = [
  { n:'01', icon:'fa-shopping-bag',   title:'Buy TrashDrop Bags',    body:'Purchase official bag bundles from authorised vendors across Accra, Kumasi, Takoradi and Tamale. Each bundle carries a printed QR code.' },
  { n:'02', icon:'fa-qrcode',         title:'Scan to Activate',      body:'Open the TrashDrop app at trashdrops.com, tap the QR scanner, and scan the code. This registers the bags to your account and updates your inventory.' },
  { n:'03', icon:'fa-trash-alt',      title:'Fill Your Bags',        body:'Fill the bags with household or business waste. Separate recyclables where possible to maximise your reward points.' },
  { n:'04', icon:'fa-hand-pointer',   title:'Request Free Pickup',   body:'Open the app and tap "Request Pickup." TrashDrop matches you with the nearest available verified collector instantly.' },
  { n:'05', icon:'fa-map-marked-alt', title:'Live GPS Tracking',     body:'Your collector travels to your location. Track them in real time on the map — visible directly in the app.' },
  { n:'06', icon:'fa-clipboard-check','title':'Collection Confirmed', body:'The collector scans the same QR code on arrival to confirm authenticity and location, loads the waste, and transports it to an authorised disposal facility.' },
];

const FAQ_ITEMS = [
  { q: 'Do I need to download an app to use TrashDrop?', a: 'No. TrashDrop is a Progressive Web App (PWA) — it runs entirely in your mobile or desktop browser at trashdrops.com. Open the URL, sign up with your email, and you are ready. No app store required.' },
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
    canonical.href = 'https://trashdrops.com/how-it-works';
    // Fix OG URL
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/how-it-works');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/how-it-works');

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
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 40%,${TD.ink} 100%)`, padding:'140px 24px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:`linear-gradient(${TD.lime} 1px,transparent 1px),linear-gradient(90deg,${TD.lime} 1px,transparent 1px)`, backgroundSize:'52px 52px', pointerEvents:'none' }} />
        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 16px', marginBottom:24 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:TD.lime, display:'inline-block' }} />
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>How It Works</span>
          </div>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,64px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            How does TrashDrop work?
          </h1>
          {/* ── AI ANSWER PARAGRAPH — first 100–150 words extracted by AI ── */}
          <p style={{ ...FF.body, fontSize:17, color:'rgba(255,255,255,0.72)', lineHeight:1.8, maxWidth:720, margin:'0 auto 40px', fontWeight:400 }}>
            TrashDrop is a Progressive Web App available at trashdrops.com that connects Ghanaian households and businesses with verified waste collectors in six simple steps. Users sign up with their email, set their location, and choose between the QR Bag System (purchase official TrashDrop bags, scan the QR code to activate them, then request a free pickup when ready) or the Digital Bin service (enter waste details, receive an instant GPS-location based quote, schedule collection — you only pay via MoMo or cash at the point of waste collection). A verified collector accepts the request within 2 hours, travels to the location with live GPS tracking visible to the user, arrives and scans a soft QR code to confirm collection, delivers waste to an authorised disposal site, and the user receives confirmation plus reward points. Collectors are paid directly to their mobile money wallet, earning an average of ₵32.43 per completed pickup.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45` }}>
              Get Started Free
            </Link>
            <a href="#qr" style={{ ...FF.label, fontSize:14, fontWeight:700, background:'transparent', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', border:`1.5px solid rgba(255,255,255,0.18)` }}>
              QR Bag System ↓
            </a>
          </div>
        </div>
      </section>

      {/* ── 6 Steps ──────────────────────────────────────────────────────── */}
      <section id="how" style={{ background:TD.ink2, padding:'96px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>The Process</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(30px,4vw,52px)', color:'#f0f5f0', margin:'12px 0 0', letterSpacing:'-1px' }}>Six steps from door to disposal</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24 }}>
            {STEPS.map((s,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, padding:'32px 28px', transition:'all 0.25s', position:'relative', overflow:'hidden' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}30`;e.currentTarget.style.background=`rgba(168,230,61,0.04)`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.background='rgba(255,255,255,0.03)';}}>
                <div style={{ position:'absolute', top:16, right:20, ...FF.data, fontSize:52, color:'rgba(168,230,61,0.07)', pointerEvents:'none' }}>{s.n}</div>
                <div style={{ width:48, height:48, borderRadius:14, background:`${TD.lime}15`, border:`1px solid ${TD.lime}25`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
                  <i className={`fas ${s.icon}`} style={{ color:TD.lime, fontSize:18 }}></i>
                </div>
                <h3 style={{ ...FF.label, fontSize:15, fontWeight:700, color:'#f0f5f0', marginBottom:10 }}>{s.title}</h3>
                <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.55)', lineHeight:1.7, margin:0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services Comparison ──────────────────────────────────────────── */}
      <section style={{ background:'#0c1a0c', padding:'80px 24px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <h2 style={{ ...FF.display, fontSize:'clamp(28px,3.5vw,46px)', color:'#f0f5f0', letterSpacing:'-1px', margin:0 }}>Two services. One platform.</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:24 }}>
            {[
              { title:'QR Bag System', badge:'FREE PICKUPS', icon:'fa-qrcode', color:TD.lime, features:['Buy official bags from authorised vendors','Scan QR code to register bags to your account','Fill bags with household or business waste','Request free pickup when bags are full','Track collector live on GPS','Earn reward points on every pickup'] },
              { title:'Digital Bin',   badge:'ON-DEMAND',   icon:'fa-mobile-alt', color:TD.gold, features:['Enter waste details and location','Receive instant GPS-based price quote','Schedule collection at your preferred time','Pay only at point of collection (MoMo or cash)','Matched with nearest verified collector','Real-time tracking and completion notification'] },
            ].map(svc => (
              <div key={svc.title} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${svc.color}20`, borderRadius:20, padding:'36px 32px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:`${svc.color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <i className={`fas ${svc.icon}`} style={{ color:svc.color, fontSize:20 }}></i>
                  </div>
                  <div>
                    <h3 style={{ ...FF.label, fontSize:16, fontWeight:700, color:'#f0f5f0', margin:0 }}>{svc.title}</h3>
                    <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'2px', color:svc.color }}>{svc.badge}</span>
                  </div>
                </div>
                {svc.features.map((f,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
                    <i className="fas fa-check" style={{ color:svc.color, fontSize:12, marginTop:4, flexShrink:0 }}></i>
                    <span style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.62)', lineHeight:1.6 }}>{f}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── QR Bag System deep-dive ──────────────────────────────────────── */}
      <section id="qr" style={{ background:TD.ink, padding:'96px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 16px', marginBottom:16 }}>
              <i className="fas fa-qrcode" style={{ color:TD.lime, fontSize:12 }}></i>
              <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>QR Bag System</span>
            </div>
            <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,50px)', color:'#f0f5f0', letterSpacing:'-1px', margin:'0 0 16px' }}>
              How does the TrashDrop QR bag system work?
            </h2>
            {/* ── AI ANSWER PARAGRAPH for #qr anchor ── */}
            <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.65)', lineHeight:1.8, maxWidth:740, margin:'0 auto' }}>
              The TrashDrop QR Bag System is a free prepaid waste collection service that uses QR-coded bags purchased from authorised vendors across Accra, Kumasi, Takoradi and Tamale. Each bag bundle carries a printed QR code. To activate it, open the TrashDrop app at trashdrops.com, tap the QR scanner, and scan the code — this registers the bags to your account and updates your inventory. Fill the bags with household or business waste, then open the app and tap "Request Pickup" to enjoy FREE PICKUPS. TrashDrop matches you with the nearest available verified collector, who travels to your location (visible on live GPS tracking), scans the same QR code on arrival to confirm authenticity and location, loads the waste, and transports it to an authorised disposal facility. You receive a completion notification and reward points credited to your account. The entire process from request to collection typically completes within 8 hours in urban Accra.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {QR_STEPS.map((s,i) => (
              <div key={i} style={{ background:`rgba(168,230,61,0.04)`, border:`1px solid ${TD.lime}18`, borderRadius:18, padding:'28px 24px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:`${TD.lime}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={`fas ${s.icon}`} style={{ color:TD.lime, fontSize:15 }}></i>
                  </div>
                  <span style={{ ...FF.data, fontSize:28, color:`${TD.lime}50` }}>{s.n}</span>
                </div>
                <h3 style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#f0f5f0', marginBottom:8 }}>{s.title}</h3>
                <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7, margin:0 }}>{s.body}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:56 }}>
            <Link to="/signup" style={{ ...FF.label, fontSize:15, fontWeight:700, background:TD.lime, color:TD.ink, padding:'16px 36px', borderRadius:12, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45`, display:'inline-block' }}>
              Get Started — It's Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section style={{ background:TD.ink2, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>FAQ</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,42px)', color:'#f0f5f0', margin:'12px 0 0', letterSpacing:'-0.5px' }}>Frequently asked questions</h2>
          </div>
          <FAQAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ background:`linear-gradient(135deg,${TD.forestDk} 0%,${TD.ink} 100%)`, padding:'80px 24px', textAlign:'center' }}>
        <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'0 0 16px', letterSpacing:'-1px' }}>Ready to clean up your community?</h2>
        <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.55)', margin:'0 auto 36px', maxWidth:520 }}>Join thousands of Ghanaian households using TrashDrop today. No download required.</p>
        <Link to="/signup" style={{ ...FF.label, fontSize:15, fontWeight:700, background:TD.lime, color:TD.ink, padding:'16px 40px', borderRadius:12, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45`, display:'inline-block' }}>
          Create Free Account
        </Link>
      </section>
    </PublicPageLayout>
  );
};

export default HowItWorksPage;
