import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../components/PublicPageLayout';
import { useSeo, faqJsonLd, organizationJsonLd } from '../utils/seo';

// For volunteer and community groups: targets "community cleanup" / "volunteer cleanup Ghana" searches.
export const VOLUNTEERS_SEO = {
  title: 'Volunteer Cleanups in Ghana – Community Groups | TrashDrop',
  description: 'Run community cleanups with TrashDrop. Approved volunteer groups claim verified illegal dumping reports near them, clean up and post before-and-after photos.',
  path: '/volunteers/',
};

const STEPS = [
  ['Sign up your group', 'Create a Volunteer / Community Group account. The TrashDrop team checks and approves it.'],
  ['See reports near you', 'Your group signs in to the TrashDrop collector app with one shared login and sees verified illegal dumping reports in its region that no one has taken yet.'],
  ['Claim a cleanup', 'Pick a site and claim it. Your group can hold up to 3 open cleanups at a time.'],
  ['Go and clean it up', 'Accept within 24 hours, navigate to the site and mark it complete once you are within 50 m of it, within 72 hours of claiming.'],
  ['Show the result', 'Upload cleanup photos and record where the waste was disposed of. The report shows the site as cleaned up by your group.'],
];

const FAQ = [
  { q: 'Who can join as a volunteer group?', a: 'Community groups, youth and church groups, schools, NGOs and other non-profits. Sign up as a Volunteer / Community Group or a Non-Profit Organization / NGO. The TrashDrop team approves each group before it can claim cleanups.' },
  { q: 'Does each member need an account?', a: 'No. A group uses one shared login in the TrashDrop collector app, so whoever is on site can accept, navigate and complete the cleanup.' },
  { q: 'Which sites can we clean up?', a: 'Illegal dumping reports that the TrashDrop team has verified, that are in your group’s region and that no collector or other group has taken yet.' },
  { q: 'What happens if we can’t finish a cleanup?', a: 'You can release the claim. A claim that isn’t accepted within 24 hours, or completed within 72 hours, goes back to the pool so another team can take it.' },
  { q: 'Do volunteers get paid pickup requests?', a: 'No. Volunteer groups only see illegal dumping cleanups. Paid household pickups go to TrashDrop carters — see Earn as Carter if you want to collect for pay.' },
  { q: 'How do people see our work?', a: 'Each completed cleanup keeps its before-and-after photos and records that your group cleaned it up. The site shows as cleaned up on the live illegal dumping map and counts towards TrashDrop’s environmental impact figures.' },
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
    <Link to="/signup?type=volunteer_group"
      style={{ ...FF.label, fontSize:14, fontWeight:700, background:TD.lime, color:TD.ink, padding:'14px 26px', borderRadius:10, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
      Sign up your group
    </Link>
    <Link to="/illegal-dumping/"
      style={{ ...FF.label, fontSize:14, fontWeight:700, color:'#fff', padding:'14px 26px', borderRadius:10, textDecoration:'none', border:'1.5px solid rgba(255,255,255,0.22)', display:'inline-flex', alignItems:'center', gap:8 }}>
      <i className="fas fa-camera"></i> Report illegal dumping
    </Link>
  </div>
);

const VolunteersPage = () => {
  useSeo({ ...VOLUNTEERS_SEO, jsonLd: [faqJsonLd(FAQ), organizationJsonLd()] });

  return (
    <PublicPageLayout>
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'140px 24px 72px' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <nav aria-label="Breadcrumb" style={{ ...FF.label, fontSize:12, color:'rgba(255,255,255,0.45)', marginBottom:20 }}>
            <Link to="/" style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none' }}>Home</Link> / Environment / Volunteers
          </nav>
          <h1 style={{ ...FF.display, fontSize:'clamp(36px,5vw,60px)', color:'#f0f5f0', lineHeight:1.05, letterSpacing:'-1.5px', margin:'0 0 24px' }}>
            Volunteer Cleanups for Community Groups in Ghana
          </h1>
          <p style={{ ...FF.display, fontStyle:'italic', fontSize:'clamp(18px,2.2vw,22px)', color:TD.lime, margin:'0 0 20px' }}>
            Trash walk is a health walk — one photo, cleaner community.
          </p>
          <P>
            Residents report illegal dumping with a photo. The TrashDrop team verifies each report, and approved volunteer
            groups can claim the sites near them, clean them up and show the result with before-and-after photos.
          </P>
          <div style={{ marginTop:28 }}><CtaButtons /></div>
        </div>
      </section>

      <Section bg={TD.ink2}>
        <H2>How a volunteer cleanup works</H2>
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

      <Section bg="#0c1a0c">
        <H2>Why clean up with TrashDrop</H2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          {[
            ['Real sites, already checked', 'Every report your group sees has a photo and a location and has been verified by the TrashDrop team.'],
            ['No double work', 'A claimed site is yours. Other groups and collectors don’t see it until you finish or release it.'],
            ['Proof of your impact', 'Cleanup photos and the disposal record stay with each report, credited to your group.'],
          ].map(([t, d]) => (
            <div key={t} style={{ border:`1px solid ${TD.lime}25`, borderRadius:14, padding:'16px 18px', background:'rgba(168,230,61,0.04)' }}>
              <h3 style={{ ...FF.label, fontSize:15, fontWeight:700, color:'#f0f5f0', margin:'0 0 4px' }}>{t}</h3>
              <p style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.6)', margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section bg={TD.ink2}>
        <H2>Not part of a group?</H2>
        <P>
          Anyone can help: take one photo of a dump site and <Link to="/illegal-dumping/" style={linkStyle}>report illegal dumping</Link>.
          See the reports and cleanups so far on the <Link to="/partners/#map" style={linkStyle}>live illegal dumping map</Link>,
          or <Link to="/collectors/" style={linkStyle}>earn as a TrashDrop carter</Link> if you want paid collection work.
        </P>
      </Section>

      <Section bg={TD.ink}>
        <H2>Volunteer cleanup FAQ</H2>
        <FAQAccordion items={FAQ} />
        <div style={{ marginTop:28 }}><CtaButtons /></div>
      </Section>
    </PublicPageLayout>
  );
};

export default VolunteersPage;
