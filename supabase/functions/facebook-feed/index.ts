import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Facebook Feed Edge Function
 * 
 * Fetches public posts from a Facebook profile using the Graph API.
 * Target Profile: https://web.facebook.com/profile.php?id=100071279183559
 * 
 * Required Environment Variables:
 * - FACEBOOK_APP_ID: Facebook App ID
 * - FACEBOOK_APP_SECRET: Facebook App Secret
 * - FACEBOOK_ACCESS_TOKEN: Page/User Access Token with pages_read_engagement permission
 */

interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  permalink_url?: string;
  likes?: { summary?: { total_count?: number } };
  shares?: { count?: number };
  place?: { name?: string; location?: { latitude?: number; longitude?: number } };
}

interface TransformedPost {
  id: string;
  platform: 'facebook';
  handle: string;
  avatar: string;
  text: string;
  location: string;
  lat: number;
  lng: number;
  risk: 'High' | 'Medium' | 'Low' | 'Critical';
  time: string;
  likes: number;
  shares: number;
  verified: boolean;
  source: 'live';
  url?: string;
  image?: string;
}

// Facebook Graph API configuration
const GRAPH_API_BASE = 'https://graph.facebook.com/v18.0';

// Keywords to detect waste/dumping related content
const WASTE_KEYWORDS = [
  'dump', 'waste', 'trash', 'garbage', 'litter', 'pollution',
  'illegal dumping', 'waste site', 'trash pile', 'cleanup',
  'environment', 'pollution', 'refuse', 'debris'
];

// Ghana locations for geo-tagging when location is missing
const GHANA_LOCATIONS = [
  { name: 'Accra, Ghana', lat: 5.6037, lng: -0.1870 },
  { name: 'Kumasi, Ghana', lat: 6.6885, lng: -1.6244 },
  { name: 'Takoradi, Ghana', lat: 4.8845, lng: -1.7554 },
  { name: 'Tamale, Ghana', lat: 9.4008, lng: -0.8393 },
];

function extractRiskLevel(text: string): TransformedPost['risk'] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('critical') || lowerText.includes('hazardous') || lowerText.includes('medical waste')) {
    return 'Critical';
  }
  if (lowerText.includes('high') || lowerText.includes('large') || lowerText.includes('massive')) {
    return 'High';
  }
  if (lowerText.includes('medium') || lowerText.includes('moderate')) {
    return 'Medium';
  }
  return 'Low';
}

function isWasteRelated(text: string): boolean {
  const lowerText = text.toLowerCase();
  return WASTE_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

function transformFacebookPost(post: FacebookPost, profileName: string): TransformedPost | null {
  const message = post.message || '';
  
  // Only include posts that are waste-related
  if (!isWasteRelated(message)) {
    return null;
  }

  const location = post.place?.name || GHANA_LOCATIONS[0].name;
  const lat = post.place?.location?.latitude || GHANA_LOCATIONS[0].lat + (Math.random() - 0.5) * 0.02;
  const lng = post.place?.location?.longitude || GHANA_LOCATIONS[0].lng + (Math.random() - 0.5) * 0.02;

  const createdDate = new Date(post.created_time);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60));
  
  let timeStr: string;
  if (diffMinutes < 60) {
    timeStr = `${diffMinutes}m ago`;
  } else if (diffMinutes < 1440) {
    timeStr = `${Math.floor(diffMinutes / 60)}h ago`;
  } else {
    timeStr = `${Math.floor(diffMinutes / 1440)}d ago`;
  }

  return {
    id: `fb-${post.id}`,
    platform: 'facebook',
    handle: profileName || 'Facebook User',
    avatar: 'f',
    text: message.length > 280 ? message.substring(0, 277) + '...' : message,
    location,
    lat,
    lng,
    risk: extractRiskLevel(message),
    time: timeStr,
    likes: post.likes?.summary?.total_count || 0,
    shares: post.shares?.count || 0,
    verified: true,
    source: 'live',
    url: post.permalink_url,
    image: post.full_picture,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Default to Accra Metropolitan Assembly public page (was previously private profile 100071279183559)
    const profileId = url.searchParams.get('profileId') || 'AccraMetropolis';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // Get environment variables
    const appId = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    const accessToken = Deno.env.get('FACEBOOK_ACCESS_TOKEN');

    // Check if Facebook API is configured
    if (!appId || !appSecret || !accessToken) {
      console.warn('[facebook-feed] Facebook API not configured, returning empty response');
      return new Response(
        JSON.stringify({ 
          posts: [], 
          error: 'Facebook API not configured',
          configured: false 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Build Facebook Graph API URL
    // Using the profile ID to fetch posts
    const fields = 'id,message,created_time,full_picture,permalink_url,likes.limit(0).summary(true),shares,place';
    const graphUrl = `${GRAPH_API_BASE}/${profileId}/posts?fields=${fields}&limit=${limit}&access_token=${accessToken}`;

    // Fetch from Facebook
    const fbResponse = await fetch(graphUrl);
    
    if (!fbResponse.ok) {
      const errorData = await fbResponse.json();
      console.error('[facebook-feed] Facebook API error:', errorData);
      
      const errorMessage = errorData.error?.message || 'Failed to fetch from Facebook';
      const isPermissionError = errorMessage.includes('missing permissions') || 
                                errorMessage.includes('does not exist') ||
                                errorMessage.includes('Unsupported get request');
      
      // Return informative error for permission issues
      return new Response(
        JSON.stringify({ 
          posts: [], 
          error: errorMessage,
          errorType: isPermissionError ? 'PERMISSION_DENIED' : 'API_ERROR',
          configured: true,
          suggestion: isPermissionError 
            ? 'The target profile may be private or require additional permissions. Try using a Facebook Page ID instead of a user profile ID.' 
            : 'Check your Facebook App settings and token permissions.'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const fbData = await fbResponse.json();
    const posts: FacebookPost[] = fbData.data || [];

    // Get profile name (we'll use a placeholder since user profiles require different permissions)
    const profileName = 'Facebook User';

    // Transform and filter posts
    const transformedPosts = posts
      .map(post => transformFacebookPost(post, profileName))
      .filter((post): post is TransformedPost => post !== null);

    console.log(`[facebook-feed] Fetched ${posts.length} posts, ${transformedPosts.length} waste-related`);

    return new Response(
      JSON.stringify({ 
        posts: transformedPosts,
        configured: true,
        totalFetched: posts.length,
        wasteRelated: transformedPosts.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[facebook-feed] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        posts: [], 
        error: error instanceof Error ? error.message : 'Unknown error',
        configured: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
