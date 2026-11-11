# Fix Illegal Dumping Data Issues

## Problems Identified

Your Supabase data has three critical issues:

### 1. **Blob URLs in Photos Array** ❌
```json
"photos": [
  "blob:http://localhost:3001/a1042ff9-df8c-41ef-bee9-5855ba3a4a20",
  "blob:http://localhost:3001/86058b15-9b0c-48fe-994c-dc6782161dfc",
  ...
]
```

**Issue**: Blob URLs are temporary browser memory references that:
- Only exist during the session that created them
- Cannot be accessed from other browsers or devices
- Will not work in the admin portal
- Are lost when the browser is closed

**Root Cause**: The mobile app is storing blob URLs instead of uploading files to Supabase Storage first.

### 2. **PostGIS Binary Coordinates** ⚠️
```json
"coordinates": "0101000020E61000001844A2B11C1AF7BF997FE4A250E41A40"
```

**Issue**: This is a PostGIS EWKB (Extended Well-Known Binary) format that needs to be decoded to get latitude/longitude.

### 3. **Missing Location Address** ⚠️
```json
"location": "Unknown location"
```

**Issue**: Reverse geocoding failed during report submission.

---

## Immediate Fix (Run This Now)

### Step 1: Execute SQL Fix in Supabase

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Run the file: `fix_blob_urls_and_coordinates.sql`

This will:
- ✅ Extract latitude/longitude from PostGIS geometry
- ✅ Remove all blob URLs from photos arrays
- ✅ Add proper coordinate columns
- ✅ Update location descriptions with coordinates
- ✅ Create indexes for performance

### Step 2: Verify the Fix

After running the SQL, check your data:

```sql
SELECT 
    id,
    location,
    latitude,
    longitude,
    photos,
    jsonb_array_length(photos) as photo_count
FROM public.illegal_dumping
WHERE id = '01d4ae93-b452-4a33-90d3-a51da93b2ad8';
```

**Expected Result**:
- `latitude`: 6.9260 (extracted from geometry)
- `longitude`: -1.5688 (extracted from geometry)
- `photos`: `[]` (blob URLs removed)
- `location`: Updated with coordinates

---

## Long-term Solution: Fix Mobile App

The mobile app needs to upload photos to Supabase Storage **before** creating the report.

### Current (Wrong) Flow:
```
1. User selects photos → Creates blob URLs
2. Submits report with blob URLs ❌
3. Blob URLs saved to database ❌
```

### Correct Flow:
```
1. User selects photos → Creates blob URLs
2. Upload photos to Supabase Storage ✅
3. Get permanent URLs from Storage ✅
4. Submit report with permanent URLs ✅
```

### Mobile App Code Fix

**Before** (Wrong):
```javascript
// ❌ DON'T DO THIS
const photos = selectedImages.map(img => img.uri); // blob URLs
await supabase.from('illegal_dumping').insert({
  photos: photos, // Storing blob URLs!
  ...
});
```

**After** (Correct):
```javascript
// ✅ DO THIS
import { uploadIllegalDumpingImages } from './utils/imageUpload';

// 1. Upload images first
const permanentUrls = await uploadIllegalDumpingImages(
  selectedImages, 
  reportId
);

// 2. Then save report with permanent URLs
await supabase.from('illegal_dumping').insert({
  photos: permanentUrls, // Permanent Supabase Storage URLs
  ...
});
```

### Required: Create Supabase Storage Bucket

1. Go to **Storage** in Supabase Dashboard
2. Create a new bucket: `illegal-dumping-photos`
3. Set bucket to **Public** (or configure RLS policies)
4. Update mobile app to use this bucket

---

## Admin Portal Integration

The admin portal already has proper image upload utilities:

### File: `src/utils/imageUpload.js`

```javascript
import { uploadIllegalDumpingImages } from '../utils/imageUpload';

// Upload images and get permanent URLs
const imageUrls = await uploadIllegalDumpingImages(files, reportId);
```

This utility:
- ✅ Uploads to Supabase Storage bucket `illegal-dumping-photos`
- ✅ Returns permanent public URLs
- ✅ Organizes files by report ID
- ✅ Handles errors gracefully

---

## Database Schema Updates

### Add Coordinate Columns

The SQL fix adds these columns:

```sql
ALTER TABLE public.illegal_dumping 
ADD COLUMN latitude numeric(10, 8),
ADD COLUMN longitude numeric(11, 8);
```

### Update Your Code to Use New Columns

**In queries**:
```javascript
const { data } = await supabase
  .from('illegal_dumping')
  .select('id, latitude, longitude, location, photos, ...')
  .eq('status', 'pending');
```

**In the map component**:
```javascript
// Use the new columns
const lat = report.latitude;
const lng = report.longitude;

// Fallback to parsing coordinates if needed
if (!lat || !lng) {
  const coords = parseCoordinates(report.coordinates);
  lat = coords.lat;
  lng = coords.lng;
}
```

---

## Testing Checklist

After applying fixes:

### ✅ Database
- [ ] Run `fix_blob_urls_and_coordinates.sql`
- [ ] Verify latitude/longitude columns exist
- [ ] Verify blob URLs are removed
- [ ] Check location descriptions are updated

### ✅ Storage
- [ ] Create `illegal-dumping-photos` bucket
- [ ] Set appropriate access policies
- [ ] Test upload from admin portal

### ✅ Mobile App
- [ ] Update to upload images before submitting
- [ ] Use `uploadIllegalDumpingImages` utility
- [ ] Test end-to-end submission
- [ ] Verify permanent URLs in database

### ✅ Admin Portal
- [ ] Verify reports display correctly
- [ ] Check map shows correct coordinates
- [ ] Test image viewing (should show empty or proper URLs)
- [ ] Test new report creation with images

---

## Utility Scripts

### Check Photo Statistics

Run in browser console or create admin tool:

```javascript
import { getPhotoStatistics } from './utils/fixBlobUrls';

const stats = await getPhotoStatistics();
console.log(stats);
```

### Fix All Blob URLs

```javascript
import { fixAllBlobUrls } from './utils/fixBlobUrls';

const result = await fixAllBlobUrls();
console.log(`Fixed ${result.fixedCount} reports`);
console.log(`Removed ${result.totalRemoved} blob URLs`);
```

---

## Prevention

### Mobile App Validation

Add validation before submission:

```javascript
const validatePhotos = (photos) => {
  const invalidUrls = photos.filter(url => 
    url.startsWith('blob:') || url.startsWith('data:')
  );
  
  if (invalidUrls.length > 0) {
    throw new Error('Photos must be uploaded to storage first');
  }
};
```

### Database Constraint

Add a check constraint (optional):

```sql
ALTER TABLE public.illegal_dumping
ADD CONSTRAINT check_no_blob_urls 
CHECK (photos::text NOT LIKE '%blob:%');
```

---

## Summary

**Immediate Actions**:
1. ✅ Run `fix_blob_urls_and_coordinates.sql` in Supabase
2. ✅ Create `illegal-dumping-photos` storage bucket
3. ✅ Update mobile app to upload images before submitting

**Result**:
- Existing data cleaned up
- Future submissions will have permanent photo URLs
- Maps will display correct coordinates
- Admin portal will work properly

---

## Support

If you encounter issues:

1. Check Supabase logs for upload errors
2. Verify storage bucket permissions
3. Test with a single report first
4. Review the `imageUpload.js` utility for errors

**Current Data Status**:
- Report ID: `01d4ae93-b452-4a33-90d3-a51da93b2ad8`
- Status: `pending`
- Photos: 5 blob URLs (need removal)
- Coordinates: Binary format (need extraction)
- Location: "Unknown location" (need geocoding)
