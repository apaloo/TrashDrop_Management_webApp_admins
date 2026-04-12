import React, { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import PublicPageLayout, { TD, FF, FAQAccordion } from '../../components/PublicPageLayout';
import { BLOG_POSTS } from '../BlogPage';

/* ────────────────────────────────────────────────────────────────────────────
   All 8 blog post contents
─────────────────────────────────────────────────────────────────────────────*/

const POST_CONTENT = {

  /* ── POST 1 ── */
  'how-much-can-a-waste-collector-earn-accra': {
    title:    'How Much Can a Waste Collector Earn in Accra?',
    keyword:  'earn money collecting waste Ghana',
    description: 'Waste collectors in Accra earn an average of ₵32.43 per pickup with TrashDrop. Full guide to earnings, MoMo cashouts, and how to maximise income as a carter in Ghana.',
    faq: [
      { q:'How much does a TrashDrop collector earn per month?', a:'A full-time collector completing 8–12 pickups per day, five days a week, earns between ₵2,500 and ₵8,000 per month, not including surge bonuses, tips, and recyclable revenue shares.' },
      { q:'When are earnings paid out?', a:'Earnings are credited to your available balance immediately after the disposal step is confirmed at an authorised site. You can cash out to MoMo at any time with a minimum of ₵10 and a daily maximum of ₵5,000.' },
      { q:'What is the surge multiplier?', a:'During high-demand periods — typically weekday mornings and weekend afternoons — TrashDrop applies a surge multiplier of up to 3× the base collection fee to attract collectors to busy areas.' },
      { q:'Do I keep 100% of tips?', a:'Yes. TrashDrop takes nothing from customer tips. 100% of any tip added by a user goes directly to the collector.' },
      { q:'What are authority assignments?', a:'Authority assignments are municipal contracts for illegal dump site cleanups, construction debris, and industrial waste collection. They pay ₵50–₵500 per assignment and are listed in the Assign tab of the Carter App.' },
    ],
    sections: [
      { h2:'The TrashDrop earnings formula', body:'Every completed pickup on TrashDrop is paid at a calculated rate combining a core collection fee, any active surges, bonuses for urgent requests, tips, and your share of recyclable material value. The platform is fully transparent — you see the estimated earnings before accepting any job.' },
      { h2:'Core collection fee', body:'The base fee for a completed pickup is calculated based on waste volume, type, and distance to the nearest authorised disposal site. TrashDrop publishes the fee schedule in the Carter App. Collectors see the fee before accepting.' },
      { h2:'Urgent request bonus', body:'When a user marks a pickup as urgent, an express surcharge of 30% is added to the base fee. This surcharge is paid entirely to the collector as an incentive to prioritise urgent requests. Urgent jobs appear highlighted in the app.' },
      { h2:'Surge multiplier (up to 3×)', body:'During peak demand periods — typically weekday mornings between 07:00–10:00 and weekend afternoons — TrashDrop activates a surge pricing multiplier of up to 3× the base fee. Active surges are shown on the map in real time so you can position yourself for maximum earnings.' },
      { h2:'Tips (100% yours)', body:'Users can add a tip when rating a completed pickup. TrashDrop does not deduct anything from tips — 100% goes directly to your mobile money wallet. Providing excellent service — arriving on time, taking proper evidence photos, being respectful — consistently results in higher tips.' },
      { h2:'Recyclables revenue (60% yours)', body:'When recyclable materials (plastic, metal, glass, paper) are identified in your collected waste and sold to licensed recycling facilities, you receive 60% of the materials revenue. You keep more of the value you create.' },
      { h2:'Real example: full earnings breakdown', body:'Example calculation for a full working day in Accra: 10 pickups × ₵32.43 average = ₵324.30 base. Add 2 urgent bonuses (₵12), 3 tips (₵18), and recyclables share (₵9) = ₵363.30 for the day, or approximately ₵7,266/month working 5 days/week.' },
      { h2:'Best hours for surge pricing', body:'Based on platform data across Accra, the highest surge frequencies occur: weekday mornings (07:00–10:00), Friday afternoons (14:00–18:00), and Saturday mornings. Positioning near high-density residential areas like East Legon, Madina, and Spintex during these windows maximises earnings.' },
      { h2:'How to cash out to MoMo', body:'Open the Carter App wallet section, enter the amount (minimum ₵10, maximum ₵5,000 per day), select your MoMo provider (MTN, Vodafone, or AirtelTigo), and confirm. Funds arrive instantly. There is no fee for standard cashouts.' },
    ],
  },

  /* ── POST 2 ── */
  'how-to-report-illegal-dumping-ghana': {
    title:    'How to Report Illegal Dumping in Ghana',
    keyword:  'report illegal dumping Ghana',
    description: 'Report illegal dumping in Ghana in under 2 minutes using the TrashDrop app. GPS-documented, photo-evidenced reports routed to municipal authorities. Earn reward points for every valid report.',
    faq: [
      { q:'Is illegal dumping a crime in Ghana?', a:"Yes. Ghana's Environmental Sanitation Law (Act 490) makes illegal dumping a fineable offence. Environmental Health Officers can issue fines and prosecute offenders." },
      { q:'What information do I need to submit a report?', a:'You need at least one clear photo of the dump site and your GPS location (captured automatically by the app). Optionally you can add a description of the waste type and approximate volume.' },
      { q:'How long does it take for cleanup after reporting?', a:'TrashDrop routes reports to the relevant municipal authority within the hour. Licensed cleanup teams are typically dispatched within 24 hours for verified high-priority reports.' },
      { q:'Can I report from outside Ghana?', a:'Yes. If you are visiting Ghana or have knowledge of a dump site, you can submit a report. The GPS coordinates are captured from the location where the photos were taken, not from where you are browsing.' },
      { q:'What is the reward for reporting?', a:'You earn reward points immediately upon submitting a valid report. Points can be redeemed for discounts on future pickups or donated to community environmental projects.' },
    ],
    sections: [
      { h2:'The scale of illegal dumping in Ghana', body:'Ghana generates over 12 million tonnes of solid waste annually. Estimates from the Ghana Statistical Service suggest that less than 60% of urban waste is formally collected, with the remainder ending up in unauthorised dump sites — on roadsides, in drainage channels, on community land, and in waterways.' },
      { h2:"What Ghana law says", body:"Under the Environmental Sanitation Policy and Act 490, the disposal of solid waste anywhere other than a designated, licensed facility is an offence. Penalties include fines and, for persistent or large-scale offenders, prosecution. Municipal and Metropolitan District Assemblies have Environmental Health Officers empowered to enforce these laws." },
      { h2:'How to report with TrashDrop (step by step)', body:'1. Open trashdrops.com on your phone browser. 2. Tap "Report Illegal Dumping" from the home screen. 3. Photograph the dump site — minimum one clear photo, multiple photos increase priority. 4. Allow the app to capture your GPS coordinates. 5. Optionally describe the waste type and estimated volume. 6. Tap Submit. Your report is logged with timestamp, coordinates, and photos.' },
      { h2:'What happens after you report', body:'TrashDrop routes the report to the relevant Municipal District Assembly and environmental enforcement unit. You receive a reference number for tracking. Licensed cleanup teams are allocated within 24 hours for verified high-priority reports. You can track cleanup status directly in the app.' },
      { h2:'Earning points for your report', body:'Points are credited immediately upon submission of a valid report. The point value depends on the severity classification of the dump site. Points can be redeemed at checkout for discounts on your next pickup request, or donated to a community environmental fund of your choice.' },
      { h2:'Illegal dumping hotspots in Accra', body:"Based on reports submitted through TrashDrop, the highest concentration of illegal dump sites in Accra is found along drainage corridors in Madina, Dome, and Taifa; informal markets in Ashaiman; and construction zones in Tema. These areas have active cleanup contracts with the Ga East Municipal Assembly and AMA." },
      { h2:'How municipal authorities respond', body:"TrashDrop's reports provide Environmental Health Officers with GPS-verified, photo-documented evidence — bypassing the usual process of manual site inspection and enabling faster enforcement action. In pilot partnerships with Ga East Municipal Assembly and Accra Metropolitan Assembly, TrashDrop-reported sites are cleared on average 40% faster than self-reported sites." },
    ],
  },

  /* ── POST 3 ── */
  'complete-guide-waste-segregation-ghana': {
    title:    'The Complete Guide to Waste Segregation in Ghana',
    keyword:  'waste segregation Ghana / recycling Ghana',
    description: 'How to segregate waste in Ghana for households and businesses. Recyclables, hazardous materials, organic waste — and how TrashDrop rewards proper separation.',
    faq: [
      { q:'Why does waste segregation matter in Ghana?', a:'Proper segregation reduces the volume of waste going to already-strained municipal landfills, increases the quantity of materials available for recycling, and on TrashDrop it earns you more reward points and contributes to your collector\'s recyclables revenue.' },
      { q:'What should I separate from general waste?', a:'Separate plastic, metal, glass, and paper (recyclables); food scraps and garden waste (organic/compostable); and batteries, electronics, chemicals, and medical waste (hazardous). Keep each stream in a separate bag or bin.' },
      { q:'Does TrashDrop charge more for hazardous waste?', a:'Yes. Hazardous waste pickups require the special handling option when booking, which carries an additional handling fee. This covers the cost of correct disposal at a licensed hazardous waste facility.' },
      { q:'How does segregation affect my TrashDrop bill?', a:'Properly segregated recyclable waste earns you higher reward points. For Digital Bin pickups, the price quote reflects the waste type declared — recyclables are typically priced lower than general or hazardous waste.' },
      { q:'Can schools and businesses arrange bulk segregated collection?', a:'Yes. TrashDrop supports bulk collection for schools, offices, and businesses. Declare the waste types and estimated volume in your Digital Bin request. For regular large-volume collection, contact TrashDrop directly for a commercial arrangement.' },
    ],
    sections: [
      { h2:'Why segregation matters in Ghana', body:"Ghana's primary landfills — Kpone Landfill in Tema and Oblogo in Accra — are approaching capacity. Increasing the proportion of waste that goes to recycling or composting instead of landfill directly extends the lifespan of these facilities and reduces the pressure to create new illegal dump sites." },
      { h2:'What counts as recyclable', body:'Recyclable waste includes: rigid plastics (bottles, containers, packaging); metals (aluminium cans, tin cans, copper wire); glass (bottles and jars — NOT broken glass); and paper and cardboard (clean, dry only — not food-contaminated). In Ghana, these materials are collected by licensed recycling companies including Jekora Ventures and Trashy Bags.' },
      { h2:'What counts as hazardous', body:'Hazardous waste includes batteries, mobile phones and electronics (e-waste), paint, solvents, chemicals, pesticides, medical waste, and fluorescent light tubes. These must never be mixed with general waste as they contaminate landfill leachate and can enter groundwater.' },
      { h2:'How TrashDrop handles different waste types', body:'When booking a pickup, select the waste type that matches your primary waste stream. For mixed loads, select the dominant type. For hazardous waste, always select the Special Handling option. TrashDrop routes your request to collectors with the appropriate vehicle and disposal site certification.' },
      { h2:'How segregation affects your bill', body:'For Digital Bin pickups: recyclables are priced lower than general waste, which is priced lower than hazardous waste. Properly declaring and separating your waste results in a lower quote and higher reward points. For QR Bag System users, reward point multipliers are higher for pickups where recyclables are correctly separated.' },
      { h2:'Practical home setup', body:'A three-bin system works well for Ghanaian households: one bin for recyclables (lined with a TrashDrop bag), one for general organic waste, and a sealed container for hazardous items. Label each clearly. Flatten cardboard and plastic bottles to reduce volume. Keep recyclables dry — wet recyclables have lower market value.' },
      { h2:'Schools and businesses: bulk tips', body:'For schools and offices, designate a segregation station near the entrance or kitchen. Use colour-coded bags: green for recyclables, black for general waste, red for hazardous. Brief staff or students weekly on what goes where. TrashDrop can arrange scheduled weekly collection for high-volume commercial accounts.' },
    ],
  },

  /* ── POST 4 ── */
  'how-trashdrop-qr-bag-system-works': {
    title:    'How the TrashDrop QR Bag System Works',
    keyword:  'QR trash bag Ghana',
    description: 'Complete walkthrough of the TrashDrop QR Bag System — where to buy bags in Ghana, how to activate with QR scan, request free pickup, and track collection in real time.',
    faq: [
      { q:'Where can I buy TrashDrop bags?', a:'Official TrashDrop bags are available from authorised vendors across Accra, Kumasi, Takoradi and Tamale. Use the vendor locator in the TrashDrop app at trashdrops.com to find the nearest outlet.' },
      { q:'How do I activate the bags with the QR code?', a:'Open the TrashDrop app at trashdrops.com, tap the QR scanner icon, and scan the QR code on your bag bundle. This registers the bags to your account and adds them to your inventory.' },
      { q:'Is pickup really free with the QR bag system?', a:'Yes. Once bags are registered to your account, requesting a pickup is completely free. You only pay when purchasing the bags themselves from authorised vendors.' },
      { q:'What if my QR code does not scan?', a:'Ensure the code is undamaged and well-lit. Clean the code with a dry cloth. If it still does not scan, tap "Manual Entry" in the app and enter the printed code number, or contact TrashDrop support at trashdrops.com.' },
      { q:'How does the collector verify my bags on arrival?', a:'The collector scans the same QR code printed on your bag bundle when they arrive. This confirms the bags are registered to a legitimate account, logs the GPS location of the collection, and initiates the payment process.' },
    ],
    sections: [
      { h2:'Where to buy TrashDrop bags', body:'Official TrashDrop QR bags are sold by authorised vendors — small shops, market traders, and convenience stores — across Accra, Kumasi, Takoradi and Tamale. Use the vendor locator feature in the TrashDrop app to find the nearest outlet. Bags are sold in bundles of 5 and 10.' },
      { h2:'How to activate with QR scan', body:'Each bag bundle comes with a unique QR code printed on the packaging. Open the TrashDrop app at trashdrops.com, tap "Activate Bags," point your camera at the QR code, and tap the confirmation button. The bags are instantly added to your account inventory. You can activate multiple bundles at any time.' },
      { h2:'Requesting a free pickup', body:'When your bags are full, open the app, tap "Request Pickup," select the number of bags ready for collection, confirm your location (GPS or manual address), and submit. TrashDrop matches you with the nearest available verified collector automatically. You receive an acceptance notification within 2 hours on average.' },
      { h2:'Real-time tracking', body:"From the moment a collector accepts your request, you can see their live GPS position on the map in the TrashDrop app. You'll receive push notifications when the collector is en route, 5 minutes away, and on arrival." },
      { h2:'What happens to your waste', body:"The collector scans your QR code on arrival to confirm the pickup, loads your bags, and transports them to an authorised disposal facility holding a valid Ghana EPA permit. Recyclable materials are separated at the facility and sent to licensed recycling companies. You receive a completion notification with a summary of the disposal outcome." },
      { h2:'QR vs Digital Bin: which is right for you?', body:'Use the QR Bag System if: you want FREE pickups, you prefer to schedule collection on your own timeline, or you want to build up reward points over time. Use the Digital Bin if: you need an immediate pickup today, you have waste that does not fit in standard bags, or you need a one-off commercial collection.' },
    ],
  },

  /* ── POST 5 ── */
  'comparing-waste-collection-options-accra-2026': {
    title:    'Comparing Waste Collection Options in Accra — 2026',
    keyword:  'waste collection Accra',
    description: 'Full comparison of waste collection options in Accra 2026: municipal AMA service, private haulage, informal pickers, and TrashDrop. Assessed on reliability, price, tracking, payment, and environmental accountability.',
    faq: [
      { q:'How does AMA waste collection work in Accra?', a:"The Accra Metropolitan Assembly (AMA) provides scheduled municipal waste collection through licensed waste companies. However, collection frequency and reliability vary significantly by district, and coverage gaps are common in peri-urban areas like Madina, Dome, and Pokuase." },
      { q:'Are private waste haulage companies in Accra reliable?', a:'Private haulage companies offer scheduled collection under contract arrangements. They are generally reliable for contracted clients but require upfront agreements and typically do not offer on-demand or same-day collection.' },
      { q:'What are the advantages of TrashDrop over municipal collection?', a:'TrashDrop offers on-demand collection (no fixed schedule), real-time GPS tracking, transparent pricing, mobile money payment, reward points, and collector ID verification — features not available through municipal collection services.' },
      { q:'Can I use both municipal collection and TrashDrop?', a:'Yes. TrashDrop complements rather than replaces municipal collection. Many users request TrashDrop pickups for overflow waste, bulk items, or when municipal collection misses their area.' },
      { q:'Which waste collection option is best for businesses in Accra?', a:'For businesses needing regular, high-volume collection, a contracted private haulage company may provide predictable service. For on-demand or variable-volume collection, TrashDrop\'s Digital Bin service offers flexible pricing and no contract commitment.' },
    ],
    sections: [
      { h2:'Municipal collection in Accra (AMA service)', body:"The Accra Metropolitan Assembly contracts licensed waste management companies to provide scheduled kerbside and communal container collection across Greater Accra. Service frequency ranges from daily in central districts to weekly or bi-weekly in peri-urban areas. Key limitations: no on-demand service, no real-time tracking, limited payment transparency, and inconsistent coverage in areas like Taifa, Dome, and Madina." },
      { h2:'Private haulage companies', body:'Several private waste haulage companies operate in Accra, including Zoomlion Ghana and Jekora Ventures, offering contracted collection for residential estates and commercial clients. Advantages: predictable scheduled service, larger vehicle capacity. Disadvantages: require contract negotiation, limited same-day service, no app-based booking or tracking.' },
      { h2:'Informal waste pickers', body:'Informal waste pickers — operating independently or through community groups — provide collection in areas not served by formal companies. They typically accept payment in cash and do not provide receipts, GPS tracking, or verified disposal documentation. Environmental accountability is not guaranteed.' },
      { h2:'App-based platforms (TrashDrop)', body:'TrashDrop provides on-demand, trackable, ID-verified waste collection with transparent pricing and mobile money payment. Key advantages: no contract, GPS live tracking, collector verification, authorised disposal documentation, reward points. Available in Accra, Kumasi, Takoradi and Tamale at trashdrops.com.' },
      { h2:'Side-by-side comparison table', body:'RELIABILITY: AMA (Variable), Private (High for contracted), Informal (Low), TrashDrop (High — 98%+ completion). PRICE TRANSPARENCY: AMA (Included in rates), Private (Contract-based), Informal (Variable cash), TrashDrop (Instant GPS quote). REAL-TIME TRACKING: AMA (No), Private (No), Informal (No), TrashDrop (Yes — live GPS). PAYMENT OPTIONS: AMA (Levy), Private (Invoice/bank), Informal (Cash), TrashDrop (MoMo, card, cash). ENVIRONMENTAL ACCOUNTABILITY: AMA (Licensed), Private (Licensed), Informal (Not guaranteed), TrashDrop (EPA-permitted sites only).' },
      { h2:'Households vs businesses', body:'Households benefit most from TrashDrop\'s QR Bag System for free, on-demand pickups, or from AMA scheduled collection for routine weekly disposal. Businesses with predictable high volumes may prefer a contracted private haulage arrangement alongside TrashDrop for overflow and on-demand needs.' },
    ],
  },

  /* ── POST 6 ── */
  'ghana-waste-management-laws-explained': {
    title:    "Ghana's Waste Management Laws Explained",
    keyword:  'waste management law Ghana',
    description: "Plain-English guide to Ghana's key waste management legislation — Act 490, Act 917 (hazardous waste), and Act 851 (Public Health). Legal obligations for households and businesses, and penalties for illegal dumping.",
    faq: [
      { q:'What is Act 490 in Ghana?', a:"Act 490 refers to the Environmental Sanitation Policy framework and associated legislation that governs solid waste management in Ghana. It establishes the legal basis for illegal dumping fines and the responsibilities of Municipal and Metropolitan District Assemblies for waste collection." },
      { q:'What are the penalties for illegal dumping in Ghana?', a:"Penalties under Ghana's environmental sanitation laws include fines up to GH₵2,400 and prosecution for persistent or large-scale illegal dumping. Municipal Environmental Health Officers are empowered to issue fixed-penalty notices." },
      { q:'Are businesses legally required to arrange waste collection in Ghana?', a:'Yes. Commercial premises are responsible for ensuring their waste is collected and disposed of at a licensed facility. Failure to do so — including allowing waste to accumulate on-site — is an offence under the Environmental Sanitation Policy.' },
      { q:'What is Act 917 in Ghana?', a:"Act 917 is the Hazardous and Electronic Waste Control and Management Act, which governs the management of hazardous and e-waste in Ghana. It establishes licensing requirements for hazardous waste handlers and prohibits disposal of e-waste in standard landfills." },
      { q:'How does TrashDrop help households comply with waste laws?', a:"TrashDrop ensures all waste collected through its platform is delivered to EPA-permitted disposal facilities. Every collection generates a documented record — GPS coordinates, timestamp, and waste type — providing households and businesses with evidence of compliant disposal if required." },
    ],
    sections: [
      { h2:'Key legislation in Ghana', body:"Ghana's waste management framework is governed primarily by: the Environmental Sanitation Policy (2010), giving MMDAs responsibility for waste collection; the Public Health Act (Act 851, 2012), establishing public health obligations for waste disposal; and the Hazardous and Electronic Waste Control and Management Act (Act 917, 2016), covering hazardous and e-waste specifically." },
      { h2:'What Act 490 says about dumping', body:"The Environmental Sanitation Policy, underpinned by Legislative Instrument 1652, prohibits the indiscriminate disposal of solid waste in any location other than a designated, licensed facility. Environmental Health Officers attached to District Assemblies are empowered to issue fines for violations." },
      { h2:'Penalties for illegal dumping', body:"Penalties for illegal dumping in Ghana include fixed fines (up to GH₵2,400 under current schedules), community service orders, and prosecution in serious cases. Fines can be compounded for recurring offences. Municipal Assemblies can also pursue civil remedies for remediation costs." },
      { h2:'Responsibilities for businesses', body:"Commercial premises — including offices, markets, restaurants, and factories — are legally responsible for their waste from the point of generation to the point of final disposal. This includes arranging licensed collection, maintaining records of disposal, and ensuring hazardous waste is handled by licensed operators under Act 917." },
      { h2:"How local authorities enforce waste laws", body:"Municipal Environmental Health Officers (EHOs) conduct inspections, respond to public complaints and reports, and issue fixed-penalty notices for illegal dumping. TrashDrop's illegal dumping report tool provides EHOs with GPS-verified, photo-documented evidence that significantly accelerates enforcement." },
      { h2:'How TrashDrop helps you comply', body:"Every pickup completed through TrashDrop produces a documented record: GPS coordinates of collection, timestamp, waste type declaration, collector ID, and disposal site confirmation. This record constitutes evidence of compliant disposal for both households and businesses. For commercial clients, TrashDrop can provide periodic compliance summary reports on request." },
    ],
  },

  /* ── POST 7 ── */
  'what-happens-to-waste-after-trashdrop-picks-it-up': {
    title:    'What Happens to Waste After TrashDrop Picks It Up?',
    keyword:  'recycling Ghana / waste disposal Accra',
    description: "Full journey of waste collected by TrashDrop in Accra — from household pickup to licensed recycling, organic composting, or authorised landfill. How TrashDrop verifies disposal at every step.",
    faq: [
      { q:'Where does TrashDrop take collected waste in Accra?', a:"TrashDrop delivers waste only to disposal sites holding valid environmental permits from the Ghana EPA. Depending on waste type, this includes licensed recycling facilities, organic composting sites, or the Kpone and Oblogo authorised landfills." },
      { q:'How does TrashDrop verify disposal?', a:"Collectors are required to check in at the disposal facility using the Carter App. The app logs the GPS coordinates of the disposal site and timestamps the arrival. This data is available to users in their pickup history and to municipal authorities on request." },
      { q:'What happens to plastic waste collected in Accra?', a:"Recyclable plastic collected by TrashDrop is delivered to licensed recycling companies including Jekora Ventures and local plastics processors. Materials are sorted, cleaned, and processed into recycled pellets for use in manufacturing." },
      { q:'Does TrashDrop compost organic waste?', a:"Organic waste — food scraps, garden cuttings — separated by users is routed to composting partners where available. Finished compost is sold to agricultural clients. TrashDrop is expanding composting partnerships across Greater Accra." },
      { q:'What about e-waste collected through TrashDrop?', a:"E-waste collected through TrashDrop's Special Handling option is delivered to licensed e-waste processors under Act 917 compliance. TrashDrop does not allow e-waste to be deposited at standard municipal landfills." },
    ],
    sections: [
      { h2:'Authorised disposal sites in Accra', body:"TrashDrop maintains a list of Ghana EPA-permitted disposal sites and only authorises deliveries to verified locations. In Greater Accra, this includes the Kpone Landfill (Tema), Oblogo Landfill, licensed recycling yards in Accra Industrial Area, and certified composting facilities in Tema and Adenta." },
      { h2:'Recyclable materials: where they go', body:"Plastic, metal, glass, and paper collected through TrashDrop are delivered to licensed recycling companies. In Accra, this includes Jekora Ventures (recyclables and e-waste), Trashy Bags (plastic fabric manufacturing), and local aluminium and scrap metal processors. Collectors receive 60% of the materials revenue — incentivising proper routing." },
      { h2:'Organic waste: composting in Ghana', body:"Food waste and garden cuttings segregated by TrashDrop users are routed to composting operations where available. Finished compost is sold to smallholder farmers and horticulture businesses. TrashDrop is actively expanding composting partnerships in Greater Accra and Kumasi." },
      { h2:"General waste: Accra's landfill system", body:"Residual general waste that cannot be recycled or composted is delivered to Kpone Landfill or Oblogo Landfill — both operating under Ghana EPA environmental permits. TrashDrop monitors disposal records at both sites and refuses to route waste to any facility without current permit documentation." },
      { h2:'Hazardous waste: specialised handling', body:"E-waste, batteries, chemicals, and medical waste collected through TrashDrop's Special Handling option are delivered to Act 917-compliant hazardous waste processors. TrashDrop maintains partnerships with licensed e-waste recyclers and works with the Ghana EPA to ensure compliant routing." },
      { h2:'How TrashDrop verifies disposal', body:"Every collector is required to check in at the disposal facility using the Carter App at the conclusion of each trip. The app captures GPS coordinates and timestamp of the check-in, which are matched against the registered coordinates of licensed disposal sites. Collectors who attempt to dispose at unlicensed sites are flagged and suspended pending investigation." },
      { h2:'Environmental impact data', body:"TrashDrop tracks and publishes aggregate environmental impact data monthly: tonnes of waste diverted from illegal dumping, tonnes of recyclables processed, tonnes of organic waste composted, and estimated CO₂ equivalent emissions avoided. The platform currently diverts over 55 tonnes of waste monthly from Ghana's landfills." },
    ],
  },

  /* ── POST 8 ── */
  'trashdrop-expands-kumasi': {
    title:    'TrashDrop Expands to Kumasi: What You Need to Know',
    keyword:  'waste collection Kumasi',
    description: 'TrashDrop is now live in Kumasi, Ghana. Book waste collectors, report illegal dumping, and join as a carter in Kumasi. Target: 200+ collectors by end of 2026.',
    faq: [
      { q:'Is TrashDrop available in Kumasi?', a:'Yes. TrashDrop is now live in Kumasi. Residents and businesses can book waste collectors, report illegal dumping sites, and join the carter network at trashdrops.com — no app download required.' },
      { q:'Which areas of Kumasi does TrashDrop serve?', a:'TrashDrop is initially serving Kumasi Central, Asokwa, Nhyiaeso, Bantama, Suame, Kwadaso, Oforikrom, and surrounding communities. Coverage is expanding as more collectors join the platform in the Ashanti Region.' },
      { q:'Where can I buy TrashDrop bags in Kumasi?', a:'Authorised vendors in Kumasi are listed in the TrashDrop app. Use the vendor locator at trashdrops.com to find the nearest outlet to your location.' },
      { q:'How can I earn as a waste collector in Kumasi?', a:'Kumasi-based collectors earn the same average rate as Accra collectors — ₵32.43 per pickup — paid directly to your MoMo wallet. Sign up at trashdrops.com, submit your Ghana ID and vehicle details, and get approved within 24 hours.' },
      { q:"What is Kumasi's waste management situation?", a:"Kumasi generates over 1,200 tonnes of solid waste daily. The Kumasi Metropolitan Assembly's collection coverage is estimated at less than 40% of the urban population. TrashDrop's entry into Kumasi addresses this gap with verified on-demand collection." },
    ],
    sections: [
      { h2:'How to use TrashDrop in Kumasi', body:"Using TrashDrop in Kumasi works exactly the same as in Accra. Open trashdrops.com on any smartphone, sign up with your email, set your Kumasi address, and request a pickup using either the QR Bag System (buy bags from a Kumasi vendor, scan, fill, request free pickup) or the Digital Bin service (on-demand pickup with instant GPS-based pricing)." },
      { h2:'Areas currently served', body:"TrashDrop's initial Kumasi coverage includes: Kumasi Central, Asokwa, Nhyiaeso, Bantama, Suame, Kwadaso, Oforikrom, Tafo, and Krofrom. Coverage expands weekly as new collectors join. Sign up to request a pickup even if your area is not yet listed — demand signals from new areas trigger faster collector recruitment." },
      { h2:'Where to buy QR bags in Kumasi', body:"Authorised TrashDrop bag vendors in Kumasi are located in Kejetia Market, Asafo Market, Kumasi Central Business District, and selected neighbourhood shops in Bantama and Nhyiaeso. Use the vendor locator in the app at trashdrops.com for the precise location nearest to you." },
      { h2:'Joining as a collector in Kumasi (earn ₵32.43 avg)', body:"Kumasi-based carters and aboboyaa riders are invited to join the TrashDrop collector network. Average earnings are ₵32.43 per completed pickup, paid directly to MTN or AirtelTigo mobile money. To sign up: visit trashdrops.com, tap 'Become a Collector,' verify your Ghana phone number, upload your Ghana Card and vehicle details, and submit. Approval typically takes 24 hours." },
      { h2:"Kumasi's waste management challenges", body:"Kumasi generates over 1,200 tonnes of solid waste daily. The Kumasi Metropolitan Assembly estimates that formal collection covers less than 40% of the urban population, leaving significant volumes of waste at risk of illegal dumping in drainage channels, roadside sites, and the Oda River corridor. TrashDrop is working with KMA to identify high-risk areas and prioritise collector deployment." },
      { h2:'Expansion timeline for Ashanti Region', body:"TrashDrop's target for Kumasi is 200+ active collectors by the end of 2026. Following Kumasi, planned expansion in the Ashanti Region includes Obuasi, Mampong, and Ejisu-Juaben Municipal areas. Expansion into other regions — Bono, Volta, Northern — is planned for 2027 as part of the Series A-funded national rollout." },
    ],
  },
};

/* ────────────────────────────────────────────────────────────────────────────
   BlogPostPage component
─────────────────────────────────────────────────────────────────────────────*/
const BlogPostPage = () => {
  const { slug } = useParams();
  const post = BLOG_POSTS.find(p => p.slug === slug);
  const content = POST_CONTENT[slug];

  useEffect(() => {
    if (!content) return;
    document.title = `${content.title} | TrashDrop Blog`;
    const el = document.querySelector('meta[name="description"]');
    if (el && content.description) el.setAttribute('content', content.description);
  }, [content]);

  if (!post || !content) return <Navigate to="/blog" replace />;

  const otherPosts = BLOG_POSTS.filter(p => p.slug !== slug).slice(0, 3);

  return (
    <PublicPageLayout>
      {/* ── Hero ── */}
      <section style={{ background:`linear-gradient(160deg,${TD.forestDk} 0%,#0d1a0d 50%,${TD.ink} 100%)`, padding:'140px 24px 72px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.03, backgroundImage:`radial-gradient(${TD.lime} 1px,transparent 1px)`, backgroundSize:'36px 36px', pointerEvents:'none' }} />
        <div style={{ maxWidth:800, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
            <Link to="/blog" style={{ ...FF.label, fontSize:12, color:TD.sage, textDecoration:'none', fontWeight:600 }}>
              ← Blog
            </Link>
            <span style={{ color:TD.sage }}>·</span>
            <span style={{ ...FF.label, fontSize:11, fontWeight:700, letterSpacing:'1.5px', color:post.tagColor, background:`${post.tagColor}15`, border:`1px solid ${post.tagColor}25`, borderRadius:99, padding:'3px 10px', textTransform:'uppercase' }}>{post.tag}</span>
            <span style={{ color:TD.sage }}>·</span>
            <span style={{ ...FF.label, fontSize:12, color:TD.sage }}>{post.readTime}</span>
          </div>
          <h1 style={{ ...FF.display, fontSize:'clamp(32px,5vw,58px)', color:'#f0f5f0', lineHeight:1.08, letterSpacing:'-1.5px', margin:'0 0 16px' }}>
            {content.title}
          </h1>
          <p style={{ ...FF.label, fontSize:12, color:TD.sage, margin:0, fontWeight:600 }}>
            Target keyword: <em style={{ fontStyle:'normal', color:`${TD.lime}99` }}>{content.keyword}</em>
          </p>
        </div>
      </section>

      {/* ── Article body ── */}
      <section style={{ background:TD.ink2, padding:'72px 24px' }}>
        <div style={{ maxWidth:780, margin:'0 auto' }}>

          {/* Opening paragraph — first 100-150 words extracted by AI */}
          <p style={{ ...FF.body, fontSize:18, color:'rgba(255,255,255,0.82)', lineHeight:1.85, margin:'0 0 48px', fontWeight:400, borderLeft:`3px solid ${TD.lime}`, paddingLeft:24 }}>
            {post.excerpt}
          </p>

          {/* H2 sections */}
          {content.sections.map((sec, i) => (
            <div key={i} style={{ marginBottom:40 }}>
              <h2 style={{ ...FF.display, fontSize:'clamp(22px,3vw,30px)', color:'#f0f5f0', margin:'0 0 14px', letterSpacing:'-0.5px' }}>{sec.h2}</h2>
              <p style={{ ...FF.body, fontSize:16, color:'rgba(255,255,255,0.65)', lineHeight:1.82, margin:0 }}>{sec.body}</p>
            </div>
          ))}

          {/* CTA ── */}
          <div style={{ marginTop:56, background:`${TD.lime}10`, border:`1px solid ${TD.lime}25`, borderRadius:16, padding:'32px 36px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:24, flexWrap:'wrap' }}>
            <div>
              <div style={{ ...FF.label, fontSize:14, fontWeight:700, color:TD.lime, marginBottom:6 }}>Ready to try TrashDrop?</div>
              <div style={{ ...FF.body, fontSize:14, color:'rgba(255,255,255,0.6)' }}>No app download. Available at trashdrops.com</div>
            </div>
            <Link to="/signup" style={{ ...FF.label, fontSize:13, fontWeight:700, background:TD.lime, color:TD.ink, padding:'12px 28px', borderRadius:10, textDecoration:'none', whiteSpace:'nowrap' }}>
              Get Started Free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      {content.faq && content.faq.length > 0 && (
        <section style={{ background:TD.ink, padding:'72px 24px' }}>
          <div style={{ maxWidth:780, margin:'0 auto' }}>
            <h2 style={{ ...FF.display, fontSize:'clamp(24px,3.5vw,38px)', color:'#f0f5f0', margin:'0 0 40px', letterSpacing:'-0.5px' }}>Frequently asked questions</h2>
            <FAQAccordion items={content.faq} />
          </div>
        </section>
      )}

      {/* ── Related posts ── */}
      <section style={{ background:TD.ink2, padding:'72px 24px' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <h2 style={{ ...FF.display, fontSize:'clamp(22px,3vw,32px)', color:'#f0f5f0', margin:'0 0 32px', letterSpacing:'-0.5px' }}>More from the blog</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:20 }}>
            {otherPosts.map(p => (
              <Link key={p.slug} to={`/blog/${p.slug}`} style={{ textDecoration:'none' }}>
                <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'24px 22px', transition:'all 0.22s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=`${TD.lime}30`;e.currentTarget.style.background=`rgba(168,230,61,0.04)`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.07)';e.currentTarget.style.background='rgba(255,255,255,0.03)';}}>
                  <span style={{ ...FF.label, fontSize:10, fontWeight:700, letterSpacing:'1.5px', color:p.tagColor, textTransform:'uppercase' }}>{p.tag}</span>
                  <h3 style={{ ...FF.display, fontSize:'clamp(16px,2vw,19px)', color:'#f0f5f0', lineHeight:1.35, margin:'10px 0 10px', letterSpacing:'-0.2px' }}>{p.title}</h3>
                  <span style={{ ...FF.label, fontSize:12, color:TD.lime, fontWeight:700 }}>Read →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicPageLayout>
  );
};

export default BlogPostPage;
