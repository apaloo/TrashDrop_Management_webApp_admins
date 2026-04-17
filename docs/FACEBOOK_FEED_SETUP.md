# Facebook Live Feed Integration (OPTIONAL - Advanced)

> ⚠️ **WARNING**: This integration is **optional** and **complex**. 
> 
> - Requires Facebook App Review (weeks/months, not guaranteed)
> - Needs ongoing token maintenance
> - TrashDrop social feed **already works perfectly** with simulated data
> 
> **Only proceed if you have a specific requirement for real Facebook posts.**
> 
> See `docs/SOCIAL_FEED_ARCHITECTURE.md` for architecture overview.

---

This guide explains how to connect TrashDrop to a live Facebook page (requires App Review).

## Overview

The Facebook live feed integration fetches public posts from a Facebook profile and displays them in the social feed overlay on the homepage map. Posts are filtered to show only waste/dumping-related content.

**Target Profile:** https://web.facebook.com/profile.php?id=100071279183559

## Architecture

```
┌─────────────────┐     ┌─────────────────────────┐     ┌──────────────────┐
│   React App     │────▶│  Supabase Edge Function │────▶│  Facebook Graph  │
│  (Frontend)     │     │  (facebook-feed)        │     │  API             │
└─────────────────┘     └─────────────────────────┘     └──────────────────┘
       │                       │
       │                       │
       ▼                       ▼
┌─────────────────┐     ┌─────────────────────────┐
│  Social Feed    │     │  Environment Variables  │
│  UI Component   │     │  (FACEBOOK_APP_ID, etc) │
└─────────────────┘     └─────────────────────────┘
```

## Setup Instructions

### 1. Create a Facebook App

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app (select "Business" type)
3. Add the **Graph API** product to your app
4. Note down your **App ID** and **App Secret**

### 2. Get an Access Token

For a public profile feed, you need a **Page Access Token** or **User Access Token** with appropriate permissions:

**Option A: Page Access Token (Recommended for public pages)**
```bash
# Get a Page Access Token with pages_read_engagement permission
curl -X GET "https://graph.facebook.com/v18.0/me/accounts?access_token=YOUR_USER_ACCESS_TOKEN"
```

**Option B: User Access Token**
1. Go to [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app
3. Generate a token with these permissions:
   - `pages_read_engagement`
   - `pages_read_user_content`
   - `public_profile`

**Note:** User access tokens expire and need refresh logic. For production, implement token refresh or use a long-lived token.

### 3. Configure Supabase Edge Function Secrets

Deploy the Edge Function and set environment variables:

```bash
# Deploy the function
supabase functions deploy facebook-feed

# Set secrets
supabase secrets set FACEBOOK_APP_ID=your_app_id
supabase secrets set FACEBOOK_APP_SECRET=your_app_secret
supabase secrets set FACEBOOK_ACCESS_TOKEN=your_access_token
```

### 4. Verify the Setup

Test the endpoint:

```bash
curl "https://your-project.supabase.co/functions/v1/facebook-feed?profileId=100071279183559&limit=10" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

Expected response:
```json
{
  "posts": [...],
  "configured": true,
  "totalFetched": 20,
  "wasteRelated": 5
}
```

## How It Works

### Post Filtering

The Edge Function only returns posts containing waste-related keywords:
- `dump`, `waste`, `trash`, `garbage`, `litter`, `pollution`
- `illegal dumping`, `waste site`, `trash pile`, `cleanup`
- `environment`, `pollution`, `refuse`, `debris`

### Risk Level Detection

Posts are automatically tagged with risk levels based on content:
- **Critical**: "hazardous", "medical waste", "critical"
- **High**: "high", "large", "massive"
- **Medium**: "medium", "moderate"
- **Low**: Default

### Location Handling

- If the Facebook post has location data, it's used
- Otherwise, posts are tagged with Ghana locations (Accra, Kumasi, Takoradi, Tamale)

## Limitations

1. **Profile vs Page**: The Graph API has different permissions for user profiles vs pages. This integration targets the specific profile ID you provided.

2. **Privacy**: Only **public** posts can be fetched. Private posts require the user to grant your app permission.

3. **Rate Limits**: Facebook Graph API has rate limits. Monitor your usage in the Facebook Developer Dashboard.

4. **Token Expiration**: User access tokens expire after ~60 days. Implement refresh logic for production.

## Troubleshooting

### "Facebook API not configured" Error

The Edge Function returns this when environment variables are missing. Check:
```bash
supabase secrets list
```

### Empty Posts Array

Possible causes:
1. Profile has no public posts with waste-related keywords
2. Access token lacks required permissions
3. Profile ID is incorrect

### CORS Errors

The Edge Function includes CORS headers. If you see CORS errors:
1. Verify the function deployed correctly
2. Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in your React app

## File Structure

```
supabase/
├── functions/
│   ├── facebook-feed/
│   │   └── index.ts          # Edge Function code
│   └── _shared/
│       └── cors.ts           # CORS headers
└── ...

src/
├── services/
│   └── socialFeedService.js  # Updated to call Facebook endpoint
└── ...
```

## Security Notes

- Never commit Facebook credentials to git
- Use Supabase Secrets for server-side credentials
- The access token is only used server-side in the Edge Function
- Frontend only needs `SUPABASE_URL` and `SUPABASE_ANON_KEY`

## Next Steps

1. Set up your Facebook App
2. Get an access token
3. Deploy the Edge Function
4. Test the integration
5. Monitor the Facebook Developer Dashboard for API usage
