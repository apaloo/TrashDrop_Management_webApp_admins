import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { FAQAccordion } from '../components/PublicPageLayout';
import { Hero, Section, H2, P, Breadcrumb, StepList, CardGrid, ChipLink, linkStyle } from '../components/PublicSections';
import { TYPE, BTN } from '../theme/brand';
import { useSeo, faqJsonLd, BUSINESS, CITY_PAGES, SITE_URL, WASTE_PICKUP_PATH, localBusinessJsonLd } from '../utils/seo';
import { HOUSEHOLD_APP_URL } from '../config/homepage';

// On-demand pickup page: targets "waste pickup" / "trash pickup" / "rubbish collector" searches.
export const WASTE_PICKUP_SEO = {
  title: 'Waste Pickup in Ghana: Book a Rubbish Collector Today | TrashDrop',
  description: 'Need a rubbish collector today? Book an on-demand waste or trash pickup in Accra, Kumasi, Takoradi or Tamale. Instant price, live tracking, pay on collection.',
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
  ['Track your collector', 'A verified rubbish collector near you accepts within 2 hours. Follow them live on the map.'],
  ['Pay and get confirmation', 'Pay with MoMo or cash when the waste is collected, and get confirmation it went to an authorised disposal site.'],
];

const FAQ = [
  { q: 'How fast is an on-demand waste pickup?', a: 'A verified collector near you accepts the request within 2 hours, and you can track them live on the map from the moment they accept.' },
  { q: 'How much does a trash pickup cost?', a: 'Digital Bin pickups are priced by distance and the amount of waste. You see the price in the app before you confirm. For free pickups, use TrashDrop QR Bags, from ₵115 for a batch of five.' },
  { q: 'How do I pay for a waste pickup?', a: 'Pay with MTN MoMo, Telecel Cash, AirtelTigo Money or cash when the collector picks up your waste.' },
  { q: 'How do I find a rubbish collector near me?', a: 'Request a pickup in the TrashDrop app or on WhatsApp. TrashDrop sends the request to verified rubbish collectors close to you, and the first to accept comes to your gate. You see who is coming and can follow them on the map.' },
  { q: 'Where does TrashDrop offer waste pickup?', a: 'In Accra, Kumasi, Takoradi and Tamale. Each city page lists the neighbourhoods collectors currently cover.' },
];

const CtaButtons = ({ dark }) => (
  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
    <a href={HOUSEHOLD_APP_URL} style={dark ? BTN.primaryOnDark : BTN.primary}>
      Request a waste pickup
    </a>
    <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer" style={dark ? BTN.ghostOnDark : BTN.tonal}>
      <i className="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp {BUSINESS.phoneDisplay}
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
      <Hero>
        <Breadcrumb trail="Waste pickup" />
        <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 24px' }}>
          On-Demand Waste Pickup & Rubbish Collectors in Ghana
        </h1>
        <P dark>
          Need trash gone today? TrashDrop's Digital Bin service gives you an on-demand waste pickup anywhere we operate.
          Enter your waste details, get an instant GPS price quote, and a nearby verified rubbish collector accepts within 2 hours.
          Track them live and pay with MoMo or cash at collection.
        </P>
        <div style={{ marginTop:28 }}><CtaButtons dark /></div>
      </Hero>

      <Section tone="white">
        <H2>What we pick up</H2>
        <CardGrid items={WASTE_TYPES} />
      </Section>

      <Section>
        <H2>How a waste pickup works</H2>
        <StepList steps={STEPS} />
      </Section>

      <Section tone="white">
        <H2>Want free pickups instead?</H2>
        <P>
          If you need regular rubbish collection, the QR Bag System is cheaper over time: buy a batch of official TrashDrop bags
          (90L, 120L or 240L, from ₵115 for five), scan to activate them, and every pickup is free.
          Read <Link to="/how-it-works/" style={linkStyle}>how TrashDrop works</Link> or see <Link to="/how-it-works/#pricing" style={linkStyle}>bag prices</Link>.
        </P>
      </Section>

      <Section>
        <H2>Waste pickup near you</H2>
        <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:12 }}>
          {CITY_PAGES.map(c => (
            <li key={c.slug}><ChipLink to={c.path}>Waste collection in {c.name} →</ChipLink></li>
          ))}
        </ul>
      </Section>

      <Section tone="white">
        <H2>Waste pickup FAQ</H2>
        <FAQAccordion items={FAQ} surface="light" />
        <div style={{ marginTop:28 }}><CtaButtons /></div>
      </Section>
    </PublicPageLayout>
  );
};

export default WastePickupPage;
