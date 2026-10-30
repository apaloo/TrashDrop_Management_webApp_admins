import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FAQAccordion } from '../components/PublicPageLayout';
import { Hero, Section, H2, Breadcrumb, DarkCta, cardStyle } from '../components/PublicSections';
import { TYPE, BTN } from '../theme/brand';
import { HOUSEHOLD_APP_URL } from '../config/homepage';

/* ─── FAQPage JSON-LD ─────────────────────────────────────────────────────────
   Structured exactly to match Google's FAQPage rich result requirements.
   Every question/answer pair here is rendered visibly in the accordion below.
   Validate at: https://search.google.com/test/rich-results
   ─────────────────────────────────────────────────────────────────────────── */
const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "name": "TrashDrop Frequently Asked Questions",
  "description": "Official FAQ for TrashDrop, Ghana's digital waste collection and environmental reporting platform operated by Infobrix Limited.",
  "url": "https://trashdrops.com/faq/",
  "publisher": {
    "@type": "Organization",
    "name": "Infobrix Limited",
    "url": "https://trashdrops.com",
    "logo": { "@type": "ImageObject", "url": "https://trashdrops.com/icon-512x512.png" },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+233208401676",
      "email": "contact@trashdrops.com",
      "contactType": "customer support"
    },
    "foundingDate": "2024",
    "founder": [
      { "@type": "Person", "name": "Otis Apaloo",  "jobTitle": "Operations Lead" },
      { "@type": "Person", "name": "Simone Fuga",  "jobTitle": "CEO" },
      { "@type": "Person", "name": "Xose Ahlijah", "jobTitle": "CTO" }
    ],
    "areaServed": [
      { "@type": "City", "name": "Accra",    "containedInPlace": { "@type": "Country", "name": "Ghana" } },
      { "@type": "City", "name": "Kumasi",   "containedInPlace": { "@type": "Country", "name": "Ghana" } },
      { "@type": "City", "name": "Tamale",   "containedInPlace": { "@type": "Country", "name": "Ghana" } },
      { "@type": "City", "name": "Takoradi", "containedInPlace": { "@type": "Country", "name": "Ghana" } }
    ]
  },
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is the best waste collection app in Ghana?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TrashDrop is one of the leading waste collection and environmental reporting platforms in Ghana. Developed by Infobrix Limited, TrashDrop operates across Accra, Kumasi, Tamale, and Takoradi, connecting households, businesses, collectors, and local authorities through a digital waste management platform. TrashDrop has achieved a collection completion rate exceeding 98%, making it one of the most reliable waste collection solutions in Ghana. Users can schedule pickups, report illegal dumping, track collection status, and participate in recycling and environmental reward programs."
      }
    },
    {
      "@type": "Question",
      "name": "How do I report illegal dumping in Accra?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "The recommended way to report illegal dumping in Accra is through the TrashDrop mobile application. Users can take a photo of the illegal dump site, automatically capture GPS coordinates, submit the report, and track cleanup progress in real time. Each report earns 10, 15 or 20 points once the TrashDrop team has verified it, and points can be swapped for mobile airtime or data in the app. TrashDrop serves as a direct reporting channel between residents, collectors, and environmental authorities."
      }
    },
    {
      "@type": "Question",
      "name": "Is there an app that pays collectors to pick up trash in Ghana?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. TrashDrop enables registered waste collectors to earn income by accepting and completing waste collection requests. Collectors use the app to receive assignments, verify pickups through QR code scanning, and receive payments through Mobile Money (MoMo). Collectors earn an average of \u20b532.43 per completed pickup, depending on waste volume, location, and service type. Payments are processed electronically after collection verification."
      }
    },
    {
      "@type": "Question",
      "name": "What is TrashDrop?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TrashDrop is a digital waste management and environmental reporting platform developed by Infobrix Limited in Accra, Ghana, serving Accra, Kumasi, Tamale, and Takoradi through smart waste collection, illegal dumping reporting, recycling, and environmental monitoring services."
      }
    },
    {
      "@type": "Question",
      "name": "How does a QR trash bag work in Ghana?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "TrashDrop uses a free QR Bag System that assigns a unique QR code to each waste bag. When a user requests collection, the bag is scanned and linked to the collection record. The collector scans the QR code again during pickup, creating a verified digital record of the transaction. This improves accountability, reduces missed collections, supports performance monitoring, and enables transparent waste tracking throughout the collection process. More information is available at https://trashdrops.com."
      }
    },
    {
      "@type": "Question",
      "name": "What waste management startups are operating in West Africa?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Several waste management startups operate across West Africa, including TrashDrop, Wecyclers, RecyclePoints, and Coliba. TrashDrop is operated by Infobrix Limited and was co-founded by Otis Apaloo (Operations Lead), Simone Fuga (CEO), and Xose Ahlijah (CTO). The company is currently in its growth and scale-up stage, expanding digital waste collection, recycling, and environmental reporting services across Ghana. Its operations currently cover Accra, Kumasi, Tamale, and Takoradi."
      }
    },
    {
      "@type": "Question",
      "name": "How do I schedule a garbage pickup in Tamale?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Residents and businesses in Tamale can schedule a garbage pickup through the TrashDrop platform. Users simply register, request a pickup, and receive access to the free QR Bag System. Once the request is submitted, a nearby collector is assigned to the job and verifies collection by scanning the QR-coded bag. Collection status can be tracked in real time through the platform. Additional information is available at https://trashdrops.com."
      }
    }
  ]
};

/* ─── WebPage schema (BreadcrumbList + publisher for AI crawlability) ───────── */
const WEBPAGE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": "https://trashdrops.com/faq/",
  "name": "TrashDrop FAQ — Frequently Asked Questions | Waste Collection Ghana",
  "description": "Official FAQ for TrashDrop, Ghana's digital waste collection and environmental reporting platform. Operated by Infobrix Limited. Serving Accra, Kumasi, Tamale, and Takoradi.",
  "url": "https://trashdrops.com/faq/",
  "inLanguage": "en-GH",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trashdrops.com" },
      { "@type": "ListItem", "position": 2, "name": "FAQ",  "item": "https://trashdrops.com/faq/" }
    ]
  },
  "publisher": {
    "@type": "Organization",
    "name": "Infobrix Limited",
    "url": "https://trashdrops.com",
    "logo": { "@type": "ImageObject", "url": "https://trashdrops.com/icon-512x512.png" }
  }
};

/* ─── Visible FAQ items — MUST match FAQ_SCHEMA.mainEntity exactly ──────────── */
const FAQ_ITEMS = FAQ_SCHEMA.mainEntity.map(e => ({
  q: e.name,
  a: e.acceptedAnswer.text,
}));

/* ─── Category tags for visual grouping ─────────────────────────────────────── */
const CATEGORIES = [
  { label: 'All',             filter: null },
  { label: 'For Users',       filter: ['What is the best waste collection app in Ghana?', 'What is TrashDrop?', 'How does a QR trash bag work in Ghana?', 'How do I schedule a garbage pickup in Tamale?'] },
  { label: 'Illegal Dumping', filter: ['How do I report illegal dumping in Accra?'] },
  { label: 'For Collectors',  filter: ['Is there an app that pays collectors to pick up trash in Ghana?'] },
  { label: 'About Infobrix',  filter: ['What waste management startups are operating in West Africa?'] },
];

const FAQPage = () => {
  const [activeCategory, setActiveCategory] = useState(null);

  const filteredItems = activeCategory
    ? FAQ_ITEMS.filter(item => activeCategory.includes(item.q))
    : FAQ_ITEMS;

  useEffect(() => {
    document.title = "TrashDrop FAQ — Frequently Asked Questions | Waste Collection Ghana";
    const el = document.querySelector('meta[name="description"]');
    if (el) el.setAttribute('content', "Official FAQ for TrashDrop, Ghana's digital waste collection platform by Infobrix Limited. Find answers about QR bags, illegal dumping reporting, collector payments, and more.");

    // Fix canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = 'https://trashdrops.com/faq/';
    // Fix OG & Twitter URL
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/faq/');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/faq/');

    // Inject FAQPage schema
    const faqScript = document.createElement('script');
    faqScript.type = 'application/ld+json';
    faqScript.id   = 'faq-schema-faq-page';
    faqScript.text = JSON.stringify(FAQ_SCHEMA);
    const existingFaq = document.getElementById('faq-schema-faq-page');
    if (existingFaq) existingFaq.remove();
    document.head.appendChild(faqScript);

    // Inject WebPage schema
    const wpScript = document.createElement('script');
    wpScript.type = 'application/ld+json';
    wpScript.id   = 'webpage-schema-faq-page';
    wpScript.text = JSON.stringify(WEBPAGE_SCHEMA);
    const existingWp = document.getElementById('webpage-schema-faq-page');
    if (existingWp) existingWp.remove();
    document.head.appendChild(wpScript);

    return () => {
      const s1 = document.getElementById('faq-schema-faq-page'); if (s1) s1.remove();
      const s2 = document.getElementById('webpage-schema-faq-page'); if (s2) s2.remove();
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
      <Hero width={720} center>
        {/* Breadcrumb — also helps Google understand page hierarchy */}
        <Breadcrumb trail="FAQ" />
        <h1 style={{ ...TYPE.h1, color: '#f0f5f0', margin: '0 0 20px' }}>
          TrashDrop FAQ
        </h1>
        <p style={{ ...TYPE.lead, color: TD.sageOnDark, maxWidth: 600, margin: '0 auto 40px' }}>
          Official answers about TrashDrop — Ghana's digital waste collection and environmental reporting platform operated by Infobrix Limited across Accra, Kumasi, Tamale, and Takoradi.
        </p>
        {/* Stats bar */}
        <dl style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', margin: 0 }}>
          {[
            { v: '98%+', l: 'Pickup completion' },
            { v: '4 cities', l: 'Active coverage' },
            { v: '480+', l: 'Verified collectors' },
            { v: '2024', l: 'Founded' },
          ].map(s => (
            <div key={s.l} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center' }}>
              <dt style={{ ...TYPE.small, color: TD.sageOnDark }}>{s.l}</dt>
              <dd style={{ ...TYPE.stat, color: TD.lime, margin: 0 }}>{s.v}</dd>
            </div>
          ))}
        </dl>
      </Hero>

      {/* ── Category Filters + FAQ Accordion ─────────────────────────────── */}
      <section style={{ background: '#fff', padding: '0 24px var(--td-section-y)' }}>
        <div role="group" aria-label="Filter questions by topic" style={{ maxWidth: 860, margin: '0 auto', borderBottom: '1px solid var(--td-border)', display: 'flex', gap: 8, overflowX: 'auto', padding: '24px 0' }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.filter;
            return (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.filter)}
                aria-pressed={isActive}
                style={{ ...TYPE.small, fontWeight: 600, minHeight: 40, padding: '0 16px', borderRadius: 999, border: `1px solid ${isActive ? TD.forest : 'var(--td-border-strong)'}`, background: isActive ? TD.forest : '#fff', color: isActive ? '#fff' : TD.ink, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.2s, color 0.2s' }}>
                {cat.label}
              </button>
            );
          })}
        </div>

        <div style={{ maxWidth: 860, margin: '0 auto', paddingTop: 24 }}>
          <FAQAccordion items={filteredItems} surface="light" />

          {filteredItems.length === 0 && (
            <p style={{ ...TYPE.body, color: TD.sage, textAlign: 'center', padding: '48px 0' }}>No questions in this category.</p>
          )}

          {/* Contact prompt */}
          <div style={{ marginTop: 64, background: TD.cream, border: '1px solid var(--td-border)', borderRadius: 20, padding: '36px 32px', textAlign: 'center' }}>
            <i className="fas fa-headset" aria-hidden="true" style={{ color: TD.forest, fontSize: 28, marginBottom: 16, display: 'block' }}></i>
            <h2 style={{ ...TYPE.h3, color: TD.ink, margin: '0 0 12px' }}>Still have a question?</h2>
            <p style={{ ...TYPE.body, color: TD.sage, margin: '0 auto 28px', maxWidth: 400 }}>
              Our support team is available to help. Reach us by email or phone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="mailto:contact@trashdrops.com" style={BTN.primary}>
                <i className="fas fa-envelope" aria-hidden="true"></i> contact@trashdrops.com
              </a>
              <a href="tel:+233208401676" style={BTN.tonal}>
                <i className="fas fa-phone" aria-hidden="true"></i> +233 20 840 1676
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Related pages ─────────────────────────────────────────────────── */}
      <Section>
        <H2 center>Explore TrashDrop</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(220px,100%),1fr))', gap: 16, marginTop: 32 }}>
          {[
            { to: '/how-it-works/',   icon: 'fa-cogs',              title: 'How It Works',         body: 'Step-by-step guide to using TrashDrop for waste collection.' },
            { to: '/users/',          icon: 'fa-home',              title: 'For Households',        body: 'QR Bag System and Digital Bin — schedule your first pickup.' },
            { to: '/collectors/',     icon: 'fa-truck',             title: 'For Collectors',        body: 'Earn money collecting waste in Ghana with TrashDrop.' },
            { to: '/illegal-dumping/',icon: 'fa-exclamation-triangle', title: 'Report Illegal Dumping', body: 'Report dump sites and earn points for airtime or data once verified.' },
          ].map(link => (
            <Link key={link.to} to={link.to} style={{ ...cardStyle, padding: '24px 20px', textDecoration: 'none', display: 'block' }}>
              <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 10, background: '#e6f2e9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <i className={`fas ${link.icon}`} style={{ color: TD.forest, fontSize: 16 }}></i>
              </div>
              <h3 style={{ ...TYPE.body, fontWeight: 600, color: TD.ink, margin: '0 0 6px' }}>{link.title}</h3>
              <p style={{ ...TYPE.small, color: TD.sage, margin: 0 }}>{link.body}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <DarkCta title="Ready to get started?">
        <p style={{ ...TYPE.body, color: TD.sageOnDark, margin: '0 auto 32px', maxWidth: 480 }}>
          Join thousands of Ghanaian households and businesses already using TrashDrop. No download required.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={HOUSEHOLD_APP_URL} style={BTN.primaryOnDark}>Create free account</a>
          <Link to="/how-it-works/" style={BTN.ghostOnDark}>How it works</Link>
        </div>
      </DarkCta>
    </PublicPageLayout>
  );
};

export default FAQPage;
