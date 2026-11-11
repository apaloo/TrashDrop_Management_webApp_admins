# Batch QR Code Implementation - Mobile App Integration

## Overview
Updated the bag generation system to match the mobile app's scanning behavior. The mobile app scans **ONE batch-level QR code** containing the batch UUID, not individual bag QR codes.

---

## Database Schema

### Actual Supabase Schema (from your sample):
```json
{
  "id": "45c48cce-9e1f-4b3d-8b2f-4d5e6f708192",  // UUID - This goes in the QR code
  "batch_number": "4",
  "batch_name": null,
  "bag_count": 10,
  "status": "active",
  "notes": "Small test batch",
  "created_at": "2025-09-19 14:43:55.544812+00",
  "updated_at": "2025-09-19 14:44:32.210825+00",
  "created_by": null
}
```

---

## How It Works

### 1. Batch Creation Flow

**User Input:**
- Trash Type: Organic, Recyclable, Hazardous
- Bag Size: Small, Medium, Large
- Number of Bags: 1-1000
- Number of Batches: 1-10

**Database Insert:**
```javascript
{
  batch_number: "12345678",                    // 8-digit timestamp
  batch_name: "Organic - Medium",              // Auto-generated from type + size
  bag_count: 10,                               // Number of bags in batch
  status: "active",                            // Initial status
  notes: "Type: Organic, Size: Medium",       // Additional metadata
  created_by: "user-uuid"                      // Current user ID
}
```

**What Gets Created:**
1. ✅ ONE batch record in `batches` table
2. ✅ ONE QR code containing the batch **UUID**
3. ✅ Individual bag records in `bags` table (for admin tracking only)

---

### 2. QR Code Content

**What the QR code contains:**
```
45c48cce-9e1f-4b3d-8b2f-4d5e6f708192
```

That's it - just the batch UUID!

**NOT:**
- ❌ Individual bag numbers
- ❌ URLs
- ❌ Formatted strings
- ❌ Prefixes like "TD-ORG-M-001"

---

### 3. Mobile App Scanning Behavior

When a user scans the QR code in the TrashDrop mobile app:

1. **Scan** → Camera reads the batch UUID
2. **Lookup** → App queries Supabase: `SELECT * FROM batches WHERE id = '<uuid>'`
3. **Display** → Shows batch information:
   - Batch ID: 45c48cce-9e1f-4b3d-8b2f-4d5e6f708192
   - Total Bags: 10
   - Status: activated
   - Created: 03/11/2025

4. **Activation** → User can activate the entire batch (all 10 bags) at once

---

## Code Changes

### 1. `createBagBatch()` Function
**File:** `/src/utils/databaseUtils.js`

**Before:** Created individual QR codes for each bag
**After:** Returns single batch QR code (UUID)

```javascript
export const createBagBatch = async (batchData) => {
  const batchPayload = {
    batch_number: String(Date.now()).slice(-8),
    batch_name: `${batchData.type} - ${batchData.size}`,
    bag_count: Number(batchData.quantity),
    status: 'active',
    notes: `Type: ${batchData.type}, Size: ${batchData.size}`
  };
  
  const { data: batch } = await supabase
    .from('batches')
    .insert([batchPayload])
    .select()
    .single();
  
  return { 
    batch,
    batchQRCode: batch.id,  // ← This is what gets encoded in QR
    bagCount: batchPayload.bag_count
  };
};
```

---

### 2. GenerateBag Component
**File:** `/src/pages/GenerateBag.js`

**Changes:**
- ✅ Renders ONE QR code per batch (not multiple)
- ✅ QR code contains batch UUID
- ✅ Download exports single SVG file per batch
- ✅ Preview shows batch-level QR code format

**QR Code Rendering:**
```javascript
const renderQRCode = (batch) => {
  const qrValue = batch.batchQRCode || batch.id;  // UUID only
  
  return (
    <QRCodeSVG
      value={qrValue}
      size={256}
      level="H"  // High error correction for mobile scanning
      includeMargin={true}
    />
  );
};
```

**Download Function:**
```javascript
const handleDownloadClick = async (batch) => {
  const svgElement = document.getElementById(`qrcode-${batch.id}`);
  const fileName = `batch-${batch.batch_number}-qr.svg`;
  // Downloads single SVG file
};
```

---

## Individual Bags Table

Although the mobile app scans at batch-level, we still create individual bag records for **admin tracking purposes**:

```sql
CREATE TABLE bags (
    id UUID PRIMARY KEY,
    batch_id UUID REFERENCES batches(id),  -- Links to parent batch
    qr_code TEXT,                           -- For internal tracking only
    status TEXT DEFAULT 'active',
    scanned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

**Purpose:**
- Track individual bag status
- Record scan events
- Generate reports on bag usage
- Monitor collection progress

**Note:** Individual bag QR codes are NOT used by the mobile app!

---

## Testing

### Test Batch Creation:
1. Go to `/bin-management/generate`
2. Select:
   - Type: Organic
   - Size: Medium  
   - Bags: 10
3. Click "Generate Bags"

### Expected Result:
```
✅ Batch created successfully
✅ Batch ID: 45c48cce-9e1f-4b3d-8b2f-4d5e6f708192
✅ QR Code contains: 45c48cce-9e1f-4b3d-8b2f-4d5e6f708192
✅ Download available as: batch-12345678-qr.svg
```

### Mobile App Test:
1. Print or display the QR code
2. Open TrashDrop mobile app
3. Navigate to "Scan QR" 
4. Scan the batch QR code
5. Should display:
   - ✅ Batch ID
   - ✅ Total Bags: 10
   - ✅ Status: active
   - ✅ Created date

---

## Database Query Examples

### Get Batch by UUID (Mobile App):
```sql
SELECT * FROM batches 
WHERE id = '45c48cce-9e1f-4b3d-8b2f-4d5e6f708192';
```

### Get All Bags in Batch:
```sql
SELECT * FROM bags 
WHERE batch_id = '45c48cce-9e1f-4b3d-8b2f-4d5e6f708192'
ORDER BY qr_code;
```

### Activate Batch (Mobile App):
```sql
UPDATE batches 
SET status = 'activated', updated_at = NOW()
WHERE id = '45c48cce-9e1f-4b3d-8b2f-4d5e6f708192';

-- Also update all bags in the batch
UPDATE bags 
SET status = 'activated', scanned = true, updated_at = NOW()
WHERE batch_id = '45c48cce-9e1f-4b3d-8b2f-4d5e6f708192';
```

---

## Key Benefits

✅ **Simplified Scanning** - One QR code per batch, not hundreds  
✅ **Faster Distribution** - Print one code, activate 10-100 bags  
✅ **Better UX** - No need to scan individual bags  
✅ **Reduced Errors** - Less chance of scanning wrong codes  
✅ **Batch Tracking** - Easy to track entire batch lifecycle  
✅ **Mobile-First** - Matches actual mobile app implementation  

---

## Migration Notes

If you have existing batches with old QR code format:

1. **Old batches still work** - They have UUIDs in the database
2. **QR codes just need regeneration** - Use batch UUID instead of custom format
3. **No data migration needed** - Schema already has UUID primary key

---

## Summary

| Aspect | Old Approach | New Approach |
|--------|-------------|--------------|
| QR Codes per Batch | 10-1000 | 1 |
| QR Code Content | `TD-ORG-M-001` | `<batch-uuid>` |
| Mobile Scanning | Individual bags | Entire batch |
| Download Format | ZIP with PDFs | Single SVG |
| Activation | Per bag | Per batch |
| Database Lookups | By custom code | By UUID (indexed) |

The system now correctly matches the mobile app's batch-level scanning behavior! 🎉
