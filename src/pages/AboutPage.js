import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF } from '../components/PublicPageLayout';

const TEAM = [
  { name:'Otis Apaloo',  role:'Operations Lead & Co-founder',  initial:'OA' },
  { name:'Simone Fuga',  role:'CEO & Co-founder',              initial:'SF' },
  { name:'Xose Ahlijah', role:'CTO & Co-founder',              initial:'XA' },
];

const STATS = [
  { v:'3,400+',  l:'Monthly Pickup Requests' },
  { v:'98%+',    l:'Pickup Completion Rate'  },
  { v:'55 T',    l:'Waste Diverted Monthly'  },
  { v:'₵32.43',  l:'Avg Earnings Per Pickup' },
  { v:'480+',    l:'Verified Collectors'      },
  { v:'4 Cities',l:'Active Coverage'          },
];

const MILESTONES = [
  { year:'2021', text:'TrashDrop founded by Infobrix Limited in Accra, Ghana.' },
  { year:'2022', text:'QR Bag System launched. First 50 collectors onboarded in Greater Accra.' },
  { year:'2023', text:'Digital Bin on-demand service launched. Expansion to Kumasi.' },
  { year:'2024', text:'Illegal dumping report tool launched. 200+ active collectors. Integration with municipal waste authorities.' },
  { year:'2025', text:'Expansion to Takoradi and Tamale. 55 tonnes of waste diverted monthly. Series A fundraising commenced.' },
  { year:'2026', text:'480+ verified collectors. 3,400+ monthly pickups. Planned expansion to Lagos and Abidjan.' },
];

const AboutPage = () => {
  useEffect(() => {
    document.title = 'About TrashDrop | Ghana\'s Leading Waste Management Platform';
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', "TrashDrop is Ghana's leading mobile waste management platform by Infobrix Limited. Co-founded by Otis Apaloo, Simone Fuga and Xose Ahlijah. 480+ collectors, 3,400+ monthly pickups, 55 tonnes diverted monthly. Raising Series A.");
  }, []);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0a1510 40%,${TD.ink} 100%)`, padding:'140px 24px 80px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:`linear-gradient(${TD.lime} 1px,transparent 1px),linear-gradient(90deg,${TD.lime} 1px,transparent 1px)`, backgroundSize:'60px 60px', pointerEvents:'none' }} />
        <div style={{ maxWidth:820, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 18px', marginBottom:24 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:TD.lime, display:'inline-block' }} />
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>About TrashDrop</span>
          </div>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,64px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            What is TrashDrop?
          </h1>
          {/* ── AI ANSWER PARAGRAPH ── */}
          <p style={{ ...FF.body, fontSize:17, color:'rgba(255,255,255,0.72)', lineHeight:1.82, maxWidth:740, margin:'0 auto 40px' }}>
            TrashDrop is Ghana's leading mobile waste management platform, by Infobrix Limited. The product was co-founded by Otis Apaloo (Operations Lead &amp; Co-founder), Simone Fuga (CEO &amp; Co-founder), Xose Ahlijah (CTO &amp; Co-founder). TrashDrop operates a Progressive Web App — accessible at trashdrops.com with no app store download required — that connects households and businesses in Accra, Kumasi, Takoradi and Tamale with a network of over 480 ID-verified waste collectors. The platform processes more than 3,400 pickup requests monthly, has achieved a 98%+ completion rate, and diverts over 55 tonnes of waste from Ghanaian landfills every month. Collectors earn an average of ₵32.43 per completed pickup, paid directly to their mobile money wallet. TrashDrop is raising a Series A round to expand across Ghana and into Lagos and Abidjan.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/signup" style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 28px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45` }}>
              Get Started Free
            </Link>
            <a href="mailto:hello@trashdrops.com" style={{ ...FF.label, fontSize:14, fontWeight:700, background:'transparent', color:'#fff', padding:'14px 28px', borderRadius:10, textDecoration:'none', border:`1.5px solid rgba(255,255,255,0.18)` }}>
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background:'#0c1a0c', padding:'64px 24px', borderBottom:`1px solid rgba(168,230,61,0.08)` }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:32, textAlign:'center' }}>
          {STATS.map(s => (
            <div key={s.l}>
              <div style={{ ...FF.data, fontSize:34, color:TD.lime, letterSpacing:'1px' }}>{s.v}</div>
              <div style={{ ...FF.label, fontSize:10, color:TD.sage, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', marginTop:4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mission ── */}
      <section style={{ background:TD.ink2, padding:'96px 24px' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:48, alignItems:'center' }}>
            <div>
              <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase', display:'block', marginBottom:16 }}>Our Mission</span>
              <h2 style={{ ...FF.display, fontSize:'clamp(28px,4vw,48px)', color:'#f0f5f0', margin:'0 0 20px', letterSpacing:'-1px' }}>Eliminate waste dumping from Ghanaian communities</h2>
              <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.62)', lineHeight:1.8, margin:'0 0 16px' }}>
                Ghana generates over 12 million tonnes of solid waste annually, with less than 60% collected in urban areas. Uncollected waste ends up in illegal dump sites, drainage channels, and waterways — contaminating drinking water and spreading disease.
              </p>
              <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.62)', lineHeight:1.8, margin:0 }}>
                TrashDrop's approach is simple: make waste collection easier to request than illegal dumping. By connecting households directly with verified collectors, providing real-time GPS tracking, and rewarding good behaviour with points, we change the economics of waste disposal in Ghana.
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              {[
                { icon:'fa-check-circle', title:'Verified Collectors',   body:'Every collector is ID-checked, vehicle-verified, and operationally licenced before they join the platform.' },
                { icon:'fa-map-marked-alt',title:'Authorised Disposal',  body:'Waste is delivered only to sites with valid Ghana EPA environmental permits. No illegal dumping in the chain.' },
                { icon:'fa-star',          title:'Reward-Based System',  body:'Users earn points for pickups and dumping reports. Collectors earn bonuses and recycling revenue shares.' },
              ].map((p,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'20px 22px' }}>
                  <i className={`fas ${p.icon}`} style={{ color:TD.lime, fontSize:18, marginTop:2, flexShrink:0 }}></i>
                  <div>
                    <div style={{ ...FF.label, fontSize:13, fontWeight:700, color:'#f0f5f0', marginBottom:6 }}>{p.title}</div>
                    <div style={{ ...FF.body, fontSize:13, color:'rgba(255,255,255,0.52)', lineHeight:1.65 }}>{p.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section style={{ background:TD.ink, padding:'80px 24px' }}>
        <div style={{ maxWidth:860, margin:'0 auto', textAlign:'center' }}>
          <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'3px', color:TD.sage, textTransform:'uppercase', display:'block', marginBottom:16 }}>The Team</span>
          <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', margin:'0 0 48px', letterSpacing:'-1px' }}>Founded by Infobrix Limited</h2>
          <div style={{ display:'flex', gap:24, justifyContent:'center', flexWrap:'wrap' }}>
            {TEAM.map(t => (
              <div key={t.name} style={{ background:'rgba(255,255,255,0.04)', border:`1px solid ${TD.lime}18`, borderRadius:20, padding:'32px 28px', minWidth:220, textAlign:'center' }}>
                <div style={{ width:64, height:64, borderRadius:'50%', background:`linear-gradient(135deg,${TD.forestDk},${TD.lime}40)`, border:`2px solid ${TD.lime}30`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', ...FF.label, fontSize:18, fontWeight:800, color:'#f0f5f0' }}>
                  {t.initial}
                </div>
                <div style={{ ...FF.label, fontSize:15, fontWeight:700, color:'#f0f5f0', marginBottom:6 }}>{t.name}</div>
                <div style={{ ...FF.body, fontSize:13, color:TD.sage, lineHeight:1.5 }}>{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section style={{ background:TD.ink2, padding:'80px 24px' }}>
        <div style={{ maxWidth:760, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', margin:0, letterSpacing:'-1px' }}>Our journey</h2>
          </div>
          <div style={{ position:'relative', paddingLeft:40 }}>
            <div style={{ position:'absolute', left:12, top:0, bottom:0, width:2, background:`linear-gradient(to bottom,${TD.lime}60,transparent)` }} />
            {MILESTONES.map((m,i) => (
              <div key={i} style={{ position:'relative', marginBottom:32 }}>
                <div style={{ position:'absolute', left:-34, top:4, width:12, height:12, borderRadius:'50%', background:TD.lime, border:`2px solid ${TD.ink2}` }} />
                <div style={{ ...FF.data, fontSize:20, color:TD.lime, letterSpacing:'1px', marginBottom:6 }}>{m.year}</div>
                <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.62)', lineHeight:1.7, margin:0 }}>{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Series A ── */}
      <section style={{ background:`linear-gradient(135deg,${TD.forestDk} 0%,${TD.ink} 100%)`, padding:'80px 24px', textAlign:'center' }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${TD.lime}14`, border:`1px solid ${TD.lime}30`, borderRadius:99, padding:'6px 18px', marginBottom:24 }}>
            <i className="fas fa-chart-line" style={{ color:TD.lime, fontSize:11 }}></i>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'2.5px', color:TD.lime, textTransform:'uppercase' }}>Series A Fundraising</span>
          </div>
          <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,44px)', color:'#f0f5f0', margin:'0 0 16px', letterSpacing:'-1px' }}>Expanding across Ghana and into Lagos &amp; Abidjan</h2>
          <p style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.55)', margin:'0 auto 36px', maxWidth:500 }}>TrashDrop is raising a Series A round to scale collector networks, build logistics infrastructure, and expand to new cities. Investor enquiries welcome.</p>
          <a href="mailto:invest@trashdrops.com" style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 32px', borderRadius:10, textDecoration:'none', boxShadow:`0 8px 32px ${TD.lime}45`, display:'inline-block' }}>
            Investor Enquiries →
          </a>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default AboutPage;
