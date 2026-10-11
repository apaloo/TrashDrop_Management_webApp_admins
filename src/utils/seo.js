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

export const CITY_PAGES = [
  { slug: 'accra',    name: 'Accra',    path: '/waste-collection-accra' },
  { slug: 'kumasi',   name: 'Kumasi',   path: '/waste-collection-kumasi' },
  { slug: 'takoradi', name: 'Takoradi', path: '/waste-collection-takoradi' },
  { slug: 'tamale',   name: 'Tamale',   path: '/waste-collection-tamale' },
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
    const url = SITE_URL + (path === '/' ? '/' : path);
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
  name: BUSINESS.name,
  url: SITE_URL,
  logo: BUSINESS.logo,
  image: BUSINESS.logo,
  telephone: BUSINESS.phoneE164,
  email: BUSINESS.email,
  parentOrganization: { '@id': `${SITE_URL}/#organization` },
  areaServed: BUSINESS.cities.map(name => ({ '@type': 'City', name, containedInPlace: { '@type': 'Country', name: 'Ghana' } })),
  makesOffer: {
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      serviceType: 'Waste collection',
      name: 'Trash and waste collection',
      description: 'Household and business waste collection with QR Bags and on-demand Digital Bin pickups, with live collector tracking.',
      provider: { '@id': `${SITE_URL}/#localbusiness` },
      areaServed: BUSINESS.cities.map(name => ({ '@type': 'City', name })),
    },
  },
});
