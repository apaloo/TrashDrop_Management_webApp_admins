import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need a smartphone to use the TrashDrop Carter App?",
      "acceptedAnswer": { "@type": "Answer", "text": "Any smartphone with a modern browser (Chrome, Firefox, or Safari) can run the TrashDrop Carter App at trashdrops.com. No app store installation is required. The app works offline — it caches your accepted requests, map tiles, and profile locally, queuing any actions you take without internet until your connection is restored." }
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
  { n:'01', icon:'fa-mobile-alt',    title:'Open Carter App',         body:'Visit trashdrops.com on any modern smartphone browser. No app store download required.' },
  { n:'02', icon:'fa-phone',         title:'Verify Phone Number',     body:'Enter your Ghana phone number (+233 format). Verify via SMS OTP. Your phone number is your login — no email needed.' },
  { n:'03', icon:'fa-id-card',       title:'Upload Ghana ID',         body:'Upload front and back photos of your Ghana Card, Passport, or Voters ID for identity verification.' },
  { n:'04', icon:'fa-truck',         title:'Add Vehicle Details',     body:'Enter your vehicle type, licence plate number, colour, and upload a vehicle photo.' },
  { n:'05', icon:'fa-clock',         title:'Submit for Approval',     body:'Submit your profile. Verification typically completes within 24 hours — you\'ll receive an SMS when approved.' },
  { n:'06', icon:'fa-money-bill-wave','title':'Start Earning',        body:'Browse pickup requests on the map, accept jobs near you, navigate, scan QR codes, and earn. Cash out to MoMo anytime.' },
];

const EARNINGS = [
  { label:'Core Collection Fee',       desc:'Base payment per completed pickup, set by request type and distance.',                 color:TD.lime  },
  { label:'Urgent Request Bonus',      desc:'Extra payment for accepting and completing high-priority urgent requests.',            color:TD.gold  },
  { label:'Surge Multiplier (up to 3×)', desc:'Earnings multiply up to 3× during high-demand periods — peak hours and weekends.', color:'#f97316' },
  { label:'Tips (100% yours)',          desc:'Any tip a user adds goes entirely to you — TrashDrop takes nothing from tips.',       color:'#22c55e' },
  { label:'Recyclables Revenue (60%)',  desc:'You keep 60% of the value of any recyclable materials in the waste you collect.',    color:'#3b82f6' },
  { label:'Authority Assignments',      desc:'Government and municipal contracts paying ₵50–₵500 per assignment.',                 color:'#a78bfa' },
];

const FAQ_ITEMS = [
  { q:'Do I need a smartphone to use the TrashDrop Carter App?', a:'Any smartphone with a modern browser (Chrome, Firefox, or Safari) can run the TrashDrop Carter App at trashdrops.com. No app store installation is required. The app works offline — it caches your accepted requests, map tiles, and profile locally, queuing any actions you take without internet until your connection is restored.' },
  { q:'How quickly will I receive payment after completing a pickup?', a:'Earnings are added to your available balance immediately after the waste disposal step is confirmed at an authorised disposal site. Funds are available for withdrawal immediately after disposal via MoMo payouts. The minimum withdrawal is ₵10 and the daily maximum is ₵5,000.' },
  { q:'What documents do I need to sign up as a collector?', a:'You need a valid Ghana ID (Ghana Card, Passport, or Voters ID — front and back photos), your vehicle details (type, licence plate number, colour, and a vehicle photo), and a company or organisation ID. Your phone number must be a valid Ghana number in +233 format, used as your login — no email required.' },
  { q:'What are authority assignments and how do I access them?', a:'Authority assignments are government and municipal cleanup contracts for illegal dump sites, construction debris, industrial waste, and public spaces. They pay ₵50–₵500 per assignment and are listed in the Assign tab of the Carter App. Unlike regular pickups, assignments are allocated directly to you — there is no competition with other collectors — and require a detailed completion report plus before-and-after photos.' },
  { q:'What types of waste can I collect on TrashDrop?', a:'You can collect recyclable waste (plastic, paper, metal, glass), general household waste, and hazardous materials. Hazardous waste pickups require users to select the special handling option when booking and carry a higher payout. Authority assignments may also include construction debris and industrial waste.' },
  { q:'Can I collect waste using a tricycle (aboboyaa)?', a:'Yes. Aboboyaa riders (tricycle operators) are the most common vehicle type on TrashDrop. When registering your vehicle, select the appropriate vehicle type. You will be matched to requests compatible with your vehicle\'s capacity.' },
];

const CollectorsPage = () => {
  useEffect(() => {
    document.title = 'Earn Money Collecting Waste in Ghana | TrashDrop Carter App';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', 'TrashDrop pays waste collectors in Ghana ₵32.43 average per pickup, paid to your MoMo wallet. Join as a carter or aboboyaa rider. No app download needed. Sign up at trashdrops.com.');
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id   = 'faq-schema-collectors';
    script.text = JSON.stringify(FAQ_SCHEMA);
    const existing = document.getElementById('faq-schema-collectors');
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => { const s = document.getElementById('faq-schema-collectors'); if(s) s.remove(); };
  }, []);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <section style={{ background:`linear-gradient(160deg,#0a2010 0%,#091509 50%,${TD.ink} 100%)`, padding:'140px 24px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.05, backgroundImage:`radial-gradient(${TD.lime} 1px,transparent 1px)`, backgroundSize:'36px 36px', pointerEvents:'none' }} />
        <div style={{ maxWidth:820, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 18px', marginBottom:24 }}>
            <i className="fas fa-truck" style={{ color:TD.lime, fontSize:11 }}></i>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Earn as a Carter</span>
          </div>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,64px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            How can I earn money collecting waste in Ghana?
          </h1>
          {/* ── AI ANSWER PARAGRAPH ── */}
          <p style={{ ...FF.body, fontSize:17, color:'rgba(255,255,255,0.72)', lineHeight:1.82, maxWidth:740, margin:'0 auto 40px' }}>
            TrashDrop is a free platform that pays waste collectors — known as carters or aboboyaa riders — in Ghana to complete household and business trash pickups, with earnings paid directly to MTN, Vodafone, or AirtelTigo mobile money wallets. To join, open the TrashDrop Carter App at trashdrops.com, verify your Ghana phone number via SMS OTP, upload your Ghana Card or Passport, add your vehicle details, and submit your profile for approval. Once approved, you browse pickup requests on a map, accept jobs near you, navigate to the location, scan the QR code to confirm collection, take three photos as evidence, and submit. The average earnings per pickup are ₵32.43, made up of a core collection fee, urgent request bonuses, 100% of customer tips, and 60% of recyclable material revenue. Collectors can cash out to MoMo at any time with a minimum withdrawal of ₵10 and a daily maximum of ₵5,000.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45` }}>
              Join as a Collector
            </Link>
            <a href="#earnings" style={{ ...FF.label, fontSize:14, fontWeight:700, background:'transparent', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', border:`1.5px solid rgba(255,255,255,0.18)` }}>
              See Earnings Breakdown
            </a>
          </div>
          {/* ── Stat bar ── */}
          <div style={{ display:'flex', gap:40, justifyContent:'center', flexWrap:'wrap', marginTop:56 }}>
            {[{v:'₵32.43', l:'Avg Per Pickup'},{v:'480+',l:'Active Collectors'},{v:'₵5,000',l:'Max Daily Cashout'},{v:'₵10',l:'Min Withdrawal'}].map(s => (
              <div key={s.l} style={{ textAlign:'center' }}>
                <div style={{ ...FF.data, fontSize:28, color:TD.lime, letterSpacing:'1px' }}>{s.v}</div>
                <div style={{ ...FF.label, fontSize:10, color:TD.sage, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How to Sign Up ── */}
      <section style={{ background:TD.ink2, padding:'96px 24px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>Getting Started</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'12px 0 0', letterSpacing:'-1px' }}>Six steps to your first pickup</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:20 }}>
            {SIGNUP_STEPS.map((s,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18, padding:'28px 24px', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:12, right:18, ...FF.data, fontSize:48, color:`${TD.lime}08` }}>{s.n}</div>
                <div style={{ width:44, height:44, borderRadius:12, background:`${TD.lime}15`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18 }}>
                  <i className={`fas ${s.icon}`} style={{ color:TD.lime, fontSize:17 }}></i>
                </div>
                <h3 style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#f0f5f0', marginBottom:8 }}>{s.title}</h3>
                <p style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.7, margin:0 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Earnings Breakdown ── */}
      <section id="earnings" style={{ background:`linear-gradient(160deg,#0d1a0d 0%,${TD.ink} 100%)`, padding:'96px 24px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:56 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>Earnings Formula</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'12px 0 12px', letterSpacing:'-1px' }}>Exactly how your pay is calculated</h2>
            <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.5)', maxWidth:560, margin:'0 auto' }}>Full-time collectors earn between <strong style={{ color:'#fff' }}>₵2,500 and ₵8,000 per month</strong> not counting surge bonuses and authority assignments.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
            {EARNINGS.map((e,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:`1px solid ${e.color}20`, borderRadius:16, padding:'24px 22px', display:'flex', alignItems:'flex-start', gap:16 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:e.color, flexShrink:0, marginTop:6 }} />
                <div>
                  <div style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#f0f5f0', marginBottom:6 }}>{e.label}</div>
                  <div style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.65 }}>{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:40, background:`${TD.lime}10`, border:`1px solid ${TD.lime}25`, borderRadius:16, padding:'28px 32px', display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
            <i className="fas fa-calculator" style={{ color:TD.lime, fontSize:28 }}></i>
            <div>
              <div style={{ ...FF.label, fontSize:13, fontWeight:700, color:TD.lime, marginBottom:4 }}>Example: 10 pickups/day × 5 days/week</div>
              <div style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.7)', lineHeight:1.7 }}>10 pickups × ₵32.43 avg × 20 working days = <strong style={{ color:'#fff' }}>₵6,486/month</strong> before bonuses, tips, and recyclables.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Requirements ── */}
      <section style={{ background:TD.ink2, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', letterSpacing:'-1px', margin:'0 0 40px' }}>What you need to join</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16 }}>
            {[
              { icon:'fa-id-card',    title:'Valid Ghana ID', body:'Ghana Card, Passport, or Voters ID — front and back photos required.' },
              { icon:'fa-phone',      title:'Ghana Phone Number', body:'+233 format. Used as your login. No email address required.' },
              { icon:'fa-truck',      title:'Vehicle Details', body:'Type, licence plate, colour, and a vehicle photo. Tricycles (aboboyaa) accepted.' },
              { icon:'fa-building',   title:'Company / Org ID', body:'Organisation or company ID to verify professional affiliation where applicable.' },
            ].map((r,i) => (
              <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'24px 20px' }}>
                <i className={`fas ${r.icon}`} style={{ color:TD.lime, fontSize:22, marginBottom:14, display:'block' }}></i>
                <div style={{ ...FF.label, fontSize:13, fontWeight:700, color:'#f0f5f0', marginBottom:8 }}>{r.title}</div>
                <div style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.65 }}>{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background:TD.ink, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase' }}>FAQ</span>
            <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,42px)', color:'#f0f5f0', margin:'12px 0 0', letterSpacing:'-0.5px' }}>Collector questions answered</h2>
          </div>
          <FAQAccordion items={FAQ_ITEMS} />
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ background:`linear-gradient(135deg,${TD.forestDk} 0%,${TD.ink} 100%)`, padding:'80px 24px', textAlign:'center' }}>
        <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'0 0 16px', letterSpacing:'-1px' }}>Start earning today</h2>
        <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.55)', margin:'0 auto 36px', maxWidth:480 }}>Join over 480 verified collectors across Ghana. Sign up takes less than 5 minutes.</p>
        
        {/* ── QR Code Placeholder ── */}
        <div style={{ margin:'0 auto 32px', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <div style={{ 
            width:200, 
            height:200, 
            background:'rgba(255,255,255,0.95)', 
            borderRadius:16, 
            display:'flex', 
            alignItems:'center', 
            justifyContent:'center',
            boxShadow:'0 12px 48px rgba(0,0,0,0.25)',
            border:`2px solid ${TD.lime}30`
          }}>
            <img 
              src="/images/TrashDrop Carter App QR code.jpeg" 
              alt="Scan to download TrashDrop Carter App" 
              style={{ width:180, height:180, borderRadius:8, objectFit:'cover' }}
            />
          </div>
          <div style={{ 
            ...FF.label, 
            fontSize:13, 
            fontWeight:700, 
            color:TD.lime, 
            letterSpacing:'2.5px', 
            textTransform:'uppercase' 
          }}>
            SCAN TO DOWNLOAD
          </div>
        </div>

        <Link to="/signup" style={{ ...FF.label, fontSize:15, fontWeight:700, background:TD.lime, color:TD.ink, padding:'16px 40px', borderRadius:12, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45`, display:'inline-block' }}>
          Join as a Collector →
        </Link>
      </section>
    </PublicPageLayout>
  );
};

export default CollectorsPage;
