# Session Detail Page Role Separation: Investigation & Improvements

## Overview

This document details the investigation findings and proposed improvements for the Session Detail page, specifically addressing role separation issues between Operators and Guards. It serves as a comprehensive guide for developers to understand and implement proper role-based access controls.

## Business Requirements

1. **Strict Role Separation**:
   - Only OPERATORS can create sessions
   - Only GUARDS can verify and complete sessions
   - No other users (ADMIN, COMPANY, SUPERADMIN) should have these capabilities

2. **Role-Specific Views**:
   - Different users should see different content based on their role and the session status

## Current Implementation

### System Architecture

The session management system consists of these key components:

- **Session Detail Pages**: 
  - `app/dashboard/sessions/[id]/page.tsx` - Server component that loads the client component
  - `app/dashboard/sessions/[id]/client-fixed.tsx` - Client component rendering session details
  - `app/dashboard/sessions/[id]/verify/page.tsx` - Guard verification page with server-side role checking

### Data Flow

The system implements a two-stage workflow:

1. **Operator Stage**: 
   - Session creation with trip details
   - Vehicle information entry
   - Loading details (21 fields)
   - Driver information
   - Image uploads
   - Seal tag registration

2. **Guard Stage**: 
   - Session verification
   - Seal tag validation
   - Field verification
   - Additional image collection if needed

### Issues Identified

1. **UI Inconsistency**:
   ```typescript
   // In client-fixed.tsx - incorrect implementation
   return (
     <Container>
       {/* ... content ... */}
       
       {/* Start Trip Verification Button (visible to all users) */}
       {!canVerify && session?.status === SessionStatus.IN_PROGRESS && (
         <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
           <Button
             variant="contained"
             color="primary"
             startIcon={<Lock />}
             onClick={startVerification}
           >
             Start Trip Verification
           </Button>
         </Box>
       )}
       
       {/* ... */}
     </Container>
   );
   ```

2. **Security Concerns**:
   - While server-side protection exists, the UI suggests functionality to unauthorized users
   - This creates confusion and potential security vulnerabilities

## Recommended Improvements

### 1. UI Modifications

```typescript
// Correct implementation for client-fixed.tsx
return (
  <Container>
    {/* ... content ... */}
    
    {/* Verification button - only visible for Guards */}
    {isGuard && session?.status === SessionStatus.IN_PROGRESS && (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Lock />}
          onClick={startVerification}
        >
          Start Trip Verification
        </Button>
      </Box>
    )}
    
    {/* ... */}
  </Container>
);
```

### 2. Role-Based View Specifications

#### Completed Sessions (All Users)

All users should see comprehensive details:
- ✅ Basic Session Details
- ✅ Operator-entered Loading Details (21 fields)
- ✅ Operator Seal Tag table
- ✅ Guard Seal Tag table
- ✅ Driver Details section
- ✅ Images section
- ✅ Verification results showing matching/non-matching fields
- ✅ Comment Section

#### In-Progress Sessions (Role-Specific)

**For Guards:**
- ✅ Basic Session Details
- ✅ Comment Section
- ✅ "Start Trip Verification" button (when appropriate)

**For Other Roles (SUPERADMIN, ADMIN, COMPANY, OPERATOR):**
- ✅ Basic Session Details
- ✅ Operator-entered Loading Details
- ✅ Operator Seal Tag Table
- ✅ Driver Details
- ✅ Images section
- ✅ Comment Section
- ❌ NO verification button

### 3. API Protection Enhancements

All endpoints that modify session status should verify user roles:

```typescript
// Example API route handler with role checking
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Ensure only Guards can verify sessions
    if (session?.user.subrole !== EmployeeSubrole.GUARD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Only Guards can verify sessions" }),
        { status: 403 }
      );
    }
    
    // Process verification...
    
  } catch (error) {
    // Error handling...
  }
}
```

## Implementation Checklist

- [ ] Update `client-fixed.tsx` to only show verification button to Guards
- [ ] Remove confirmation dialog for non-Guard users
- [ ] Review all session-related API endpoints to ensure proper role checks
- [ ] Add explicit role validation for all verification actions
- [ ] Create consistent role-checking utility functions
- [ ] Apply role checks at both UI and API layers
- [ ] Implement clear error messages for unauthorized actions
- [ ] Add audit logging for security monitoring
- [ ] Test with different user roles to ensure correct view rendering

## Conclusion

Properly implementing role separation is crucial for maintaining the business process integrity and security of the session management system. The UI should reflect the strict rule that only Operators create sessions and only Guards verify them.

By implementing these recommendations, the system will enforce role-based access control consistently across both the user interface and backend services, providing a more secure and intuitive user experience.
