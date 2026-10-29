import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FAQAccordion } from '../components/PublicPageLayout';
import { Hero, Section, H2, P, Breadcrumb, StepList, CardGrid, ChipLink, linkStyle } from '../components/PublicSections';
import { TYPE, BTN } from '../theme/brand';
import { useSeo, faqJsonLd, BUSINESS, CITY_PAGES, SITE_URL, WASTE_PICKUP_PATH, cityLocalBusinessJsonLd } from '../utils/seo';
import { CITY_CONTENT } from './cityContent';
import { HOUSEHOLD_APP_URL } from '../config/homepage';

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

const CtaButtons = ({ city, dark }) => (
  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
    <a href={BUSINESS.whatsappUrl} target="_blank" rel="noopener noreferrer" style={dark ? BTN.primaryOnDark : BTN.primary}>
      <i className="fab fa-whatsapp" aria-hidden="true"></i> WhatsApp {BUSINESS.phoneDisplay}
    </a>
    <a href={HOUSEHOLD_APP_URL} data-testid="city-book-app" style={dark ? BTN.ghostOnDark : BTN.tonal}>
      Sign up to book in {city}
    </a>
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
      <Hero>
        <Breadcrumb trail={`Waste collection / ${c.name}`} />
        <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 24px' }}>
          Waste Collection &amp; Trash Pickup in {c.name}
        </h1>
        {c.intro.map((t, i) => <P key={i} dark>{t}</P>)}
        <div style={{ marginTop:28 }}><CtaButtons city={c.name} dark /></div>
      </Hero>

      {/* QR Bag */}
      <Section tone="white">
        <H2>How the QR Bag works in {c.name}</H2>
        <P>{c.qrIntro}</P>
        <div style={{ marginTop:24 }}><StepList steps={QR_STEPS} /></div>
      </Section>

      {/* Digital Bin */}
      <Section>
        <H2>Digital Bin: on-demand pickup in {c.name}</H2>
        <P>{c.digitalBin}</P>
        <P>See how to <Link to={WASTE_PICKUP_PATH} style={linkStyle}>book a rubbish collector on demand</Link>, from request to disposal confirmation.</P>
      </Section>

      {/* Bags */}
      <Section tone="white">
        <H2>Bag sizes and waste types</H2>
        <P>QR Bags come in three sizes: {BAG_SIZES.map(([n, s]) => `${n} ${s}`).join(', ')}. Each size is available for three waste types, and pickup is free on every bag. Bags start from ₵115 for a batch of five.</P>
        <div style={{ margin:'8px 0 20px' }}><CardGrid items={BAG_TYPES} /></div>
        <P>{c.bagsNote}</P>
      </Section>

      {/* Areas */}
      <Section>
        <H2>Neighbourhoods we serve in {c.name}</H2>
        <P>{c.areasIntro}</P>
        <ul style={{ listStyle:'none', padding:0, margin:'8px 0 20px', display:'flex', flexWrap:'wrap', gap:10 }}>
          {c.areas.map(a => (
            <li key={a} style={{ ...TYPE.small, fontWeight:500, color:TD.ink, background:'#fff', border:'1px solid var(--td-border)', borderRadius:999, padding:'6px 14px' }}>{a}</li>
          ))}
        </ul>
        <P>{c.local}</P>
      </Section>

      {/* CTA */}
      <Section tone="white">
        <H2>Book waste collection in {c.name} today</H2>
        <P>Message us on WhatsApp at {BUSINESS.phoneDisplay} or sign up to request your first trash pickup. New to TrashDrop? Read <Link to="/how-it-works/" style={linkStyle}>how TrashDrop works</Link> or the <Link to="/faq/" style={linkStyle}>full FAQ</Link>.</P>
        <CtaButtons city={c.name} />
      </Section>

      {/* FAQ */}
      <Section>
        <H2>{c.name} waste collection FAQ</H2>
        <FAQAccordion items={c.faq} surface="light" />
      </Section>

      {/* Other cities */}
      <Section tone="white">
        <H2>Waste collection in other cities</H2>
        <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexWrap:'wrap', gap:12 }}>
          {others.map(o => (
            <li key={o.slug}><ChipLink to={o.path}>Waste collection in {o.name} →</ChipLink></li>
          ))}
          <li><ChipLink to="/">TrashDrop home</ChipLink></li>
        </ul>
      </Section>
    </PublicPageLayout>
  );
};

export default CityWasteCollectionPage;
