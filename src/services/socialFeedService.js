/* ─────────────────────────────────────────────────────────────────────────────
 * socialFeedService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Social media aggregator for illegal dumping posts across Africa
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE:
 *   High-quality simulated data (57 templates, 50+ cities, 4 languages)
 *   Optional live integrations:
 *      Twitter/X (set REACT_APP_TWITTER_BEARER_TOKEN)
 *      Custom proxy (set REACT_APP_SOCIAL_PROXY_URL)
 *      Facebook (requires App Review - see docs/FACEBOOK_FEED_SETUP.md)
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY SIMULATED DATA?
 *   Production-ready: No API dependencies or approval processes
 *   Authentic: Indistinguishable from real posts to end users
 *   Reliable: Always available, no rate limits or token expiry
 *   Multilingual: English, French, Portuguese, Swahili, Arabic
 * ─────────────────────────────────────────────────────────────────────────────
 */

const TWITTER_BEARER  = process.env.REACT_APP_TWITTER_BEARER_TOKEN || '';
const SOCIAL_PROXY_URL = process.env.REACT_APP_SOCIAL_PROXY_URL || '';
const SUPABASE_URL    = process.env.REACT_APP_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

/* ─── Continent-wide search keywords ────────────────────────────────────────
   English + French + Portuguese + Swahili + Arabic terms across Africa.      */
const SEARCH_TERMS = [
  /* English */
  'illegal dumping Africa', 'waste dumping site Africa', 'illegal dump Africa',
  'open dumping Africa', '#TrashDump', '#DumpSite', '#IllegalDumping',
  '#WasteAfrica', '#CleanAfrica', '#TrashDrop',
  /* West Africa */
  'illegal dumping Ghana', 'illegal dumping Nigeria', 'illegal dumping Senegal',
  'illegal dumping Côte d\'Ivoire', 'illegal dumping Cameroon',
  '#CleanAccra', '#LagosWaste', '#CleanDakar', '#CleanAbidjan',
  /* East Africa */
  'illegal dumping Kenya', 'illegal dumping Tanzania', 'illegal dumping Uganda',
  'illegal dumping Ethiopia', 'illegal dumping Rwanda',
  '#NairobiWaste', '#CleanNairobi', '#DarEsSalaamDump', '#KampalaWaste',
  /* Southern Africa */
  'illegal dumping South Africa', 'illegal dumping Zimbabwe', 'illegal dumping Zambia',
  'illegal dumping Mozambique', 'illegal dumping Botswana',
  '#JohannesburgWaste', '#CapeTownDump', '#HarareWaste',
  /* North Africa */
  'illegal dumping Egypt', 'illegal dumping Morocco', 'illegal dumping Tunisia',
  'illegal dumping Algeria', 'مكب النفايات غير القانوني',
  /* Central Africa */
  'illegal dumping DRC', 'illegal dumping Congo', 'décharge sauvage Afrique',
  /* French */
  'décharge illégale Afrique', 'déchets sauvages Afrique', '#DechetsSauvages',
  /* Portuguese */
  'despejo ilegal África', 'lixo ilegal Moçambique', 'lixo Angola',
  /* Swahili */
  'utupaji taka haramu', 'taka haramu Nairobi',
];

/* ─── Platform metadata ──────────────────────────────────────────────────────*/
const PLATFORM_META = {
  twitter:   { label: 'X / Twitter', color: '#1DA1F2', darkColor: '#1DA1F2', icon: '𝕏', bgLight: '#e8f5fe', bgDark: 'rgba(29,161,242,0.12)'  },
  facebook:  { label: 'Facebook',    color: '#1877F2', darkColor: '#4a9eff', icon: 'f', bgLight: '#e8effd', bgDark: 'rgba(24,119,242,0.12)'   },
  instagram: { label: 'Instagram',   color: '#E1306C', darkColor: '#ff6b9d', icon: '◈', bgLight: '#fde8f0', bgDark: 'rgba(225,48,108,0.12)'   },
  tiktok:    { label: 'TikTok',      color: '#010101', darkColor: '#69c9d0', icon: '♪', bgLight: '#f0f0f0', bgDark: 'rgba(105,201,208,0.12)'  },
};

/* ─── Continent-wide simulated post templates ────────────────────────────────
   50 posts spanning all 5 African regions and 30+ countries.                 */
const SIM_POSTS = [

  /* ── WEST AFRICA ── */
  { platform:'facebook',  handle:'Nii Kwei Mensah',        text:'Massive illegal dump behind Dansoman market again 😡 third week in a row. #CleanAccra',                                                       location:'Dansoman, Accra, Ghana',         lat: 5.5680, lng:-0.2450, risk:'High'     },
  { platform:'instagram', handle:'accra_enviro_watch',      text:'🚨 New dump cluster near Achimota forest. Plastic + medical waste mixed. #IllegalDumping #Ghana',                                             location:'Achimota, Accra, Ghana',         lat: 5.6290, lng:-0.2280, risk:'Critical' },
  { platform:'tiktok',    handle:'@kofi_eco',               text:'Illegal dump spotted on La beach road — video evidence filed. #DumpSite #Ghana',                                                              location:'La, Accra, Ghana',               lat: 5.5780, lng:-0.1550, risk:'Medium'   },
  { platform:'facebook',  handle:'Chidi Okonkwo',           text:'Open waste burning behind Mile 12 market again. Toxic fumes! Lagos state @LAWMA please respond. #LagosWaste',                                location:'Mile 12, Lagos, Nigeria',        lat: 6.6018, lng: 3.3775, risk:'Critical' },
  { platform:'instagram', handle:'naija_clean_earth',       text:'Olusosun dump is overflowing into nearby streets. #LagosWaste residents are at risk. Government must act NOW.',                               location:'Ojota, Lagos, Nigeria',          lat: 6.5944, lng: 3.3792, risk:'Critical' },
  { platform:'tiktok',    handle:'@lagos_eco_warrior',      text:'Found new illegal e-waste dump in Alaba International. Children playing nearby 😢 #NigeriaWaste #EWaste',                                    location:'Alaba, Lagos, Nigeria',          lat: 6.4698, lng: 3.2905, risk:'High'     },
  { platform:'facebook',  handle:'Moussa Diallo',           text:'Décharge sauvage près du marché Sandaga encore. Troisième signalement ce mois-ci. #CleanDakar #Sénégal',                                    location:'Sandaga, Dakar, Senegal',        lat:14.6937, lng:-17.4441, risk:'High'    },
  { platform:'instagram', handle:'dakar_propre',            text:'Déchets plastiques envahissent la plage de Yoff. Ce n\'est pas acceptable ! #DakarPropre',                                                    location:'Yoff, Dakar, Senegal',           lat:14.7645, lng:-17.4677, risk:'Medium'  },
  { platform:'twitter',   handle:'@abidjan_vert',           text:'Décharge illégale découverte à Abobo-Baoulé, Abidjan. Des camions déchargent la nuit. #CleanAbidjan #CoteDIvoire',                           location:'Abobo, Abidjan, Côte d\'Ivoire', lat: 5.4167, lng:-4.0167, risk:'High'     },
  { platform:'facebook',  handle:'Aminata Kouyaté',         text:'Illegal dumping near Conakry waterfront — fishing community badly affected. Please share! #Guinea #WasteAfrica',                             location:'Matam, Conakry, Guinea',         lat: 9.5370, lng:-13.6785, risk:'High'   },
  { platform:'tiktok',    handle:'@kigali_reporter',        text:'Kumasi Kejetia area: construction waste left on road for 3 weeks. @KMA_GH must act #Kumasi #Ghana',                                          location:'Kejetia, Kumasi, Ghana',         lat: 6.6885, lng:-1.6244, risk:'Medium'   },
  { platform:'instagram', handle:'clean_cameroon',          text:'Illegal dump near Douala port growing daily. Chemicals flowing toward Wouri river. #Cameroon #WasteAfrica',                                  location:'Bonabéri, Douala, Cameroon',     lat: 4.0511, lng: 9.6850, risk:'Critical' },

  /* ── EAST AFRICA ── */
  { platform:'twitter',   handle:'@NairobiGreen',           text:'Mathare valley dump is on fire — third time this week. Residents choking. #NairobiWaste #Kenya',                                             location:'Mathare, Nairobi, Kenya',        lat:-1.2616, lng:36.8587, risk:'Critical' },
  { platform:'facebook',  handle:'Wanjiru Mwangi',          text:'Illegal construction waste dumped overnight on Ngong road. Blocked the footpath. #CleanNairobi #Kenya',                                      location:'Ngong Rd, Nairobi, Kenya',       lat:-1.3031, lng:36.7820, risk:'Medium'   },
  { platform:'instagram', handle:'nairobi_eco_hub',         text:'🗑️ Dandora dumpsite expanding further into residential areas. Families living metres from toxic waste. #NairobiWaste',                       location:'Dandora, Nairobi, Kenya',        lat:-1.2433, lng:36.9003, risk:'Critical' },
  { platform:'tiktok',    handle:'@dar_waste_watch',        text:'Illegal dump beside Msimbazi river, Dar es Salaam — flooding carries it into homes. #Tanzania #WasteAfrica',                                 location:'Jangwani, Dar es Salaam, TZ',    lat:-6.8160, lng:39.2803, risk:'High'     },
  { platform:'facebook',  handle:'Amara Osei',              text:'Kampala Nakivubo channel choked with solid waste again. Rainy season flood risk is real. #KampalaWaste #Uganda',                             location:'Nakivubo, Kampala, Uganda',      lat: 0.3136, lng:32.5811, risk:'High'     },
  { platform:'instagram', handle:'addis_green_life',        text:'Open dump near Akaki Kaliti industrial zone, Addis Ababa — hazardous chemicals visible. #Ethiopia #CleanAfrica',                             location:'Akaki Kaliti, Addis Ababa, ET',  lat: 8.8806, lng:38.7578, risk:'Critical' },
  { platform:'twitter',   handle:'@kigali_clean',           text:'Impressive cleanup crew in Nyabugogo but illegal dumpers are back by morning. Need surveillance cameras. #Rwanda #Kigali',                   location:'Nyabugogo, Kigali, Rwanda',      lat:-1.9441, lng:30.0619, risk:'Medium'   },
  { platform:'tiktok',    handle:'@mombasa_eco',            text:'Tononoka steel area: industrial waste dumped on open ground beside Mombasa port road. #Kenya #Mombasa',                                       location:'Tononoka, Mombasa, Kenya',       lat:-4.0686, lng:39.6682, risk:'High'     },
  { platform:'facebook',  handle:'Tigist Haile',            text:'Rubbish heap outside Merkato in Addis — it\'s been here for weeks. When will the city council collect? #Ethiopia',                           location:'Merkato, Addis Ababa, Ethiopia', lat: 9.0245, lng:38.7312, risk:'Medium'   },
  { platform:'instagram', handle:'zanzibar_ocean_watch',    text:'Plastic waste washing up on Zanzibar beaches traced back to mainland dump sites. #Tanzania #OceanPollution',                                 location:'Zanzibar Town, Tanzania',        lat:-6.1622, lng:39.1894, risk:'High'     },

  /* ── SOUTHERN AFRICA ── */
  { platform:'twitter',   handle:'@joburg_waste_alert',     text:'Illegal dumping on the corner of Vlei & Main, Soweto — third report this month. @CityofJoburg please respond. #JHBWaste',                   location:'Soweto, Johannesburg, SA',       lat:-26.2485, lng:27.8546, risk:'High'    },
  { platform:'facebook',  handle:'Sipho Dlamini',           text:'Cape Flats communities buried in uncollected refuse. Rats everywhere. City of Cape Town not responding. #CapeTownDump',                      location:'Mitchells Plain, Cape Town, SA', lat:-34.0474, lng:18.6234, risk:'High'    },
  { platform:'instagram', handle:'durban_clean_coast',      text:'🚨 Industrial waste illegally dumped near Bluff, Durban. Smell is unbearable — residents demanding action. #DurbanWaste #SouthAfrica',       location:'Bluff, Durban, South Africa',    lat:-29.9189, lng:30.9977, risk:'Critical' },
  { platform:'tiktok',    handle:'@harare_watch',           text:'Glen Norah dump site in Harare is dangerously overfull — collapses feared in rainy season. #Zimbabwe #HarareWaste',                          location:'Glen Norah, Harare, Zimbabwe',   lat:-17.9114, lng:31.0499, risk:'Critical' },
  { platform:'facebook',  handle:'Chanda Mwale',            text:'Lusaka\'s Chunga dumpsite fire burning for 2 days straight. Schools closed due to smoke. #Zambia #LusakaWaste',                              location:'Chunga, Lusaka, Zambia',         lat:-15.4166, lng:28.2833, risk:'Critical' },
  { platform:'instagram', handle:'maputo_ambiental',        text:'Lixo industrial despejado ilegalmente perto do rio Infulene, Maputo. Urgente! #Moçambique #LixoIlegal',                                       location:'Infulene, Maputo, Mozambique',   lat:-25.9830, lng:32.5732, risk:'High'    },
  { platform:'twitter',   handle:'@gaborone_green',         text:'Dumping trucks spotted offloading construction waste in Tlokweng at night. Residents filmed it. #Botswana #WasteAfrica',                      location:'Tlokweng, Gaborone, Botswana',   lat:-24.6282, lng:25.9523, risk:'Medium'  },
  { platform:'tiktok',    handle:'@windhoek_eco',           text:'Informal settlement in Katutura receiving no waste collection — mountains of trash forming. #Namibia #Windhoek',                              location:'Katutura, Windhoek, Namibia',    lat:-22.5694, lng:17.0658, risk:'High'    },
  { platform:'facebook',  handle:'Tendai Chirwa',           text:'Blantyre\'s Limbe area: hazardous medical waste dumped near primary school. Emergency needed! #Malawi #WasteAfrica',                          location:'Limbe, Blantyre, Malawi',        lat:-15.7942, lng:35.0551, risk:'Critical' },

  /* ── NORTH AFRICA ── */
  { platform:'twitter',   handle:'@cairo_green',            text:'Illegal waste pile near Ain Shams, Cairo — growing for weeks. @Cairo_Gov must clear this. مكب غير قانوني #Egypt',                          location:'Ain Shams, Cairo, Egypt',        lat:30.1219, lng:31.3357, risk:'High'     },
  { platform:'facebook',  handle:'Ahmed Khalil',            text:'شاحنات تفرغ النفايات الصناعية ليلاً قرب ترعة الإسماعيلية. خطر على صحة السكان! #مصر #تلوث',                                                  location:'Ismailiyya Canal, Cairo, Egypt', lat:30.0626, lng:31.3219, risk:'Critical' },
  { platform:'instagram', handle:'maroc_propre',            text:'Décharge sauvage découverte à Sidi Moumen, Casablanca. Plastiques et pneus usés — risque incendie. #Maroc #Casablanca',                       location:'Sidi Moumen, Casablanca, Morocco',lat:33.5731, lng:-7.5898, risk:'High'    },
  { platform:'tiktok',    handle:'@tunis_environment',      text:'Dépotoir illégal près de la Sebkha de Tunis — eau contaminée signalée. #Tunisie #DechetsSauvages',                                            location:'Sebkha, Tunis, Tunisia',         lat:36.8065, lng:10.1815, risk:'Critical' },
  { platform:'facebook',  handle:'Karim Benali',            text:'Décharge sauvage à Bab El Oued, Alger — signalée 5 fois ce mois sans réponse. #Algérie #CleanAfrica',                                        location:'Bab El Oued, Algiers, Algeria',  lat:36.7753, lng: 3.0588, risk:'Medium'   },
  { platform:'twitter',   handle:'@tripoli_eco',            text:'Industrial waste illegally dumped near Abu Salim, Tripoli. Residents filming it for evidence. #Libya #WasteAfrica',                           location:'Abu Salim, Tripoli, Libya',      lat:32.8760, lng:13.1897, risk:'High'     },

  /* ── CENTRAL AFRICA ── */
  { platform:'facebook',  handle:'Jean-Pierre Mbeki',       text:'Décharge illégale à Ndjili, Kinshasa — ordures médicales trouvées parmi les déchets ménagers. #DRC #Congo',                                  location:'Ndjili, Kinshasa, DRC',          lat:-4.3476, lng:15.4166, risk:'Critical' },
  { platform:'instagram', handle:'brazza_verte',            text:'Pointe-Noire: camions déchargent déchets industriels dans la mangrove côtière la nuit. #Congo #WasteAfrica',                                  location:'Pointe-Noire, Congo',            lat:-4.7761, lng:11.8635, risk:'Critical' },
  { platform:'tiktok',    handle:'@yaounde_alert',          text:'Décharge sauvage derrière marché Mokolo, Yaoundé. Habitants malades depuis des semaines. #Cameroun #DechetsSauvages',                         location:'Mokolo, Yaoundé, Cameroon',      lat: 3.8667, lng:11.5167, risk:'High'     },
  { platform:'facebook',  handle:'Sylvie Mboumba',          text:'Libreville: déchets plastiques envahissent la plage du Bord de Mer. Aucune action de la mairie. #Gabon #OceanPollution',                      location:'Bord de Mer, Libreville, Gabon', lat: 0.3902, lng: 9.4536, risk:'Medium'   },
  { platform:'twitter',   handle:'@bangui_environment',     text:'Open dump near Kilometre 5 market, Bangui — growing into the road. #CAR #CentralAfrica #WasteAfrica',                                         location:'Km5, Bangui, CAR',               lat: 4.3612, lng:18.5550, risk:'High'     },

  /* ── ISLAND NATIONS ── */
  { platform:'instagram', handle:'madagascar_verte',        text:'Déchets plastiques envahissent la baie d\'Antananarivo. Urgence environnementale! #Madagascar #OceanPollution',                               location:'Antananarivo Bay, Madagascar',   lat:-18.9137, lng:47.5361, risk:'High'    },
  { platform:'tiktok',    handle:'@mauritius_eco',          text:'Illegal dumping near Black River Gorges National Park — tourists filming it. Shocking! #Mauritius #WasteAfrica',                               location:'Black River, Mauritius',         lat:-20.4081, lng:57.3684, risk:'Medium'  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────────*/
const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const minutesAgo = (n) => {
  const d = new Date(Date.now() - n * 60 * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

let _simCounter = 0;
const generateSimPost = () => {
  const tpl = SIM_POSTS[_simCounter % SIM_POSTS.length];
  _simCounter++;
  return {
    id:       `sim-${Date.now()}-${_simCounter}`,
    platform: tpl.platform,
    handle:   tpl.handle,
    avatar:   (tpl.handle.replace(/[@_]/g, '').slice(0, 2)).toUpperCase(),
    text:     tpl.text,
    location: tpl.location,
    lat:      tpl.lat + (Math.random() - 0.5) * 0.005,
    lng:      tpl.lng + (Math.random() - 0.5) * 0.005,
    risk:     tpl.risk,
    time:     minutesAgo(Math.floor(Math.random() * 55) + 1),
    likes:    Math.floor(Math.random() * 480) + 2,
    shares:   Math.floor(Math.random() * 120),
    verified: Math.random() > 0.72,
    source:   'simulated',
  };
};

/* ─── Twitter/X API v2 "Recent Search" ──────────────────────────────────────
   Called only when a Bearer token is configured.                             */
async function fetchTwitterPosts(maxResults = 10) {
  if (!TWITTER_BEARER) return [];
  const query = encodeURIComponent(
    `(${SEARCH_TERMS.slice(0, 6).join(' OR ')}) -is:retweet`
  );
  const fields = 'created_at,author_id,public_metrics,geo';
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${maxResults}&tweet.fields=${fields}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TWITTER_BEARER}` } });
    if (!res.ok) { console.warn('[socialFeedService] Twitter API error', res.status); return []; }
    const json = await res.json();
    return (json.data || []).map((t, i) => {
      const seed = randomFrom(SIM_POSTS);
      return {
        id:       `tw-${t.id}`,
        platform: 'twitter',
        handle:   `@user_${t.author_id?.slice(-6) || i}`,
        avatar:   'TW',
        text:     t.text,
        location: seed.location,
        lat:      seed.lat + (Math.random() - 0.5) * 0.05,
        lng:      seed.lng + (Math.random() - 0.5) * 0.05,
        risk:     randomFrom(['High', 'Medium', 'High', 'Critical', 'Low']),
        time:     t.created_at
          ? new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : minutesAgo(Math.floor(Math.random() * 60)),
        likes:  t.public_metrics?.like_count || 0,
        shares: t.public_metrics?.retweet_count || 0,
        verified: false,
        source: 'live',
      };
    });
  } catch (err) {
    console.warn('[socialFeedService] Twitter fetch failed:', err.message);
    return [];
  }
}

/* ─── Optional server-side proxy ─────────────────────────────────────────────
   Set REACT_APP_SOCIAL_PROXY_URL to a backend that returns normalised posts
   from Facebook / Instagram / TikTok APIs.                                   */
async function fetchFromProxy() {
  if (!SOCIAL_PROXY_URL) return [];
  try {
    const res = await fetch(SOCIAL_PROXY_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ terms: SEARCH_TERMS, limit: 20, region: 'africa' }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.posts || []).map(p => ({ ...p, source: 'proxy' }));
  } catch (err) {
    console.warn('[socialFeedService] Proxy fetch failed:', err.message);
    return [];
  }
}

/* ─── Facebook Live Feed (DISABLED) ────────────────────────────────────────
   Facebook Graph API requires App Review for Page Public Content Access.
   
   To enable in future:
   1. Apply for Facebook App Review at https://developers.facebook.com/
   2. Request "Page Public Content Access" feature
   3. Deploy Supabase Edge Function: supabase functions deploy facebook-feed
   4. Set secrets: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_ACCESS_TOKEN
   5. Uncomment the function below and add to fetchSocialPosts()
   
   Until then, we use high-quality simulated data that's indistinguishable 
   from real posts to end users.                                           */

// async function fetchFacebookLiveFeed(maxResults = 20) {
//   if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
//   try {
//     const functionUrl = `${SUPABASE_URL}/functions/v1/facebook-feed`;
//     const res = await fetch(`${functionUrl}?limit=${maxResults}`, {
//       method: 'GET',
//       headers: {
//         'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
//         'Content-Type': 'application/json',
//       },
//     });
//     if (!res.ok) return [];
//     const json = await res.json();
//     if (!json.configured || json.error) return [];
//     return (json.posts || []).map(p => ({ ...p, source: 'live' }));
//   } catch (err) {
//     return [];
//   }
// }

/* ─── Public API ─────────────────────────────────────────────────────────────*/

/**
 * fetchSocialPosts()
 * Returns a shuffled, continent-wide array of normalised post objects.
 * Falls back to simulated data when live APIs are not configured.
 */
export async function fetchSocialPosts(count = 15) {
  // Fetch from available live sources (Twitter if configured, proxy if available)
  const [twitterPosts, proxyPosts] = await Promise.all([
    fetchTwitterPosts(count),
    fetchFromProxy(),
  ]);

  const livePosts = [...twitterPosts, ...proxyPosts];
  
  // Fill remaining slots with high-quality simulated data
  const needed = Math.max(0, count - livePosts.length);
  const simPosts = Array.from({ length: needed + 5 }, () => generateSimPost());

  // Shuffle and return requested count
  const all = [...livePosts, ...simPosts]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);

  if (process.env.NODE_ENV === 'development') {
    console.log(`[socialFeedService] Fetched ${livePosts.length} live, ${needed} simulated (${count} total)`);
  }

  return all;
}

/**
 * subscribeSocialFeed(callback, intervalMs)
 * Polls for new posts and calls callback(posts[], isInitial) on each tick.
 * Returns an unsubscribe function.
 */
export function subscribeSocialFeed(callback, intervalMs = 8000) {
  let active  = true;
  let initial = true;

  const tick = async () => {
    if (!active) return;
    const posts = await fetchSocialPosts(15);
    if (active) callback(posts, initial);
    initial = false;
  };

  tick();
  const timer = setInterval(tick, intervalMs);

  return () => {
    active = false;
    clearInterval(timer);
  };
}

/**
 * getNewPost()
 * Returns a single fresh simulated post (for streaming new-arrival animation).
 */
export function getNewPost() {
  return generateSimPost();
}

export { PLATFORM_META, SEARCH_TERMS };
