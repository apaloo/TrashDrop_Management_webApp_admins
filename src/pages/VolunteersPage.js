import React from 'react';
import { Link } from 'react-router-dom';
import PublicPageLayout, { TD, FAQAccordion } from '../components/PublicPageLayout';
import { TYPE, BTN } from '../theme/brand';
import { Section, H2, P, linkStyle } from '../components/PublicSections';
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

const CtaButtons = ({ dark }) => (
  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
    <Link to="/signup?type=volunteer_group" style={dark ? BTN.primaryOnDark : BTN.primary}>
      Sign up your group
    </Link>
    <Link to="/illegal-dumping/" style={dark ? BTN.ghostOnDark : BTN.tonal}>
      <i className="fas fa-camera" aria-hidden="true"></i> Report illegal dumping
    </Link>
  </div>
);

const VolunteersPage = () => {
  useSeo({ ...VOLUNTEERS_SEO, jsonLd: [faqJsonLd(FAQ), organizationJsonLd()] });

  return (
    <PublicPageLayout>
      <style>{`
        @media(max-width:900px) {
          .td-vol-hero { grid-template-columns:1fr!important; gap:36px!important; }
          .td-vol-photos { max-width:480px; width:100%; margin:0 auto; }
        }
      `}</style>
      <section data-surface="dark" style={{ position:'relative', overflow:'hidden', background:TD.ink, padding:'calc(var(--td-header-h) + var(--td-section-y)) 24px var(--td-section-y)' }}>
        {/* The reported dump, faint behind everything */}
        <div aria-hidden="true" style={{ position:'absolute', inset:0, backgroundImage:'url(/images/volunteers/reported-dump.jpg)', backgroundSize:'cover', backgroundPosition:'center', opacity:0.16, filter:'blur(3px) saturate(0.8)', transform:'scale(1.05)' }} />
        <div aria-hidden="true" style={{ position:'absolute', inset:0, background:`linear-gradient(160deg,${TD.forestDk}e6 0%,#0d1a0de0 50%,${TD.ink} 100%)` }} />
        <div className="td-vol-hero" style={{ position:'relative', maxWidth:1200, margin:'0 auto', display:'grid', gridTemplateColumns:'1.1fr 0.9fr', gap:56, alignItems:'center' }}>
          <div>
            <nav aria-label="Breadcrumb" style={{ ...TYPE.small, color:TD.sageOnDark, marginBottom:20 }}>
              <Link to="/" style={{ color:TD.sageOnDark, textDecoration:'none' }}>Home</Link> / Environment / Volunteers
            </nav>
            <h1 style={{ ...TYPE.h1, color:'#f0f5f0', margin:'0 0 20px' }}>
              Volunteer Cleanups for Community Groups in Ghana
            </h1>
            <p style={{ ...TYPE.lead, fontWeight:600, color:TD.lime, margin:'0 0 16px' }}>
              Trash walk is a health walk — one photo, cleaner community.
            </p>
            <P dark>
              Residents report illegal dumping with a photo. The TrashDrop team verifies each report, and approved volunteer
              groups can claim the sites near them, clean them up and show the result with before-and-after photos.
            </P>
            <div style={{ marginTop:28 }}><CtaButtons dark /></div>
          </div>
          {/* From TrashDrop's own posts: a reported dump, then a cleaned street */}
          <div className="td-vol-photos" style={{ display:'grid', gridTemplateColumns:'1.35fr 1fr', gap:14, alignItems:'end' }}>
            <figure style={{ position:'relative', margin:0 }}>
              <img src="/images/volunteers/reported-dump.jpg" width="644" height="446" alt="Rubbish dumped on a pavement beside a road, reported with the TrashDrop app"
                style={{ width:'100%', height:300, objectFit:'cover', borderRadius:'var(--td-radius-card)', display:'block' }} />
              <figcaption style={{ position:'absolute', top:12, left:12, ...TYPE.small, fontWeight:600, color:'#fff', background:'rgba(10,15,10,0.8)', padding:'6px 12px', borderRadius:99 }}>Seen trash? Report it.</figcaption>
            </figure>
            <figure style={{ position:'relative', margin:0 }}>
              <img src="/images/volunteers/after-cleanup.jpg" width="338" height="718" alt="The same kind of street after a cleanup, with the pavement and gutter cleared"
                style={{ width:'100%', height:380, objectFit:'cover', borderRadius:'var(--td-radius-card)', border:`2px solid ${TD.lime}`, display:'block' }} />
              <figcaption style={{ position:'absolute', bottom:12, left:12, right:12, ...TYPE.small, fontWeight:600, color:TD.ink, background:TD.lime, padding:'6px 12px', borderRadius:99, textAlign:'center' }}>From dirty to clean.</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <Section>
        <H2>How a volunteer cleanup works</H2>
        <ol style={{ listStyle:'none', padding:0, margin:0, display:'grid', gap:14 }}>
          {STEPS.map(([t, d], i) => (
            <li key={t} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
              <span style={{ ...TYPE.small, fontWeight:700, color:'#fff', background:TD.forest, borderRadius:'50%', width:32, height:32, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>{i + 1}</span>
              <span style={{ ...TYPE.body, color:TD.sage }}>
                <strong style={{ color:TD.ink, fontWeight:600 }}>{t}.</strong> {d}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="white">
        <H2>Why clean up with TrashDrop</H2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:12 }}>
          {[
            ['Real sites, already checked', 'Every report your group sees has a photo and a location and has been verified by the TrashDrop team.'],
            ['No double work', 'A claimed site is yours. Other groups and collectors don’t see it until you finish or release it.'],
            ['Proof of your impact', 'Cleanup photos and the disposal record stay with each report, credited to your group.'],
          ].map(([t, d]) => (
            <div key={t} style={{ border:'1px solid var(--td-border)', borderRadius:'var(--td-radius-card)', padding:'20px', background:TD.cream }}>
              <h3 style={{ ...TYPE.body, fontWeight:600, color:TD.ink, margin:'0 0 4px' }}>{t}</h3>
              <p style={{ ...TYPE.small, color:TD.sage, margin:0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <H2>Not part of a group?</H2>
        <P>
          Anyone can help: take one photo of a dump site and <Link to="/illegal-dumping/" style={linkStyle}>report illegal dumping</Link>.
          See the reports and cleanups so far on the <Link to="/partners/#map" style={linkStyle}>live illegal dumping map</Link>,
          or <Link to="/collectors/" style={linkStyle}>earn as a TrashDrop carter</Link> if you want paid collection work.
        </P>
      </Section>

      <Section tone="white">
        <H2>Volunteer cleanup FAQ</H2>
        <FAQAccordion items={FAQ} surface="light" />
        <div style={{ marginTop:28 }}><CtaButtons /></div>
      </Section>
    </PublicPageLayout>
  );
};

export default VolunteersPage;
