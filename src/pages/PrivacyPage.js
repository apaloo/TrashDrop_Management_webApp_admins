import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

// What TrashDrop's apps actually collect and share. Keep in step with the apps
// (household app, collector app, this admin site) when they change.
const CONTACT = 'hello@trashdrops.com';

const SECTIONS = [
  { id:'who-we-are', title:'Who we are', body:(<>
    <p>TrashDrop is run by <strong>Infobrix Limited</strong>, Accra, Ghana ("TrashDrop", "we", "us"). This policy covers the TrashDrop website (trashdrops.com), the household app (app.trashdrops.com), the collector app, and the TrashDrop dashboard used by our staff and partners.</p>
    <p>We are the data controller for the personal data described here. Questions or requests: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
  </>) },
  { id:'what-we-collect', title:'What we collect', body:(<>
    <p><strong>Your account.</strong> Your name, email address, phone number and password, or, if you sign in with Google, the name, email address and profile picture Google shares with us. We never see your Google password.</p>
    <p><strong>Pickups and bins.</strong> Your pickup address and its map location, saved locations, the number of bags, the waste type, notes for the collector, and the status, price and payment method of each pickup or Digital Bin.</p>
    <p><strong>Illegal dumping reports.</strong> The photos you take, the location, the waste type, the severity, any description, and the date and time.</p>
    <p><strong>QR bags.</strong> The bag codes you scan and when.</p>
    <p><strong>Rewards.</strong> Your points, what you earned them for, the rewards you redeem, and the phone number and mobile network you give us for airtime or data.</p>
    <p><strong>Collectors.</strong> If you work as a TrashDrop collector: your identity and vehicle details, the documents and photos you upload during sign-up, your location while you are on duty, the jobs you accept and complete, and your earnings.</p>
    <p><strong>Settings and device.</strong> Your app settings (such as dark mode and larger text), and basic technical information your browser sends, such as device type and error reports.</p>
  </>) },
  { id:'how-we-use-it', title:'How we use it', body:(<>
    <ul>
      <li>To run the service: match pickups with collectors, show collectors where to go, track pickups, price Digital Bin requests and record payments.</li>
      <li>To pass illegal dumping reports to the cleanup teams and authorities who deal with them, and to verify reports before they earn points.</li>
      <li>To keep your points and send the rewards you redeem.</li>
      <li>To keep your account secure, prevent fraud and misuse (for example made-up reports), and fix problems.</li>
      <li>To contact you about your pickups, reports, rewards and account.</li>
      <li>To produce statistics about waste and illegal dumping. Statistics we publish never identify you.</li>
      <li>To meet our legal obligations.</li>
    </ul>
    <p>We use your data because we need it to provide the service you asked for, because you agreed, because the law requires it, or for our legitimate interest in running a safe and working service.</p>
  </>) },
  { id:'who-sees-it', title:'Who sees your information', body:(<>
    <ul>
      <li><strong>Collectors</strong> see what they need to do a pickup: your pickup location and the details of the request.</li>
      <li><strong>Illegal dumping reports</strong> (photos, location, waste type) are seen by our team, the volunteer groups and cleanup teams working on that site, and the district assembly (MMDA) for that area. TrashDrop staff and district assembly officials may also see who sent a report so they can follow up. Media partners see report data without the reporter's details.</li>
      <li><strong>Service providers</strong> who host and run TrashDrop for us: Supabase (database, sign-in and file storage), Netlify (website hosting), Google (Sign in with Google, if you use it) and map providers (map tiles). They process data only on our instructions.</li>
      <li><strong>Mobile networks</strong> receive the phone number we top up when we send airtime or data you redeemed.</li>
      <li><strong>Authorities</strong>, when the law requires it.</li>
    </ul>
    <p>We do not sell your personal data.</p>
  </>) },
  { id:'location', title:'Location', body:(<>
    <p>The household app uses your location to set your pickup address and to place illegal dumping reports, only when you use those features. The collector app uses a collector's location while they are on duty, to show nearby jobs and guide them. You can turn location off in your phone's settings; some features will not work without it.</p>
  </>) },
  { id:'cookies', title:'Cookies and storage on your device', body:(<>
    <p>Our websites and apps store a few things in your browser so they work: your sign-in session, your settings, and copies of pages and data so the app opens quickly and works offline. These are needed for the service and are not used for advertising. We do not use advertising or cross-site tracking cookies.</p>
    <p>You can clear them in your browser settings at any time. You will then be signed out.</p>
  </>) },
  { id:'how-long', title:'How long we keep it', body:(<>
    <p>We keep your account information while your account is open. We keep records of pickups, payments, reports and rewards for as long as we need them to run the service and to meet legal and accounting obligations. When we no longer need personal data we delete it or make it anonymous.</p>
  </>) },
  { id:'security', title:'Security', body:(<>
    <p>Data is sent over encrypted connections (HTTPS) and access is limited by role: each person, collector and staff member sees only what their role needs. No system is completely secure, so please keep your password private and tell us if you think your account has been misused.</p>
  </>) },
  { id:'your-rights', title:'Your rights', body:(<>
    <p>Under Ghana's Data Protection Act, 2012 (Act 843) you can ask us for a copy of your personal data, ask us to correct or delete it, and object to how we use it. You can update most details yourself in the app under Profile. For anything else, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will reply within 30 days.</p>
    <p>If you are not satisfied with our answer, you can complain to Ghana's Data Protection Commission.</p>
  </>) },
  { id:'international', title:'Where your data is stored', body:(<>
    <p>Our service providers may store and process data on servers outside Ghana. We use providers that protect personal data to recognised standards.</p>
  </>) },
  { id:'children', title:'Children', body:(<>
    <p>TrashDrop accounts are for people aged 18 or over, or younger people using TrashDrop with a parent or guardian's permission. We do not knowingly collect data from children without that permission.</p>
  </>) },
  { id:'changes', title:'Changes to this policy', body:(<>
    <p>We may update this policy as TrashDrop changes. We will show the new date at the top of this page, and tell you in the app or by email about important changes.</p>
  </>) },
  { id:'contact', title:'Contact us', body:(<>
    <p>Infobrix Limited (TrashDrop), Accra, Ghana. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. See also our <Link to="/terms/">Terms of Service</Link>.</p>
  </>) },
];

const PrivacyPage = () => (
  <LegalPage
    path="/privacy/"
    title="Privacy Policy"
    eyebrow="Legal"
    metaTitle="Privacy Policy | TrashDrop"
    description="How TrashDrop (Infobrix Limited) collects, uses, shares and protects personal data in the TrashDrop website, household app and collector app, and your rights under Ghana's Data Protection Act."
    updated="30 October 2026"
    intro="This policy explains what personal data TrashDrop collects when you use our website and apps, what we do with it, who sees it, and the choices and rights you have."
    sections={SECTIONS}
  />
);

export default PrivacyPage;
