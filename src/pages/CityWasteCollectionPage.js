import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';
import { useSeo, faqJsonLd, BUSINESS, CITY_PAGES, SITE_URL, WASTE_PICKUP_PATH, cityLocalBusinessJsonLd } from '../utils/seo';
import { CITY_CONTENT } from './cityContent';

const QR_STEPS = [
  ['Receive your bags', 'Get a batch of TrashDrop QR Bags in the size and waste type you need.'],
  ['Scan the QR code to load them', 'Scan the batch code in the app to load the bags onto your account and address.'],
  ['Fill the bag', 'Use each bag as normal. Keep organic, general and recyclable waste in their own bags.'],
  ['Request a pickup', 'When a bag is full, tap Request Pickup. Pickup is free with QR Bags.'],
  ['A collector arrives', 'A verified collector near you accepts the request and comes to your door.'],
  ['Tracked to disposal', 'The collector scans the bag, and you can follow it to an authorised disposal site.'],
];

const BAG_SIZES = [['Small', '90L'], ['Medium', '120L'], ['Large', '240L']];
const BAG_TYPES = [
  ['Organic', 'food scraps, peelings, garden waste'],
  ['General', 'everyday mixed household waste'],
  ['Recyclable', 'plastic bottles, cans, paper and cartons'],
];

const H2 = ({ children }) => (
  <h2 style={{ ...FF.display, fontSize:'clamp(26px,3.5vw,40px)', color:'#f0f5f0', margin:'0 0 18px', letterSpacing:'-0.8px', lineHeight:1.1 }}>{children}</h2>
);
const P = ({ children }) => (
  <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.68)', lineHeight:1.8, margin:'0 0 16px' }}>{children}</p>
);
const Section = ({ bg, children }) => (
  <section style={{ background:bg, padding:'72px 24px' }}>
    <div style={{ maxWidth:860, margin:'0 auto' }}>{children}</div>
  </section>
);
const linkStyle = { color:TD.lime, textDecoration:'underline', textUnderlineOffset:3 };

const CtaButtons = ({ city }) => (
  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
    <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer"
      style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 26px', borderRadius:10, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
      <i className="fab fa-whatsapp"></i> WhatsApp {BUSINESS.phoneDisplay}
    </a>
    <Link to="/signup"
      style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#fff', padding:'14px 26px', borderRadius:10, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.22)' }}>
      Sign up to book in {city}
    </Link>
  </div>
);

const CityWasteCollectionPage = ({ slug }) => {
  const c = CITY_CONTENT[slug];
  const page = CITY_PAGES.find(p => p.slug === slug);
  const others = CITY_PAGES.filter(p => p.slug !== slug);

  useSeo({
    title: c.title,
    description: c.description,
    path: page.path,
    jsonLd: [
      faqJsonLd(c.faq),
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Waste collection',
        name: `Waste collection in ${c.name}`,
        url: SITE_URL + page.path,
        provider: { '@type': 'Organization', name: BUSINESS.name, url: SITE_URL, telephone: BUSINESS.phoneE164 },
        areaServed: { '@type': 'City', name: c.name, containedInPlace: { '@type': 'Country', name: 'Ghana' } },
      },
      cityLocalBusinessJsonLd(c.name, page.path),
    ],
  });

  return (
    <PublicPageLayout>
      {/* Hero */}
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'140px 24px 72px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ ...FF.label, fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:20 }}>
            <Link to="/" style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>Home</Link> / Waste collection / {c.name}
          </nav>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,60px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            Waste Collection &amp; Trash Pickup in {c.name}
          </h1>
          {c.intro.map((t, i) => <P key={i}>{t}</P>)}
          <div style={{ marginTop:28 }}><CtaButtons city={c.name} /></div>
        </div>
      </section>

      {/* QR Bag */}
      <Section bg={TD.ink2}>
        <H2>How the QR Bag works in {c.name}</H2>
        <P>{c.qrIntro}</P>
        <ol style={{ listStyle:'none', padding:0, margin:'24px 0 0', display:'grid', gap:14 }}>
          {QR_STEPS.map(([t, d], i) => (
            <li key={t} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ ...FF.label, fontSize:12, fontWeight:700, color:TD.ink, background:TD.lime, borderRadius:'50%', width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</span>
              <span style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.68)', lineHeight:1.7 }}>
                <strong style={{ color:'#f0f5f0', fontWeight:600 }}>{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* Digital Bin */}
      <Section bg="#0c1a0c">
        <H2>Digital Bin: on-demand pickup in {c.name}</H2>
        <P>{c.digitalBin}</P>
        <P>See how an <Link to={WASTE_PICKUP_PATH} style={linkStyle}>on-demand waste pickup</Link> works, from request to disposal confirmation.</P>
      </Section>

      {/* Bags */}
      <Section bg={TD.ink2}>
        <H2>Bag sizes and waste types</H2>
        <P>QR Bags come in three sizes: {BAG_SIZES.map(([n, s]) => `${n} ${s}`).join(', ')}. Each size is available for three waste types, and pickup is free on every bag. Bags start from ₵115 for a batch of five.</P>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12, margin:'8px 0 20px' }}>
          {BAG_TYPES.map(([t, d]) => (
            <div key={t} style={{ border:`1px solid ${TD.lime}25`, borderRadius:14, padding:'16px 18px', background:'rgba(168,230,61,0.04)' }}>
              <h3 style={{ ...FF.label, fontSize:15, fontWeight:700, color:'#f0f5f0', margin:'0 0 4px' }}>{t}</h3>
              <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.6)', margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
        <P>{c.bagsNote}</P>
      </Section>

      {/* Areas */}
      <Section bg="#0c1a0c">
        <H2>Neighbourhoods we serve in {c.name}</H2>
        <P>{c.areasIntro}</P>
        <ul style={{ listStyle:'none', padding:0, margin:'8px 0 20px', display:'flex', flexWrap:'wrap', gap:10 }}>
          {c.areas.map(a => (
            <li key={a} style={{ ...FF.label, fontSize:13, fontWeight:600, color:'#f0f5f0', background:'rgba(168,230,61,0.07)', border:`1px solid ${TD.lime}20`, borderRadius:99, padding:'7px 16px' }}>{a}</li>
          ))}
        </ul>
        <P>{c.local}</P>
      </Section>

      {/* CTA */}
      <Section bg={TD.ink2}>
        <H2>Book waste collection in {c.name} today</H2>
        <P>Message us on WhatsApp at {BUSINESS.phoneDisplay} or sign up to request your first trash pickup. New to TrashDrop? Read <Link to="/how-it-works" style={linkStyle}>how TrashDrop works</Link> or the <Link to="/faq" style={linkStyle}>full FAQ</Link>.</P>
        <CtaButtons city={c.name} />
      </Section>

      {/* FAQ */}
      <Section bg={TD.ink}>
        <H2>{c.name} waste collection FAQ</H2>
        <FAQAccordion items={c.faq} />
      </Section>

      {/* Other cities */}
      <Section bg="#0c1a0c">
        <H2>Waste collection in other cities</H2>
        <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:12 }}>
          {others.map(o => (
            <li key={o.slug}><Link to={o.path} style={{ ...FF.label, fontSize:14, fontWeight:700, color:TD.lime, textDecoration:'none', border:`1px solid ${TD.lime}35`, borderRadius:10, padding:'10px 18px', display:'inline-block' }}>Waste collection in {o.name} →</Link></li>
          ))}
          <li><Link to="/" style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#fff', textDecoration:'none', border:'1px solid rgba(255,255,255,0.2)', borderRadius:10, padding:'10px 18px', display:'inline-block' }}>TrashDrop home</Link></li>
        </ul>
      </Section>
    </PublicPageLayout>
  );
};

export default CityWasteCollectionPage;
