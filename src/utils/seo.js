import { useEffect } from 'react';

export const SITE_URL = 'https://trashdrops.com';

// Business details shown on the site and in structured data.
// Keep these identical to the Google Business Profile.
export const BUSINESS = {
  name: 'TrashDrop',
  legalName: 'Infobrix Limited',
  phoneDisplay: '+233 20 933 8885',
  phoneE164: '+233209338885',
  whatsappUrl: 'https://wa.me/233209338885',
  email: 'hello@trashdrops.com',
  logo: `${SITE_URL}/icon-512x512.png`,
  cities: ['Accra', 'Kumasi', 'Takoradi', 'Tamale'],
  sameAs: [
    'https://web.facebook.com/profile.php?id=61590201371573',
    // Add the Google Business Profile "Share" link here
  ],
};

/**
 * Public pages are served as /<page>/index.html, so Netlify redirects
 * /<page> to /<page>/. Every canonical, sitemap entry and internal link uses
 * the trailing-slash form, so crawlers never meet a redirect.
 * '/about' and '/about/#faq' -> '/about/' and '/about/#faq'; '/' is unchanged.
 */
export const withSlash = (path = '/') => {
  const i = path.search(/[?#]/);
  const base = i === -1 ? path : path.slice(0, i);
  const rest = i === -1 ? '' : path.slice(i);
  return base.endsWith('/') ? path : `${base}/${rest}`;
};

/** On-demand pickup landing page (targets "waste pickup" / "trash pickup") */
export const WASTE_PICKUP_PATH = '/waste-pickup/';

/** Services, as listed on the Google Business Profile */
export const SERVICES = [
  'Household waste collection',
  'On-demand trash pickup',
  'Business waste collection',
  'Recyclable waste pickup',
  'Organic waste collection',
];

export const CITY_PAGES = [
  { slug: 'accra',    name: 'Accra',    path: '/waste-collection-accra/' },
  { slug: 'kumasi',   name: 'Kumasi',   path: '/waste-collection-kumasi/' },
  { slug: 'takoradi', name: 'Takoradi', path: '/waste-collection-takoradi/' },
  { slug: 'tamale',   name: 'Tamale',   path: '/waste-collection-tamale/' },
];

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

/**
 * Sets the page's <title>, description, canonical and social tags, and
 * injects page-specific JSON-LD. scripts/prerender.js bakes the result into
 * the static HTML, so crawlers get it without running JavaScript.
 */
export const useSeo = ({ title, description, path, jsonLd }) => {
  const ldKey = jsonLd ? JSON.stringify(jsonLd) : '';
  useEffect(() => {
    const url = SITE_URL + withSlash(path);
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:url', url);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    if (!ldKey) return undefined;
    const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
    const scripts = blocks.map(block => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.setAttribute('data-page-ld', '');
      s.text = JSON.stringify(block);
      document.head.appendChild(s);
      return s;
    });
    return () => scripts.forEach(s => s.remove());
    // jsonLd is compared through ldKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, ldKey]);
};

export const faqJsonLd = items => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
});

export const organizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: BUSINESS.name,
  legalName: BUSINESS.legalName,
  url: SITE_URL,
  logo: BUSINESS.logo,
  telephone: BUSINESS.phoneE164,
  email: BUSINESS.email,
  sameAs: BUSINESS.sameAs,
});

export const localBusinessJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${SITE_URL}/#localbusiness`,
  additionalType: 'https://schema.org/ProfessionalService',
  name: BUSINESS.name,
  legalName: BUSINESS.legalName,
  url: SITE_URL,
  logo: BUSINESS.logo,
  image: BUSINESS.logo,
  telephone: BUSINESS.phoneE164,
  email: BUSINESS.email,
  description: 'Waste collection and trash pickup in Accra, Kumasi, Takoradi and Tamale. Free pickup with QR Bags, on-demand Digital Bin pickups and live collector tracking.',
  address: { '@type': 'PostalAddress', addressLocality: 'Accra', addressCountry: 'GH' },
  priceRange: '₵₵',
  // Same payment options as the site copy (MoMo: MTN, Telecel, AirtelTigo)
  paymentAccepted: 'Cash, Mobile Money',
  currenciesAccepted: 'GHS',
  sameAs: BUSINESS.sameAs,
  parentOrganization: { '@id': `${SITE_URL}/#organization` },
  areaServed: BUSINESS.cities.map(name => ({ '@type': 'City', name, containedInPlace: { '@type': 'Country', name: 'Ghana' } })),
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Waste collection services',
    itemListElement: SERVICES.map(name => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name, serviceType: 'Waste collection' } })),
  },
});

/** The LocalBusiness for one city page: same business, that city as its service area */
export const cityLocalBusinessJsonLd = (cityName, path) => ({
  ...localBusinessJsonLd(),
  '@id': `${SITE_URL}${withSlash(path)}#localbusiness`,
  name: `${BUSINESS.name} ${cityName}`,
  url: SITE_URL + withSlash(path),
  description: `Waste collection and trash pickup in ${cityName}: free pickup with QR Bags, on-demand Digital Bin pickups and live collector tracking.`,
  address: { '@type': 'PostalAddress', addressLocality: cityName, addressCountry: 'GH' },
  areaServed: { '@type': 'City', name: cityName, containedInPlace: { '@type': 'Country', name: 'Ghana' } },
});
