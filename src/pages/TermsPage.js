import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage from '../components/LegalPage';

const CONTACT = 'hello@trashdrops.com';

const SECTIONS = [
  { id:'agreement', title:'About these terms', body:(<>
    <p>These terms are an agreement between you and <strong>Infobrix Limited</strong>, Accra, Ghana, which runs TrashDrop ("TrashDrop", "we", "us"). They apply when you use the TrashDrop website (trashdrops.com), the household app (app.trashdrops.com) or the collector app. By creating an account or using TrashDrop you accept them. If you do not agree, please do not use TrashDrop.</p>
    <p>How we handle personal data is explained in our <Link to="/privacy/">Privacy Policy</Link>.</p>
  </>) },
  { id:'accounts', title:'Your account', body:(<>
    <ul>
      <li>You must be 18 or over, or use TrashDrop with a parent or guardian's permission.</li>
      <li>Give accurate details and keep them up to date, especially your pickup address and phone number.</li>
      <li>Keep your password private. You are responsible for what happens in your account. Tell us at once if you think someone else is using it.</li>
      <li>One person, one account, unless we agree otherwise (for example a business or volunteer group account).</li>
    </ul>
  </>) },
  { id:'pickups', title:'Pickups, bags and Digital Bins', body:(<>
    <ul>
      <li><strong>QR bags:</strong> official TrashDrop bags are bought from authorised vendors. Scanning a bag's QR code registers it to your account, and registered bags are collected without a further charge.</li>
      <li><strong>Digital Bin:</strong> the app shows the price before you confirm a request. You pay the collector at collection, by mobile money or cash, as shown in the app.</li>
      <li>Put out only the waste you described. Collectors may refuse waste that is unsafe or not what was booked (for example hazardous waste booked as general waste).</li>
      <li>Pickup times depend on collector availability, weather and access to your location; we do not guarantee a time. You can cancel a request in the app before it is collected.</li>
    </ul>
  </>) },
  { id:'reports', title:'Illegal dumping reports', body:(<>
    <ul>
      <li>Report only real illegal dumping that you have seen, with your own photos taken at the site.</li>
      <li>Do not put yourself or others at risk to take a photo, and do not photograph people's faces or private property more than you need to show the dumping.</li>
      <li>By sending a report you allow TrashDrop to use its photos and details to get the site cleaned up: we share them with cleanup teams, volunteer groups and district assemblies, and may use them, without your details, in statistics and in our own communications.</li>
      <li>False, copied or misleading reports may be removed, and may lead to points being taken back and the account being closed.</li>
    </ul>
  </>) },
  { id:'points', title:'Points and rewards', body:(<>
    <ul>
      <li>You earn points in the app for pickups, for scanning your bags' QR codes, and for illegal dumping reports once our team has verified them (10, 15 or 20 points depending on how serious the dumping is).</li>
      <li>Points can be swapped in the app for mobile airtime or data on MTN, Telecel or AirtelTigo, at 200 points = GH₵1, for the rewards shown in the app (currently GH₵5, GH₵10 or GH₵20). TrashDrop sends each reward to the number and network you choose.</li>
      <li>Check the number and network before you redeem. If we cannot send a reward (for example the number is wrong) we may reject it and return the points.</li>
      <li>Points have no cash value, cannot be sold or transferred, and are not your property. We may change the points, the rewards and the rate, or end the programme, by updating the app; rewards already marked Sent are not affected.</li>
      <li>We may withhold or remove points earned by misuse, such as false reports, duplicate accounts or automated activity.</li>
    </ul>
  </>) },
  { id:'collectors', title:'Collectors', body:(<>
    <p>If you work as a TrashDrop collector, you must give true identity and vehicle details, hold any licences the law requires, collect and dispose of waste only at authorised sites, and treat customers and their property with care. Collectors are paid for completed pickups as shown in the collector app. We may suspend or close collector accounts that break these terms or the law.</p>
  </>) },
  { id:'acceptable-use', title:'Using TrashDrop fairly', body:(<>
    <p>Do not misuse TrashDrop: no false information, no harassment of collectors, customers or staff, no attempts to get into accounts or parts of the service that are not yours, no copying or overloading the service, and nothing illegal.</p>
  </>) },
  { id:'availability', title:'Availability and changes', body:(<>
    <p>We work to keep TrashDrop running, but it may sometimes be unavailable or change. We may add, change or remove features, and update these terms. We will show the new date at the top of this page and tell you about important changes in the app or by email. If you keep using TrashDrop after a change, the new terms apply.</p>
  </>) },
  { id:'liability', title:'Our responsibility to you', body:(<>
    <p>We provide TrashDrop with reasonable care and skill. As far as the law allows, we are not responsible for losses that were not foreseeable, for problems caused by things outside our reasonable control, or for a district assembly's or other third party's actions after a report. Nothing in these terms limits rights you have under Ghanaian law that cannot be limited.</p>
  </>) },
  { id:'ending', title:'Closing your account', body:(<>
    <p>You can stop using TrashDrop at any time and ask us to close your account by emailing <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We may suspend or close an account that breaks these terms. Points that have not been redeemed end when an account is closed.</p>
  </>) },
  { id:'law', title:'Law and disputes', body:(<>
    <p>These terms are governed by the laws of Ghana. If you have a problem, please contact us first so we can try to put it right. Disputes that cannot be settled that way go to the courts of Ghana.</p>
  </>) },
  { id:'contact', title:'Contact us', body:(<>
    <p>Infobrix Limited (TrashDrop), Accra, Ghana. Email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
  </>) },
];

const TermsPage = () => (
  <LegalPage
    path="/terms/"
    title="Terms of Service"
    eyebrow="Legal"
    metaTitle="Terms of Service | TrashDrop"
    description="The terms for using TrashDrop's website, household app and collector app in Ghana: accounts, pickups, illegal dumping reports, points and airtime rewards, and collectors."
    updated="30 October 2026"
    intro="These terms set out how TrashDrop works and what we and you agree to when you use our website and apps, including pickups, illegal dumping reports, and points and rewards."
    sections={SECTIONS}
  />
);

export default TermsPage;
