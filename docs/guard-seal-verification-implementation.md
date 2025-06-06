# Guard Seal Tag Verification Implementation Guide

## Overview

This document outlines the implementation strategy for Guard Seal Tag verification, utilizing the same approach as currently implemented for Operator Seal Tags. This approach uses base64 encoding for image storage and maintains data in both dedicated database tables and ActivityLog records for redundancy and audit purposes.

## Current Architecture

### Data Storage Strategy

The current system uses a dual-storage approach for Operator Seal Tags:

1. **Primary Storage**: Data is stored in the `SealTag` table with direct fields for:
   - `id`: Unique identifier
   - `barcode`: The seal tag ID/barcode
   - `sessionId`: Associated session
   - `method`: How the tag was scanned ("digitally scanned" or "manually entered")
   - `imageUrl`: URL reference to image (optional)
   - `imageData`: Base64-encoded image data stored directly in the database
   - `scannedById`: ID of the operator who scanned the tag
   - `scannedByName`: Name of the operator who scanned the tag
   - `createdAt`: Timestamp when the tag was scanned

2. **Redundant Storage**: The same data is also stored in `ActivityLog` records:
   - One record for session details, including seal tag IDs, methods, and timestamps
   - One record for image data, storing base64-encoded images for all seal tags

3. **Data Recovery**: API endpoints exist to fix SealTag records by retrieving data from ActivityLogs:
   - `/api/sessions/[id]/fix-seal-images`
   - `/api/sessions/[id]/fix-seal-timestamps`

4. **Client-side Detection**: The client automatically detects and fixes issues with SealTag records when viewing sessions.

## Implementation Plan for Guard Seal Verification

### 1. Database Schema (Already Exists)

The `GuardSealTag` model is already defined in the schema.prisma file:

```prisma
model GuardSealTag {
  id            String   @id @default(uuid())
  barcode       String   @unique
  sessionId     String
  method        String
  imageUrl      String?
  imageData     String?  // Store base64 image data directly like operator side
  mediaId       String?  @unique
  createdAt     DateTime @default(now())
  verifiedById  String?
  status        String?  @default("VERIFIED")
  session       Session  @relation("GuardSealTags", fields: [sessionId], references: [id], onDelete: Cascade)
  verifiedBy    User?    @relation("GuardSealTagVerifiedBy", fields: [verifiedById], references: [id])
  media         Media?   @relation("GuardSealTagMedia", fields: [mediaId], references: [id])

  @@map("guard_seal_tags")
}
```

### 2. API Endpoints to Implement

#### 2.1. Create/Update Guard Seal Tags Endpoint

Create a new endpoint at `/api/sessions/[id]/guard-seals` that handles:

- `POST`: Add a new guard seal tag verification to a session
- `PUT`: Update an existing guard seal tag verification

This endpoint should:
1. Accept base64-encoded image data
2. Create GuardSealTag records
3. Create ActivityLog entries for both the verification details and image data
4. Handle potential errors with database transactions

#### 2.2. Retrieve Guard Seal Tags Endpoint

Extend the existing `/api/sessions/[id]/seals` endpoint or create a new endpoint to:
1. Retrieve all guard seal tag verifications for a session
2. Include all relevant details including images

#### 2.3. Fix Guard Seal Tags Endpoints

Clone the existing fix endpoints for guard seal tags:
1. `/api/sessions/[id]/fix-guard-seal-images`
2. `/api/sessions/[id]/fix-guard-seal-timestamps`

### 3. Frontend Components

#### 3.1. Guard Seal Tag Scanning Interface

Create a new interface for guards to scan and verify seal tags:
1. Barcode scanner integration
2. Camera access for capturing images
3. Form for additional verification details
4. Status options (VERIFIED, BROKEN, TAMPERED, MISSING)

**Important UI Requirements:**
- **Mandatory Photo for Manual Entry**: When a seal tag ID is manually entered (not scanned), a photo must be captured before the 'Add' button is enabled
- The "Add" button should remain disabled until both the seal tag ID and a photo are provided
- Display clear visual feedback when a photo is missing
- Include a camera button prominently near the manual entry field

#### 3.2. Session Verification View

Enhance the session details view to include:
1. A section showing all guard-verified seal tags
2. Images of the seal tags taken by guards
3. Comparison with operator-applied seal tags
4. Status indicators for each seal tag

#### 3.3. Completed Session Details Display

In the completed Session Details page:

1. **Guard Seal Tag Table**:
   - Display a dedicated table showing all Guard seal tags
   - Include columns for: Seal ID, Verification Status, Verified By, Method, Created At, Image
   - Use color coding to indicate status (green for VERIFIED, red for BROKEN/TAMPERED, etc.)
   - Allow clicking on images to see larger versions

2. **Verification Results Table**:
   - Add a comparison table showing Operator vs. Guard verification results
   - Include columns for: Seal ID, Operator Scan Time, Guard Verification Time, Status, Match/Mismatch
   - Highlight mismatches or discrepancies in red

3. **Match Statistics**:
   - Below the verification tables, add a summary section showing:
   - Total seal tags scanned by Operator: [count]
   - Total seal tags verified by Guard: [count]
   - Matching seal tags: [count] ([percentage]%)
   - Mismatched seal tags: [count] ([percentage]%)
   - Broken/Tampered seal tags: [count] ([percentage]%)
   - Missing seal tags: [count] ([percentage]%)

4. **Visualization**:
   - Consider adding a simple pie chart showing the distribution of verification statuses

### 4. Implementation Details

#### 4.1. ActivityLog Structure for Guard Seal Tags

Create two ActivityLog entries for guard seal verification:

**Verification Details Log:**
```json
{
  "userId": "guard-user-id",
  "action": "UPDATE",
  "targetResourceId": "session-id",
  "targetResourceType": "session",
  "details": {
    "verification": {
      "guardSealTagData": {
        "sealTagIds": ["tag1", "tag2", "..."],
        "sealTagMethods": {"tag1": "digitally scanned", "..."},
        "sealTagTimestamps": {"tag1": "2025-06-05T10:15:30.123Z", "..."},
        "sealTagStatuses": {"tag1": "VERIFIED", "tag2": "BROKEN", "..."}
      }
    }
  }
}
```

**Image Data Log:**
```json
{
  "userId": "guard-user-id",
  "action": "UPDATE",
  "targetResourceId": "session-id",
  "targetResourceType": "session",
  "details": {
    "guardImageBase64Data": {
      "sealTagImages": {
        "tag1": {
          "data": "base64-encoded-image-data...",
          "contentType": "image/jpeg",
          "name": "guard-seal-tag1.jpg",
          "method": "digitally scanned"
        }
      }
    }
  }
}
```

#### 4.2. Transaction Management

Use Prisma transactions to ensure atomicity:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Create GuardSealTag records
  // 2. Create ActivityLog entry for verification details
  // 3. Create ActivityLog entry for image data
  // All operations succeed or all fail
});
```

#### 4.3. Image Processing

Implement client-side image processing similar to the operator flow:

1. Resize images to limit dimensions (e.g., 1280x1280)
2. Compress images to reduce file size
3. Convert to base64 for transmission
4. Handle potential errors during processing

### 5. Client-Side Data Synchronization

#### 5.1. Automatic Detection and Fixing

Extend the client component to detect and fix issues with guard seal tags:

```typescript
// Check for missing guard seal tag images
const hasMissingGuardImages = session.guardSealTags.some((tag) => 
  (!tag.imageUrl && !tag.imageData) || 
  (tag.imageUrl === null && tag.imageData === null)
);

// Check for identical timestamps in guard seal tags
const guardTimestamps = session.guardSealTags.map((tag) => 
  new Date(tag.createdAt).getTime()
);
const uniqueGuardTimestamps = new Set(guardTimestamps);
const hasIdenticalGuardTimestamps = 
  uniqueGuardTimestamps.size === 1 && session.guardSealTags.length > 1;

// Fix missing guard seal tag images if needed
if (hasMissingGuardImages) {
  try {
    const fixResponse = await fetch(`/api/sessions/${sessionId}/fix-guard-seal-images`);
    // Handle response
  } catch (error) {
    console.error("Failed to fix guard seal tag images:", error);
  }
}

// Fix identical guard seal tag timestamps if needed
if (hasIdenticalGuardTimestamps) {
  try {
    const fixResponse = await fetch(`/api/sessions/${sessionId}/fix-guard-seal-timestamps`);
    // Handle response
  } catch (error) {
    console.error("Failed to fix guard seal tag timestamps:", error);
  }
}
```

### 6. Comparison with Operator Seal Tags

#### 6.1. Data Comparison Logic

Implement comparison logic that evaluates:

1. Presence/absence of each seal tag
2. Status of each seal tag (VERIFIED, BROKEN, TAMPERED, MISSING)
3. Timestamps of operator scan vs. guard verification
4. Image comparison (optional - visual verification only)

#### 6.2. UI Representation

Implement a comprehensive comparison UI in the Session Details page:

1. **Side-by-Side Tables**:
   - Show operator and guard seal tags in parallel tables
   - Align rows by seal tag ID for easy comparison
   - Use color coding for status and match/mismatch indicators

2. **Match/Mismatch Statistics**:
   - Show clear summary of verification results
   - Include total counts and percentages
   - Group by verification status (VERIFIED, BROKEN, TAMPERED, MISSING)

3. **Discrepancy Highlighting**:
   - Automatically scroll to and highlight any mismatches
   - Provide tools to filter view by status or match/mismatch

4. **Responsive Design**:
   - Ensure the comparison UI works well on both desktop and mobile devices
   - Consider collapsible sections for better mobile experience

## Technical Considerations

### Storage Efficiency

The base64 approach for image storage has trade-offs:

**Pros:**
- Simplified architecture (no separate image storage service needed)
- Direct data access without external dependencies
- Easier development and testing

**Cons:**
- Increased database size (base64 encoding increases size by ~33%)
- Potential performance impact for large numbers of images
- Database backup/restore operations take longer

For the current scale, this approach is acceptable, but may need revisiting for larger deployments.

### Error Handling

Implement robust error handling:

1. Handle network failures during image upload
2. Provide fallbacks if image capture fails
3. Implement retry mechanisms for critical operations
4. Log all errors for debugging

### Security Considerations

1. Ensure proper authentication for guard actions
2. Validate input data, especially base64 images
3. Implement rate limiting to prevent abuse
4. Log all verification actions for audit purposes

## Implementation Timeline

1. **Phase 1**: API endpoints for guard seal tag operations
2. **Phase 2**: Frontend components for guard verification
3. **Phase 3**: Integration with existing session flow
4. **Phase 4**: Testing and bug fixing
5. **Phase 5**: Deployment and monitoring

## Conclusion

This approach maintains consistency with the existing operator seal tag implementation while extending the functionality for guard verification. By leveraging the same dual-storage strategy with ActivityLogs and dedicated tables, we ensure data redundancy and maintain a complete audit trail while providing robust recovery mechanisms.

The implementation will allow guards to verify seal tags with the same level of detail as operators provide during session creation, enhancing the security and traceability of the entire process. The enhanced UI components, particularly the comparison tables and statistics, will provide clear visibility into the verification process and highlight any discrepancies requiring attention.

---

**Document Created**: June 5, 2025  
**Created By**: Cursor AI  
**For**: Trip Challan Guard Verification Implementation  
**Last Updated**: June 5, 2025
