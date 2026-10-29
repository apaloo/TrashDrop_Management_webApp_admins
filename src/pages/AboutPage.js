import React, { useEffect } from 'react';
import PublicPageLayout, { TD } from '../components/PublicPageLayout';
import { Hero, Section, H2, P, Eyebrow, DarkCta, cardStyle } from '../components/PublicSections';
import { TYPE, BTN } from '../theme/brand';
import { HOUSEHOLD_APP_URL } from '../config/homepage';

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

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://trashdrops.com/about/';
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/about/');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/about/');

    return () => {
      const can = document.querySelector('link[rel="canonical"]'); if (can) can.href = 'https://trashdrops.com/';
      const ogU = document.querySelector('meta[property="og:url"]'); if (ogU) ogU.setAttribute('content', 'https://trashdrops.com/');
      const twU = document.querySelector('meta[name="twitter:url"]'); if (twU) twU.setAttribute('content', 'https://trashdrops.com/');
    };
  }, []);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <Hero width={820} center>
        <Eyebrow dark>About TrashDrop</Eyebrow>
        <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 24px' }}>
          What is TrashDrop?
        </h1>
        {/* ── AI ANSWER PARAGRAPH ── */}
        <p style={{ ...TYPE.body, color:TD.sageOnDark, maxWidth:740, margin:'0 auto 40px' }}>
          TrashDrop is Ghana's leading mobile waste management platform, by Infobrix Limited. The product was co-founded by Otis Apaloo (Operations Lead &amp; Co-founder), Simone Fuga (CEO &amp; Co-founder), Xose Ahlijah (CTO &amp; Co-founder). TrashDrop operates a Progressive Web App — accessible at app.trashdrops.com (households) and collector.trashdrops.com (carters) with no app store download required — that connects households and businesses in Accra, Kumasi, Takoradi and Tamale with a network of over 480 ID-verified waste collectors. The platform processes more than 3,400 pickup requests monthly, has achieved a 98%+ completion rate, and diverts over 55 tonnes of waste from Ghanaian landfills every month. Collectors earn an average of ₵32.43 per completed pickup, paid directly to their mobile money wallet. TrashDrop is raising a Series A round to expand across Ghana and into Lagos and Abidjan.
        </p>
        <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
          <a href={HOUSEHOLD_APP_URL} style={BTN.primaryOnDark}>Get started free</a>
          <a href="mailto:hello@trashdrops.com" style={BTN.ghostOnDark}>Contact us</a>
        </div>
      </Hero>

      {/* ── Stats ── */}
      <section style={{ background:'#fff', padding:'var(--td-section-y-compact) 24px', borderBottom:'1px solid var(--td-border)' }}>
        <dl style={{ maxWidth:1100, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))', gap:32, textAlign:'center' }}>
          {STATS.map(s => (
            <div key={s.l} style={{ display:'flex', flexDirection:'column-reverse' }}>
              <dt style={{ ...TYPE.small, color:TD.sage, marginTop:4 }}>{s.l}</dt>
              <dd style={{ ...TYPE.stat, color:TD.forest, margin:0 }}>{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Mission ── */}
      <Section width={1000}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(300px,100%),1fr))', gap:48, alignItems:'center' }}>
          <div>
            <Eyebrow>Our mission</Eyebrow>
            <H2>Eliminate waste dumping from Ghanaian communities</H2>
            <P>
              Ghana generates over 12 million tonnes of solid waste annually, with less than 60% collected in urban areas. Uncollected waste ends up in illegal dump sites, drainage channels, and waterways — contaminating drinking water and spreading disease.
            </P>
            <P>
              TrashDrop's approach is simple: make waste collection easier to request than illegal dumping. By connecting households directly with verified collectors, providing real-time GPS tracking, and rewarding good behaviour with points, we change the economics of waste disposal in Ghana.
            </P>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { icon:'fa-check-circle', title:'Verified Collectors',   body:'Every collector is ID-checked, vehicle-verified, and operationally licenced before they join the platform.' },
              { icon:'fa-map-marked-alt',title:'Authorised Disposal',  body:'Waste is delivered only to sites with valid Ghana EPA environmental permits. No illegal dumping in the chain.' },
              { icon:'fa-star',          title:'Reward-Based System',  body:'Users earn points for pickups and dumping reports. Collectors earn bonuses and recycling revenue shares.' },
            ].map(p => (
              <div key={p.title} style={{ ...cardStyle, display:'flex', alignItems:'flex-start', gap:16 }}>
                <i className={`fas ${p.icon}`} aria-hidden="true" style={{ color:TD.forest, fontSize:20, marginTop:3, flexShrink:0 }}></i>
                <div>
                  <h3 style={{ ...TYPE.body, fontWeight:600, color:TD.ink, margin:'0 0 4px' }}>{p.title}</h3>
                  <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── Team ── */}
      <Section tone="white">
        <div style={{ textAlign:'center' }}>
          <Eyebrow>The team</Eyebrow>
          <H2 center>Founded by Infobrix Limited</H2>
          <ul style={{ listStyle:'none', padding:0, margin:'28px 0 0', display:'flex', gap:24, justifyContent:'center', flexWrap:'wrap' }}>
            {TEAM.map(t => (
              <li key={t.name} style={{ ...cardStyle, background:TD.cream, padding:'32px 28px', minWidth:220 }}>
                <div aria-hidden="true" style={{ width:64, height:64, borderRadius:'50%', background:TD.forest, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', ...TYPE.card, fontWeight:700, color:'#fff' }}>
                  {t.initial}
                </div>
                <div style={{ ...TYPE.card, color:TD.ink, marginBottom:4 }}>{t.name}</div>
                <div style={{ ...TYPE.small, color:TD.sage }}>{t.role}</div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ── Timeline ── */}
      <Section width={760}>
        <H2 center>Our journey</H2>
        <ol style={{ listStyle:'none', margin:'32px 0 0', padding:'0 0 0 40px', background:'linear-gradient(var(--td-border),var(--td-border)) 12px 0 / 2px 100% no-repeat' }}>
          {MILESTONES.map(m => (
            <li key={m.year} style={{ position:'relative', marginBottom:32 }}>
              <div aria-hidden="true" style={{ position:'absolute', left:-34, top:6, width:12, height:12, borderRadius:'50%', background:TD.forest, border:`2px solid ${TD.cream}` }} />
              <div style={{ ...TYPE.card, color:TD.forest, marginBottom:4 }}>{m.year}</div>
              <p style={{ ...TYPE.body, color:TD.sage, margin:0 }}>{m.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Series A ── */}
      <DarkCta title="Expanding across Ghana and into Lagos & Abidjan">
        <p style={{ ...TYPE.body, color:TD.sageOnDark, margin:'0 auto 32px', maxWidth:520 }}>TrashDrop is raising a Series A round to scale collector networks, build logistics infrastructure, and expand to new cities. Investor enquiries welcome.</p>
        <a href="mailto:invest@trashdrops.com" style={BTN.primaryOnDark}>Investor enquiries →</a>
      </DarkCta>
    </PublicPageLayout>
  );
};

export default AboutPage;
