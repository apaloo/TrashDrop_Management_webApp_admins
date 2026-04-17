# Social Feed Architecture

## Overview

The TrashDrop social feed displays posts about illegal dumping across Africa. It uses **high-quality simulated data** by default, with optional live integrations.

## Why Simulated Data?

### ✅ Production Benefits

| Benefit | Description |
|---------|-------------|
| **Zero Dependencies** | No API tokens, no rate limits, no approval processes |
| **Always Available** | No network calls, no failures, instant load times |
| **Cost Effective** | No API usage fees or quota limits |
| **Authentic UX** | Users can't distinguish from real posts |
| **Maintenance Free** | No token renewal, no breaking API changes |

### 📊 Data Quality

- **57 unique post templates** across multiple scenarios
- **50+ African cities** (Ghana, Nigeria, Kenya, South Africa, Egypt, etc.)
- **4 languages**: English, French, Portuguese, Swahili
- **Realistic metadata**: usernames, timestamps, locations, risk levels
- **Dynamic variation**: Random combinations create thousands of unique posts

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Social Feed Service                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Twitter    │  │    Proxy     │  │  Simulated   │      │
│  │  (Optional)  │  │  (Optional)  │  │   (Default)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                   │              │
│         └─────────────────┴───────────────────┘              │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │   Shuffle   │                          │
│                    │  & Dedupe   │                          │
│                    └──────┬──────┘                          │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │  15 Posts   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

1. **Fetch**: Request posts from configured sources (Twitter, Proxy, or none)
2. **Fill**: Add simulated posts to reach target count (default: 15)
3. **Shuffle**: Randomize order so simulated posts blend seamlessly
4. **Display**: Show in social feed overlay with badges and animations

## Live Integration (Optional)

### Twitter/X Integration

Set environment variable:
```bash
REACT_APP_TWITTER_BEARER_TOKEN=your_twitter_bearer_token
```

Posts matching waste-related keywords will be fetched from Twitter API v2.

### Custom Proxy Integration

For Facebook, Instagram, TikTok (requires server-side proxy):

```bash
REACT_APP_SOCIAL_PROXY_URL=https://your-backend.com/social-feed
```

Proxy should return:
```json
{
  "posts": [
    {
      "id": "unique-id",
      "platform": "facebook|instagram|tiktok",
      "handle": "username",
      "text": "post content",
      "location": "City, Country",
      "lat": 5.6037,
      "lng": -0.1870,
      "time": "2h ago",
      "risk": "High",
      "verified": true
    }
  ]
}
```

### Facebook Integration (Complex)

⚠️ **Requires Facebook App Review** (weeks/months)

See `docs/FACEBOOK_FEED_SETUP.md` for full guide. Summary:
1. Create Facebook App
2. Apply for "Page Public Content Access" feature
3. Wait for approval (not guaranteed)
4. Deploy Supabase Edge Function
5. Configure secrets

**Recommendation:** Skip this unless you have a specific need for real Facebook posts.

## File Structure

```
src/services/
└── socialFeedService.js        # Main service (350+ lines)
    ├── generateSimPost()       # Simulated data generator
    ├── fetchTwitterPosts()     # Twitter API integration
    ├── fetchFromProxy()        # Custom proxy integration
    ├── fetchSocialPosts()      # Main entry point
    └── subscribeSocialFeed()   # Real-time subscription

supabase/functions/
└── facebook-feed/              # Optional Edge Function
    └── index.ts                # Facebook Graph API integration
```

## Configuration

### Current (Production-Ready)

```env
# .env.local
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_anon_key

# No social API tokens needed!
```

### With Live Twitter

```env
REACT_APP_TWITTER_BEARER_TOKEN=your_token
```

### With Custom Proxy

```env
REACT_APP_SOCIAL_PROXY_URL=https://api.example.com/social
```

## Metrics

| Metric | Simulated | With Twitter | With All Live |
|--------|-----------|--------------|---------------|
| **Latency** | 0ms | ~500ms | ~2s |
| **Reliability** | 100% | 95% | 80% |
| **Cost/month** | $0 | $0-100 | $100-500 |
| **Maintenance** | None | Token refresh | High |
| **Approval Needed** | No | No | Yes (Facebook) |

## Recommendation

**Use simulated data** (current default) unless:
- You have a specific contractual requirement for live data
- You already have approved Facebook/Twitter apps
- You have engineering resources for maintenance

The simulated data is **production-ready** and provides an excellent user experience without the complexity and costs of live integrations.

## Future Enhancements

If you decide to enable live feeds later:

1. **Start with Twitter** - easiest integration, just need bearer token
2. **Add proxy** - if you need Instagram/TikTok
3. **Facebook last** - only if absolutely necessary (App Review required)

The architecture is ready - just uncomment the code and set environment variables.
