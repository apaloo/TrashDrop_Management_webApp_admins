#!/bin/bash
# Setup Facebook Live Feed for TrashDrop
# This script configures Supabase secrets and deploys the Edge Function

echo "🚀 Setting up Facebook Live Feed for TrashDrop..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    # macOS installation
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    else
        # Linux installation
        curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
    fi
fi

# Verify supabase is linked
echo "🔗 Checking Supabase connection..."
supabase status

# Set Facebook credentials as secrets
echo "🔐 Setting Facebook credentials in Supabase secrets..."

supabase secrets set FACEBOOK_ACCESS_TOKEN="EAAROZBnPzAnYBRO7IKZBQRYxnXmkkpwBCaICguepHLkfdh3Bhjntc3lHQB7R0mQ1Y0RsYMZCLHxnZByRU4fYtiqmINQnw8A1ZAB6WuzT9oH5gPFSKikXpVLXhch9WScFvPV8Id1ozDBLcKUnWgs480zXUZBYKxZA3twKfcNiPmIpSMWR0BXhRNTo7sU6LO78Bk1fpgVjQZAuk2JPMCCHoQmVn7PDjrPuNha4FITM1UyruSfBrBK4QYD7IZAeDq9UtvD8W2YRN6kUXqlUhEcuiUvbmjwZDZD"

supabase secrets set FACEBOOK_APP_ID="1212737500938870"

echo "⚠️  Please enter your Facebook App Secret (from App Settings > Basic):"
read -s APP_SECRET
supabase secrets set FACEBOOK_APP_SECRET="$APP_SECRET"

# Deploy the Edge Function
echo "📦 Deploying facebook-feed Edge Function..."
supabase functions deploy facebook-feed

# Get the function URL
PROJECT_REF=$(supabase status | grep "Project Ref" | awk '{print $3}')
FUNCTION_URL="https://${PROJECT_REF}.supabase.co/functions/v1/facebook-feed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "🔗 Test URL:"
echo "${FUNCTION_URL}?profileId=100071279183559&limit=10"
echo ""
echo "🧪 Testing the endpoint..."
curl -s "${FUNCTION_URL}?profileId=100071279183559&limit=5" \
  -H "Authorization: Bearer $(grep REACT_APP_SUPABASE_ANON_KEY .env.local 2>/dev/null | cut -d= -f2 || echo 'YOUR_ANON_KEY')" \
  | head -c 500

echo ""
echo "📋 Next steps:"
echo "1. The social feed will now fetch real Facebook posts automatically"
echo "2. Only waste-related posts will be displayed"
echo "3. Token expires in ~60 days - remember to refresh it"
