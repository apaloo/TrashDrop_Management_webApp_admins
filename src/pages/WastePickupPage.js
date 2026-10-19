import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';
import { useSeo, faqJsonLd, BUSINESS, CITY_PAGES, SITE_URL, WASTE_PICKUP_PATH, localBusinessJsonLd } from '../utils/seo';

// On-demand pickup page: targets "waste pickup" / "trash pickup" searches.
export const WASTE_PICKUP_SEO = {
  title: 'Waste Pickup & Trash Pickup in Ghana – Same Day | TrashDrop',
  description: 'Need a waste pickup today? Request an on-demand trash pickup in Accra, Kumasi, Takoradi or Tamale. Instant price, live tracking, pay on collection.',
  path: WASTE_PICKUP_PATH,
};

const WASTE_TYPES = [
  ['Household rubbish', 'everyday kitchen and home waste'],
  ['Bagged general waste', 'any bags you have ready at the gate'],
  ['Recyclables', 'plastic bottles, cans, paper and cartons'],
  ['Organic and garden waste', 'food scraps, leaves and cuttings'],
  ['Small business waste', 'shops, offices, salons and restaurants'],
];

const STEPS = [
  ['Request', 'Open TrashDrop, set your location and describe the waste you want collected.'],
  ['Get an instant price', 'You see a GPS-based price quote before you confirm. No surprises at the gate.'],
  ['Track your collector', 'A verified collector near you accepts within 2 hours. Follow them live on the map.'],
  ['Pay and get confirmation', 'Pay with MoMo or cash when the waste is collected, and get confirmation it went to an authorised disposal site.'],
];

const FAQ = [
  { q: 'How fast is an on-demand waste pickup?', a: 'A verified collector near you accepts the request within 2 hours, and you can track them live on the map from the moment they accept.' },
  { q: 'How much does a trash pickup cost?', a: 'Digital Bin pickups are priced by distance and the amount of waste. You see the price in the app before you confirm. For free pickups, use TrashDrop QR Bags, from ₵115 for a batch of five.' },
  { q: 'How do I pay for a waste pickup?', a: 'Pay with MTN MoMo, Telecel Cash, AirtelTigo Money or cash when the collector picks up your waste.' },
  { q: 'Where does TrashDrop offer waste pickup?', a: 'In Accra, Kumasi, Takoradi and Tamale. Each city page lists the neighbourhoods collectors currently cover.' },
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

const CtaButtons = () => (
  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
    <Link to="/signup"
      style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 26px', borderRadius:10, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
      Request a waste pickup
    </Link>
    <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer"
      style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#fff', padding:'14px 26px', borderRadius:10, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.22)', display:'inline-flex', alignItems:'center', gap:8 }}>
      <i className="fab fa-whatsapp"></i> WhatsApp {BUSINESS.phoneDisplay}
    </a>
  </div>
);

const WastePickupPage = () => {
  useSeo({
    ...WASTE_PICKUP_SEO,
    jsonLd: [
      faqJsonLd(FAQ),
      {
        '@context': 'https://schema.org',
        '@type': 'Service',
        serviceType: 'Waste pickup',
        name: 'On-demand waste pickup',
        url: SITE_URL + WASTE_PICKUP_PATH,
        description: WASTE_PICKUP_SEO.description,
        provider: { '@id': localBusinessJsonLd()['@id'] },
        areaServed: BUSINESS.cities.map(name => ({ '@type': 'City', name, containedInPlace: { '@type': 'Country', name: 'Ghana' } })),
      },
      localBusinessJsonLd(),
    ],
  });

  return (
    <PublicPageLayout>
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'140px 24px 72px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ ...FF.label, fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:20 }}>
            <Link to="/" style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>Home</Link> / Waste pickup
          </nav>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,60px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            On-Demand Waste Pickup in Ghana
          </h1>
          <P>
            Need trash gone today? TrashDrop's Digital Bin service gives you an on-demand waste pickup anywhere we operate.
            Enter your waste details, get an instant GPS price quote, and a nearby verified collector accepts within 2 hours.
            Track them live and pay with MoMo or cash at collection.
          </P>
          <div style={{ marginTop:28 }}><CtaButtons /></div>
        </div>
      </section>

      <Section bg={TD.ink2}>
        <H2>What we pick up</H2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          {WASTE_TYPES.map(([t, d]) => (
            <div key={t} style={{ border:`1px solid ${TD.lime}25`, borderRadius:14, padding:'16px 18px', background:'rgba(168,230,61,0.04)' }}>
              <h3 style={{ ...FF.label, fontSize:15, fontWeight:700, color:'#f0f5f0', margin:'0 0 4px' }}>{t}</h3>
              <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.6)', margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg="#0c1a0c">
        <H2>How a waste pickup works</H2>
        <ol style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:14 }}>
          {STEPS.map(([t, d], i) => (
            <li key={t} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ ...FF.label, fontSize:12, fontWeight:700, color:TD.ink, background:TD.lime, borderRadius:'50%', width:28, height:28, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</span>
              <span style={{ ...FF.body, fontSize:15, color:'rgba(255,255,255,0.68)', lineHeight:1.7 }}>
                <strong style={{ color:'#f0f5f0', fontWeight:600 }}>{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section bg={TD.ink2}>
        <H2>Want free pickups instead?</H2>
        <P>
          If you need regular rubbish collection, the QR Bag System is cheaper over time: buy a batch of official TrashDrop bags
          (90L, 120L or 240L, from ₵115 for five), scan to activate them, and every pickup is free.
          Read <Link to="/how-it-works/" style={linkStyle}>how TrashDrop works</Link> or see <Link to="/how-it-works/#pricing" style={linkStyle}>bag prices</Link>.
        </P>
      </Section>

      <Section bg="#0c1a0c">
        <H2>Waste pickup near you</H2>
        <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:12 }}>
          {CITY_PAGES.map(c => (
            <li key={c.slug}>
              <Link to={c.path} style={{ ...FF.label, fontSize:14, fontWeight:700, color:TD.lime, textDecoration:'none', border:`1px solid ${TD.lime}35`, borderRadius:10, padding:'10px 18px', display:'inline-block' }}>
                Waste collection in {c.name} →
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section bg={TD.ink}>
        <H2>Waste pickup FAQ</H2>
        <FAQAccordion items={FAQ} />
        <div style={{ marginTop:28 }}><CtaButtons /></div>
      </Section>
    </PublicPageLayout>
  );
};

export default WastePickupPage;
