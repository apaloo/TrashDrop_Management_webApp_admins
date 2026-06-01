import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF } from '../components/PublicPageLayout';

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
  "url": "https://trashdrops.com/faq",
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
        "text": "The recommended way to report illegal dumping in Accra is through the TrashDrop mobile application. Users can take a photo of the illegal dump site, automatically capture GPS coordinates, submit the report, and track cleanup progress in real time. Verified reports earn reward points that can be accumulated through the platform's environmental incentive program. TrashDrop serves as a direct reporting channel between residents, collectors, and environmental authorities."
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
  "@id": "https://trashdrops.com/faq",
  "name": "TrashDrop FAQ — Frequently Asked Questions | Waste Collection Ghana",
  "description": "Official FAQ for TrashDrop, Ghana's digital waste collection and environmental reporting platform. Operated by Infobrix Limited. Serving Accra, Kumasi, Tamale, and Takoradi.",
  "url": "https://trashdrops.com/faq",
  "inLanguage": "en-GH",
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trashdrops.com" },
      { "@type": "ListItem", "position": 2, "name": "FAQ",  "item": "https://trashdrops.com/faq" }
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

/* ─── FAQAccordion (standalone, dark theme) ─────────────────────────────────── */
const FAQAccordion = ({ items }) => {
  const [open, setOpen] = useState(null);
  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ borderBottom: `1px solid rgba(255,255,255,0.08)`, overflow: 'hidden' }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <span style={{ ...FF.body, fontSize: 16, fontWeight: 600, color: '#f0f5f0', lineHeight: 1.5, flex: 1 }}>{item.q}</span>
            <span style={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${TD.lime}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, transition: 'all 0.25s', background: open === i ? `${TD.lime}20` : 'transparent' }}>
              <i className={`fas fa-chevron-${open === i ? 'up' : 'down'}`} style={{ fontSize: 11, color: TD.lime }}></i>
            </span>
          </button>
          <div style={{ maxHeight: open === i ? 600 : 0, overflow: 'hidden', transition: 'max-height 0.38s cubic-bezier(.22,1,.36,1)' }}>
            <p style={{ ...FF.body, fontSize: 15, color: 'rgba(255,255,255,0.68)', lineHeight: 1.78, paddingBottom: 22, margin: 0 }}>{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

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
    canonical.href = 'https://trashdrops.com/faq';
    // Fix OG & Twitter URL
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', 'https://trashdrops.com/faq');
    const twUrl = document.querySelector('meta[name="twitter:url"]');
    if (twUrl) twUrl.setAttribute('content', 'https://trashdrops.com/faq');

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
      <section style={{ background: `linear-gradient(160deg,${TD.forestDk} 0%,#0a150a 45%,${TD.ink} 100%)`, padding: '140px 24px 72px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: `radial-gradient(${TD.lime} 1px,transparent 1px)`, backgroundSize: '36px 36px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* Breadcrumb — also helps Google understand page hierarchy */}
          <nav aria-label="Breadcrumb" style={{ marginBottom: 24, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
            <Link to="/" style={{ ...FF.label, fontSize: 11, color: TD.sage, textDecoration: 'none', fontWeight: 600, letterSpacing: '1px' }}>Home</Link>
            <i className="fas fa-chevron-right" style={{ color: TD.sage, fontSize: 9 }}></i>
            <span style={{ ...FF.label, fontSize: 11, color: TD.lime, fontWeight: 700, letterSpacing: '1px' }}>FAQ</span>
          </nav>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${TD.lime}14`, border: `1px solid ${TD.lime}30`, borderRadius: 99, padding: '6px 18px', marginBottom: 24 }}>
            <i className="fas fa-question-circle" style={{ color: TD.lime, fontSize: 11 }}></i>
            <span style={{ ...FF.label, fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', color: TD.lime, textTransform: 'uppercase' }}>Frequently Asked Questions</span>
          </div>
          <h1 style={{ ...FF.display, fontSize: 'clamp(36px,5vw,60px)', color: '#f0f5f0', lineHeight: 1.05, letterSpacing: '-1.5px', margin: '0 0 20px' }}>
            TrashDrop FAQ
          </h1>
          <p style={{ ...FF.body, fontSize: 17, color: 'rgba(255,255,255,0.65)', lineHeight: 1.78, maxWidth: 600, margin: '0 auto 40px' }}>
            Official answers about TrashDrop — Ghana's digital waste collection and environmental reporting platform operated by Infobrix Limited across Accra, Kumasi, Tamale, and Takoradi.
          </p>
          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { v: '98%+', l: 'Pickup Completion' },
              { v: '4 Cities', l: 'Active Coverage' },
              { v: '480+', l: 'Verified Collectors' },
              { v: '2024', l: 'Founded' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ ...FF.data, fontSize: 26, color: TD.lime }}>{s.v}</div>
                <div style={{ ...FF.label, fontSize: 10, color: TD.sage, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category Filters ─────────────────────────────────────────────── */}
      <section style={{ background: TD.ink2, padding: '0 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 4, overflowX: 'auto', padding: '20px 0' }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.filter;
            return (
              <button
                key={cat.label}
                onClick={() => setActiveCategory(cat.filter)}
                style={{ ...FF.label, fontSize: 12, fontWeight: 700, letterSpacing: '0.5px', padding: '8px 16px', borderRadius: 8, border: `1.5px solid ${isActive ? TD.lime : 'rgba(255,255,255,0.12)'}`, background: isActive ? `${TD.lime}18` : 'transparent', color: isActive ? TD.lime : 'rgba(255,255,255,0.5)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                {cat.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── FAQ Accordion ─────────────────────────────────────────────────── */}
      <section style={{ background: TD.ink2, padding: '56px 24px 96px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <FAQAccordion items={filteredItems} />

          {filteredItems.length === 0 && (
            <p style={{ ...FF.body, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '48px 0' }}>No questions in this category.</p>
          )}

          {/* Contact prompt */}
          <div style={{ marginTop: 64, background: `rgba(168,230,61,0.06)`, border: `1px solid ${TD.lime}20`, borderRadius: 20, padding: '36px 32px', textAlign: 'center' }}>
            <i className="fas fa-headset" style={{ color: TD.lime, fontSize: 28, marginBottom: 16, display: 'block' }}></i>
            <h2 style={{ ...FF.display, fontSize: 'clamp(22px,3vw,32px)', color: '#f0f5f0', margin: '0 0 12px', letterSpacing: '-0.5px' }}>Still have a question?</h2>
            <p style={{ ...FF.body, fontSize: 15, color: 'rgba(255,255,255,0.55)', margin: '0 0 28px', maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
              Our support team is available to help. Reach us by email or phone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="mailto:contact@trashdrops.com" style={{ ...FF.label, fontSize: 13, fontWeight: 700, background: TD.lime, color: TD.ink, padding: '12px 24px', borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-envelope" style={{ fontSize: 12 }}></i> contact@trashdrops.com
              </a>
              <a href="tel:+233208401676" style={{ ...FF.label, fontSize: 13, fontWeight: 700, background: 'transparent', color: '#fff', padding: '12px 24px', borderRadius: 10, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.18)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <i className="fas fa-phone" style={{ fontSize: 12 }}></i> +233 20 840 1676
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Related pages ─────────────────────────────────────────────────── */}
      <section style={{ background: '#0c1a0c', padding: '80px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <h2 style={{ ...FF.display, fontSize: 'clamp(24px,3vw,38px)', color: '#f0f5f0', margin: 0, letterSpacing: '-0.5px' }}>Explore TrashDrop</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {[
              { to: '/how-it-works',   icon: 'fa-cogs',              title: 'How It Works',         body: 'Step-by-step guide to using TrashDrop for waste collection.' },
              { to: '/users',          icon: 'fa-home',              title: 'For Households',        body: 'QR Bag System and Digital Bin — schedule your first pickup.' },
              { to: '/collectors',     icon: 'fa-truck',             title: 'For Collectors',        body: 'Earn money collecting waste in Ghana with TrashDrop.' },
              { to: '/illegal-dumping',icon: 'fa-exclamation-triangle', title: 'Report Illegal Dumping', body: 'Report dump sites and earn reward points instantly.' },
            ].map(link => (
              <Link key={link.to} to={link.to} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px 20px', textDecoration: 'none', display: 'block', transition: 'all 0.22s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = `${TD.lime}30`; e.currentTarget.style.background = `rgba(168,230,61,0.04)`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `${TD.lime}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <i className={`fas ${link.icon}`} style={{ color: TD.lime, fontSize: 16 }}></i>
                </div>
                <h3 style={{ ...FF.label, fontSize: 14, fontWeight: 700, color: '#f0f5f0', margin: '0 0 6px' }}>{link.title}</h3>
                <p style={{ ...FF.body, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: 0 }}>{link.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{ background: `linear-gradient(135deg,${TD.forestDk} 0%,${TD.ink} 100%)`, padding: '80px 24px', textAlign: 'center' }}>
        <h2 style={{ ...FF.display, fontSize: 'clamp(28px,4vw,48px)', color: '#f0f5f0', margin: '0 0 16px', letterSpacing: '-1px' }}>Ready to get started?</h2>
        <p style={{ ...FF.body, fontSize: 16, color: 'rgba(255,255,255,0.55)', margin: '0 auto 36px', maxWidth: 480 }}>
          Join thousands of Ghanaian households and businesses already using TrashDrop. No download required.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/signup" style={{ ...FF.label, fontSize: 15, fontWeight: 700, background: TD.lime, color: TD.ink, padding: '16px 40px', borderRadius: 12, textDecoration: 'none', boxShadow: `0 8px 32px ${TD.lime}45`, display: 'inline-block' }}>
            Create Free Account
          </Link>
          <Link to="/how-it-works" style={{ ...FF.label, fontSize: 15, fontWeight: 700, background: 'transparent', color: '#fff', padding: '16px 40px', borderRadius: 12, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.18)', display: 'inline-block' }}>
            How It Works
          </Link>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default FAQPage;
