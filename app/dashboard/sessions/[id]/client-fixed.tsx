"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Divider, 
  Chip, 
  CircularProgress, 
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  AlertTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Grid,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from "@mui/material";
import { 
  LocationOn, 
  DirectionsCar, 
  AccessTime, 
  VerifiedUser, 
  ArrowBack, 
  Lock,
  CheckCircle,
  Warning,
  PictureAsPdf,
  TableChart,
  Description,
  Edit,
  Person,
  Phone,
  Business,
  ContactPage
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';
import { formatTimestampExact, getSessionFieldTimestamp } from "@/lib/date-utils";

// Types
type SealType = {
  id: string;
  barcode: string;
  verified: boolean;
  scannedAt: string | null;
  verifiedById: string | null;
  verifiedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type FieldTimestampType = {
  id: string;
  fieldName: string;
  timestamp: string;
  updatedById: string;
  updatedBy: {
    id: string;
    name: string;
    email: string;
  };
};

type FormattedTimestampType = {
  timestamp: string;
  formattedTimestamp: string;
  updatedBy: {
    id: string;
    name: string;
  };
};

type SessionType = {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  seal?: SealType | null;
  // Additional trip details from the session creation form
  tripDetails?: {
    transporterName?: string;
    materialName?: string;
    vehicleNumber?: string;
    gpsImeiNumber?: string;
    driverName?: string;
    driverContactNumber?: string;
    loaderName?: string;
    challanRoyaltyNumber?: string;
    doNumber?: string;
    freight?: number;
    qualityOfMaterials?: string;
    tpNumber?: string;
    grossWeight?: number;
    tareWeight?: number;
    netMaterialWeight?: number;
    loaderMobileNumber?: string;
    loadingSite?: string;
    receiverPartyName?: string;
    driverLicense?: string;
    registrationCertificate?: string;
  };
  images?: {
    gpsImeiPicture?: string;
    vehicleNumberPlatePicture?: string;
    driverPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
  };
  timestamps?: {
    loadingDetails?: Record<string, string>;
    imagesForm?: Record<string, string>;
  };
  qrCodes?: {
    primaryBarcode?: string;
    additionalBarcodes?: string[];
  };
  activityLogs?: {
    id: string;
    action: string;
    details?: {
      verification?: {
        fieldVerifications?: Record<string, any>;
        allMatch?: boolean;
        completedBy?: string;
        completedAt?: string;
      };
    };
  }[];
  sealTags?: {
    id: string;
    barcode: string;
    method: string;
    imageUrl?: string;
    imageData?: string;
    createdAt: string;
    scannedByName: string;
  }[];
  fieldTimestamps?: FieldTimestampType[];
  formattedFieldTimestamps?: Record<string, FormattedTimestampType>;
};

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const { data: authSession, status: authStatus } = useSession();
  const [session, setSession] = useState<SessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userSubrole, setUserSubrole] = useState("");
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  
  // New state for guard verification
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [verificationFields, setVerificationFields] = useState<{[key: string]: {
    operatorValue: any;
    guardValue: any;
    comment: string;
    isVerified: boolean;
  }}>({});
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [sealInput, setSealInput] = useState("");
  const [sealError, setSealError] = useState("");
  const [imageVerificationStatus, setImageVerificationStatus] = useState<{[key: string]: boolean}>({});
  const [selectedImage, setSelectedImage] = useState("");
  const [openImageModal, setOpenImageModal] = useState(false);

  // Check if user is a guard
  const isGuard = useMemo(() => 
    userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.GUARD, 
    [userRole, userSubrole]
  );
  
  // Check if user can access reports (non-GUARD users)
  const canAccessReports = useMemo(() => 
    userRole === "SUPERADMIN" || 
    userRole === "ADMIN" || 
    userRole === "COMPANY", 
    [userRole]
  );
  
  // Check if the session can be verified
  const canVerify = useMemo(() => 
    isGuard && 
    session?.status === SessionStatus.IN_PROGRESS && 
    session?.seal && 
    !session.seal.verified,
    [isGuard, session]
  );
  
  // Helper functions for verification display
  function getFieldLabel(field: string): string {
    const map: Record<string, string> = {
      driverName: "Driver Name",
      vehicleNumber: "Vehicle Number",
      transporterName: "Transporter Name",
      materialName: "Material Name",
      receiverPartyName: "Receiver Party",
      gpsImeiNumber: "GPS IMEI Number"
    };
    return map[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }

  function getMethodDisplay(method?: string) {
    if (!method) return "Unknown";
    return method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned';
  }

  function getMethodColor(method?: string): "primary" | "secondary" | "default" {
    if (!method) return "default";
    return method.toLowerCase().includes('manual') ? 'secondary' : 'primary';
  }

  // Define placeholder functions for the fixed client version
  const renderVerificationResults = () => {
    if (!session || session.status !== SessionStatus.COMPLETED) {
      return null;
    }

    // Find verification data from activity logs
    const verificationLog = session.activityLogs?.find(log => 
      log.details?.verification?.fieldVerifications || 
      log.details?.verification?.completedBy
    );

    if (!verificationLog) {
      return null;
    }

    const verificationDetails = verificationLog.details?.verification || {};
    const fieldVerifications = verificationDetails.fieldVerifications || {};
    const completedBy = verificationDetails.hasOwnProperty('completedBy') ? 
      (verificationDetails as any).completedBy : {};
    const completedAt = verificationDetails.hasOwnProperty('completedAt') ? 
      (verificationDetails as any).completedAt : '';

    // Calculate verification statistics
    const totalFields = Object.keys(fieldVerifications).length;
    const verifiedFields = Object.values(fieldVerifications as Record<string, any>)
      .filter((field: any) => field.isVerified).length;
    const matchPercentage = totalFields > 0 ? Math.round((verifiedFields / totalFields) * 100) : 0;

    // Group verification fields by category
    const loadingDetailsFields: Record<string, any> = {};
    const driverDetailsFields: Record<string, any> = {};
    
    // Categorize fields
    Object.entries(fieldVerifications as Record<string, any>).forEach(([key, value]: [string, any]) => {
      const driverFields = ['driverName', 'driverContactNumber', 'driverLicense'];
      if (driverFields.includes(key)) {
        driverDetailsFields[key] = value;
      } else {
        loadingDetailsFields[key] = value;
      }
    });

    // Get seal tag verification data
    const sealTagStats = verificationDetails.hasOwnProperty('sealTags') ? 
      (verificationDetails as any).sealTags : {
      total: 0,
      verified: 0,
      missing: 0,
      broken: 0,
      tampered: 0
    };

    return (
      <>
        {/* Overall Verification Summary */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)', bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h6">Verification Summary</Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Verification Status</Typography>
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  {matchPercentage >= 90 ? "VERIFIED" : matchPercentage >= 70 ? "PARTIALLY VERIFIED" : "VERIFICATION ISSUES"}
                </Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Match Rate</Typography>
                <Typography variant="h5">{matchPercentage}%</Typography>
                <Typography variant="body2" color="text.secondary">
                  {verifiedFields} of {totalFields} fields
                </Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Verified By</Typography>
                <Typography variant="h5">{completedBy.name || 'Unknown'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {completedAt ? new Date(completedAt).toLocaleString() : 'Unknown time'}
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Paper>

        {/* Loading Details Verification Results */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="h6">Loading Details Verification</Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            {/* Summary Statistics */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Total Fields</Typography>
                <Typography variant="h5">{Object.keys(loadingDetailsFields).length}</Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Verified Fields</Typography>
                <Typography variant="h5">
                  {Object.values(loadingDetailsFields).filter((field: any) => field.isVerified).length}
                </Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Match Rate</Typography>
                <Typography variant="h5">
                  {Object.keys(loadingDetailsFields).length > 0 
                    ? Math.round(
                        (Object.values(loadingDetailsFields).filter((field: any) => 
                          field.isVerified && field.operatorValue === field.guardValue
                        ).length / Object.keys(loadingDetailsFields).length) * 100
                      )
                    : 0}%
                </Typography>
              </Paper>
            </Box>
            
            {/* Detailed Field Verification Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Operator Value</TableCell>
                    <TableCell>Guard Verified Value</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(loadingDetailsFields).map(([field, data]: [string, any]) => (
                    <TableRow key={field}>
                      <TableCell>{getFieldLabel(field)}</TableCell>
                      <TableCell>{data.operatorValue || 'N/A'}</TableCell>
                      <TableCell>{data.guardValue || 'N/A'}</TableCell>
                      <TableCell>
                        {data.isVerified ? (
                          data.operatorValue === data.guardValue ? (
                            <Chip 
                              icon={<CheckCircle />}
                              label="MATCH" 
                              color="success" 
                              size="small"
                            />
                          ) : (
                            <Chip 
                              icon={<Warning />}
                              label="MISMATCH" 
                              color="warning" 
                              size="small"
                            />
                          )
                        ) : (
                          <Chip 
                            label="NOT VERIFIED" 
                            color="default" 
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>{data.comment || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>

        {/* Driver Details Verification Results */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="h6">Driver Details Verification</Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            {/* Summary Statistics */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Total Fields</Typography>
                <Typography variant="h5">{Object.keys(driverDetailsFields).length}</Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Verified Fields</Typography>
                <Typography variant="h5">
                  {Object.values(driverDetailsFields).filter((field: any) => field.isVerified).length}
                </Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Match Rate</Typography>
                <Typography variant="h5">
                  {Object.keys(driverDetailsFields).length > 0 
                    ? Math.round(
                        (Object.values(driverDetailsFields).filter((field: any) => 
                          field.isVerified && field.operatorValue === field.guardValue
                        ).length / Object.keys(driverDetailsFields).length) * 100
                      )
                    : 0}%
                </Typography>
              </Paper>
            </Box>
            
            {/* Detailed Field Verification Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Operator Value</TableCell>
                    <TableCell>Guard Verified Value</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(driverDetailsFields).map(([field, data]: [string, any]) => (
                    <TableRow key={field}>
                      <TableCell>{getFieldLabel(field)}</TableCell>
                      <TableCell>{data.operatorValue || 'N/A'}</TableCell>
                      <TableCell>{data.guardValue || 'N/A'}</TableCell>
                      <TableCell>
                        {data.isVerified ? (
                          data.operatorValue === data.guardValue ? (
                            <Chip 
                              icon={<CheckCircle />}
                              label="MATCH" 
                              color="success" 
                              size="small"
                            />
                          ) : (
                            <Chip 
                              icon={<Warning />}
                              label="MISMATCH" 
                              color="warning" 
                              size="small"
                            />
                          )
                        ) : (
                          <Chip 
                            label="NOT VERIFIED" 
                            color="default" 
                            size="small"
                          />
                        )}
                      </TableCell>
                      <TableCell>{data.comment || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>

        {/* Seal Tag Verification Results */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="h6">Seal Tag Verification</Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            {/* Summary Statistics */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Total Seal Tags</Typography>
                <Typography variant="h5">{sealTagStats.total || 0}</Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary">Verified</Typography>
                <Typography variant="h5">{sealTagStats.verified || 0}</Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1, bgcolor: sealTagStats.missing > 0 ? 'error.light' : undefined}}>
                <Typography variant="subtitle2" color="text.secondary">Missing</Typography>
                <Typography variant="h5">{sealTagStats.missing || 0}</Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1, bgcolor: sealTagStats.broken > 0 ? 'error.light' : undefined}}>
                <Typography variant="subtitle2" color="text.secondary">Broken</Typography>
                <Typography variant="h5">{sealTagStats.broken || 0}</Typography>
              </Paper>
              
              <Paper elevation={2} sx={{ p: 2, minWidth: 150, flex: 1, bgcolor: sealTagStats.tampered > 0 ? 'error.light' : undefined}}>
                <Typography variant="subtitle2" color="text.secondary">Tampered</Typography>
                <Typography variant="h5">{sealTagStats.tampered || 0}</Typography>
              </Paper>
            </Box>
            
            {/* Seal Tags Table - Guard and Operator */}
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>Operator Seal Tags</Typography>
              {session.sealTags && session.sealTags.length > 0 ? (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Barcode</TableCell>
                        <TableCell>Method</TableCell>
                        <TableCell>Scanned By</TableCell>
                        <TableCell>Timestamp</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {session.sealTags.map(tag => (
                        <TableRow key={tag.id}>
                          <TableCell>{tag.barcode}</TableCell>
                          <TableCell>
                            <Chip 
                              label={getMethodDisplay(tag.method)} 
                              color={getMethodColor(tag.method)} 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{tag.scannedByName || 'Unknown'}</TableCell>
                          <TableCell>
                            {tag.createdAt ? formatTimestampExact(new Date(tag.createdAt)) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">No operator seal tags found</Typography>
              )}
            </Box>
          </Box>
        </Paper>

        {/* Image Verification Results */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
            <Typography variant="h6">Image Verification</Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            {/* Image verification content */}
            <Typography variant="body1">
              All images associated with this session were reviewed during verification.
            </Typography>
            
            {/* You can add more detailed image verification results here if needed */}
          </Box>
        </Paper>
      </>
    );
  };

  // Define fetchSessionDetails function
  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) {
      console.log("No session ID available yet, skipping fetch");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      console.log("Fetching session details for ID:", sessionId);
      const response = await fetch(`/api/session/${sessionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        
        if (response.status === 404) {
          throw new Error("Session not found");
        } else {
          throw new Error(`Failed to fetch session details: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log("Session data received:", !!data);
      setSession(data);
    } catch (err) {
      console.error("Error fetching session details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Add useEffect to call fetchSessionDetails on mount
  useEffect(() => {
    console.log("SessionDetailClient mounted, fetching session details...");
    fetchSessionDetails();
  }, [fetchSessionDetails]);

  // Set user role from auth session
  useEffect(() => {
    if (authSession?.user) {
      setUserRole(authSession.user.role || "");
      setUserSubrole(authSession.user.subrole || "");
      console.log("User role set:", authSession.user.role, "Subrole:", authSession.user.subrole);
    }
  }, [authSession]);

  // Function to get and format timestamp for a specific field
  const getFieldTimestamp = (key: string) => {
    // Find timestamp for this field if available
    const fieldTimestamp = session?.fieldTimestamps?.find(
      ft => ft.fieldName === key || ft.fieldName === `loadingDetails.${key}` || ft.fieldName === `driverDetails.${key}`
    );
    
    // Check for formatted timestamps (new API response format)
    const formattedTimestamp = session?.formattedFieldTimestamps?.[key] || 
                              session?.formattedFieldTimestamps?.[`loadingDetails.${key}`] ||
                              session?.formattedFieldTimestamps?.[`driverDetails.${key}`];
    
    // Fallback to legacy timestamps if formatted timestamps are not available
    const legacyTimestamp = 
      (session?.timestamps?.loadingDetails && session.timestamps.loadingDetails[key]) ||
      (session?.timestamps?.imagesForm && session.timestamps.imagesForm[key]);
    
    // Return the timestamp with the highest priority: formatted > fieldTimestamp > legacyTimestamp > current time
    return (
      formattedTimestamp
        ? formattedTimestamp.formattedTimestamp
        : fieldTimestamp
          ? formatTimestampExact(fieldTimestamp.timestamp)
          : legacyTimestamp
            ? formatTimestampExact(legacyTimestamp)
            : session?.createdAt 
              ? formatTimestampExact(session.createdAt)
              : formatTimestampExact(new Date())
    );
  };

  // Format a date string for display
  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatTimestampExact(new Date(dateString));
    } catch (error) {
      console.error("Error formatting date:", error);
      return 'N/A';
    }
  };

  // Other functions and useEffect hooks

  // Modified Verification Box for Guards
  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Alert severity="error" sx={{ my: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      </Container>
    );
  }

  // Main component return for non-verification users
  return (
    <Container maxWidth="md">
      {/* Content */}
      <Box mb={3}>
        <Button
          component={Link}
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Box>

      {/* Session Details - Basic Information - Visible to all users */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        {/* Trip Details Section */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          pb: 2,
          mb: 2
        }}>
          <Typography variant="h5" component="h1">Trip Details</Typography>
          <Chip 
            label={session?.status === "IN_PROGRESS" ? "IN PROGRESS" : session?.status} 
            color={
              session?.status === "IN_PROGRESS" ? "primary" : 
              session?.status === "COMPLETED" ? "success" : 
              session?.status === "CANCELLED" ? "error" : 
              "default"
            }
          />
        </Box>

        <Typography variant="h6" gutterBottom>Basic Information</Typography>
        
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Left Column: Source, Destination, Created At */}
          <Box sx={{ flex: 1 }}>
            {/* Source */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Source:</Typography>
                <Typography variant="body1">{session?.source || 'N/A'}</Typography>
              </Box>
            </Box>

            {/* Destination */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Destination:</Typography>
                <Typography variant="body1">{session?.destination || 'N/A'}</Typography>
              </Box>
            </Box>

            {/* Created Timestamp */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <AccessTime color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Created:</Typography>
                <Typography variant="body1">
                  {session?.createdAt ? new Date(session.createdAt).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true
                  }) : 'N/A'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right Column: Vehicle Number, Company, Created By */}
          <Box sx={{ flex: 1 }}>
            {/* Vehicle Number */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <DirectionsCar color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Vehicle Number:</Typography>
                <Typography variant="body1">{session?.tripDetails?.vehicleNumber || 'N/A'}</Typography>
              </Box>
            </Box>

            {/* Company */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Business color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Company:</Typography>
                <Typography variant="body1">{session?.company?.name || 'N/A'}</Typography>
              </Box>
            </Box>

            {/* Operator Created */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
              <Person color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Operator Created:</Typography>
                <Typography variant="body1">{session?.createdBy?.name || 'N/A'}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Show loading details section for completed sessions or non-guard users */}
      {(session?.status === SessionStatus.COMPLETED || !isGuard) && (
        <>
          {/* Loading Details */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Loading Details</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Entered At</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(session?.tripDetails || {}).map(([key, value]) => {
                    if (key === 'source' || key === 'destination') return null;
                    
                    return (
                      <TableRow key={key}>
                        <TableCell>{getFieldLabel(key)}</TableCell>
                        <TableCell>
                          {getSessionFieldTimestamp(session, key)}
                        </TableCell>
                        <TableCell>{value || 'N/A'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!session?.tripDetails && (
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Alert severity="info">No loading details available</Alert>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Seal Tags - For completed sessions or non-guard users */}
          {session?.sealTags && session.sealTags.length > 0 && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Seal Tags
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell>
                      <TableCell>Seal Tag ID</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>Created At</TableCell>
                      <TableCell>Created By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {session.sealTags.map((tag, index) => (
                      <TableRow key={tag.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{tag.barcode}</TableCell>
                        <TableCell>
                          <Chip 
                            label={getMethodDisplay(tag.method)} 
                            color={getMethodColor(tag.method)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {tag.imageUrl || tag.imageData ? (
                            <Box
                              component="img"
                              src={tag.imageUrl || tag.imageData}
                              alt={`Seal tag ${tag.barcode}`}
                              sx={{
                                height: '40px',
                                width: '40px',
                                objectFit: 'cover',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                setSelectedImage(tag.imageUrl || tag.imageData || '');
                                setOpenImageModal(true);
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No image
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {tag.createdAt ? formatTimestampExact(new Date(tag.createdAt)) : 'N/A'}
                        </TableCell>
                        <TableCell>{tag.scannedByName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Driver Details - For completed sessions or non-guard users */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Driver Details
            </Typography>
            
            {session?.tripDetails ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <Person fontSize="small" /> Driver Name: {session.tripDetails.driverName || 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <Phone fontSize="small" /> Contact: {session.tripDetails.driverContactNumber || 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <ContactPage fontSize="small" /> License: {session.tripDetails.driverLicense || 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <ContactPage fontSize="small" /> Registration Certificate: {session.tripDetails.registrationCertificate || 'N/A'}
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Alert severity="info">No driver details available</Alert>
            )}
          </Paper>

          {/* Images Section - For completed sessions or non-guard users */}
          {session?.images && Object.keys(session.images).some(key => {
            const value = session.images && session.images[key as keyof typeof session.images];
            return !!value;
          }) && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Images
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {session.images && session.images.driverPicture && (
                  <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <Typography variant="subtitle2" gutterBottom>Driver</Typography>
                    <img 
                      src={session.images.driverPicture} 
                      alt="Driver" 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </Box>
                )}
                {session.images && session.images.vehicleNumberPlatePicture && (
                  <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <Typography variant="subtitle2" gutterBottom>Number Plate</Typography>
                    <img 
                      src={session.images.vehicleNumberPlatePicture} 
                      alt="Vehicle Number Plate" 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </Box>
                )}
                {session.images && session.images.gpsImeiPicture && (
                  <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <Typography variant="subtitle2" gutterBottom>GPS/IMEI</Typography>
                    <img 
                      src={session.images.gpsImeiPicture} 
                      alt="GPS IMEI" 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </Box>
                )}
                
                {/* Display all sealing images */}
                {session.images && session.images.sealingImages && session.images.sealingImages.length > 0 && (
                  <>
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Sealing Images</Typography>
                    </Box>
                    {session.images.sealingImages.map((image, index) => (
                      <Box key={`sealing-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                        <img 
                          src={image} 
                          alt={`Sealing ${index + 1}`} 
                          style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                        />
                      </Box>
                    ))}
                  </>
                )}
                
                {/* Display all vehicle images */}
                {session.images && session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
                  <>
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Vehicle Images</Typography>
                    </Box>
                    {session.images.vehicleImages.map((image, index) => (
                      <Box key={`vehicle-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                        <img 
                          src={image} 
                          alt={`Vehicle ${index + 1}`} 
                          style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                        />
                      </Box>
                    ))}
                  </>
                )}
                
                {/* Display all additional images */}
                {session.images && session.images.additionalImages && session.images.additionalImages.length > 0 && (
                  <>
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Additional Images</Typography>
                    </Box>
                    {session.images.additionalImages.map((image, index) => (
                      <Box key={`additional-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                        <img 
                          src={image} 
                          alt={`Additional ${index + 1}`} 
                          style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                        />
                      </Box>
                    ))}
                  </>
                )}
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* Comment section - visible to all */}
      <CommentSection sessionId={sessionId} />

      {/* Verification Results - only for completed sessions */}
      {session?.status === SessionStatus.COMPLETED && renderVerificationResults()}

      {/* Verification Button - only visible for Guards with in-progress sessions */}
      {isGuard && session?.status === SessionStatus.IN_PROGRESS && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Lock />}
            onClick={startVerification}
          >
            Start Trip Verification
          </Button>
        </Box>
      )}

      {/* Confirmation Dialog - Only shown when verification button is clicked */}
      <Dialog open={confirmDialogOpen} onClose={closeConfirmDialog}>
        <DialogTitle>Confirm Trip Verification</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to start the verification process for this trip. This action cannot be undone.
            Please make sure you have all the necessary information to complete the verification.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={confirmVerification} color="primary" variant="contained">
            Start Verification
          </Button>
        </DialogActions>
      </Dialog>

      {/* Report Actions - only visible for non-GUARD users with appropriate permissions */}
      {canAccessReports && session?.status === SessionStatus.COMPLETED && (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<PictureAsPdf />}
            onClick={() => handleDownloadReport("pdf")}
            disabled={reportLoading !== null}
            size="small"
            sx={{ color: 'error.main', borderColor: 'error.main', '&:hover': { borderColor: 'error.dark' } }}
          >
            {reportLoading === "pdf" ? "Downloading..." : "Download PDF"}
          </Button>
          <Button
            variant="outlined"
            startIcon={<TableChart />}
            onClick={() => handleDownloadReport("excel")}
            disabled={reportLoading !== null}
            size="small"
            sx={{ color: 'success.main', borderColor: 'success.main', '&:hover': { borderColor: 'success.dark' } }}
          >
            {reportLoading === "excel" ? "Downloading..." : "Download Excel"}
          </Button>
        </Box>
      )}

      {/* Success Notification */}
      {verificationSuccess && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <AlertTitle>Success!</AlertTitle>
          Trip successfully verified.
        </Alert>
      )}

      {/* Image Modal */}
      <Dialog
        open={openImageModal}
        onClose={() => setOpenImageModal(false)}
        maxWidth="lg"
      >
        <DialogContent>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Enlarged view"
              style={{ maxWidth: '100%', maxHeight: '80vh' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImageModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
} 