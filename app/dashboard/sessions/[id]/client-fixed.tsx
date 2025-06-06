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
  Business
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';

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

  // Define placeholder functions for the fixed client version
  const renderVerificationResults = () => null;
  const startVerification = () => {
    if (session && sessionId) {
      router.push(`/dashboard/sessions/${sessionId}/verify`);
    }
  };
  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  // Confirmation dialog for guard users
  const confirmVerification = () => {
    setConfirmDialogOpen(false);
    router.push(`/dashboard/sessions/${sessionId}/verify`);
  };

  // Report download handlers
  const handleDownloadReport = async (format: string) => {
    if (!sessionId) return;
    
    try {
      setReportLoading(format);
      let endpoint = "";
      
      switch (format) {
        case "pdf":
          endpoint = `/api/reports/sessions/${sessionId}/pdf/simple`;
          break;
        case "excel":
          endpoint = `/api/reports/sessions/${sessionId}/excel`;
          break;
        default:
          throw new Error("Unsupported report format");
      }
      
      // Get the report as a blob
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Failed to download ${format} report`);
      }
      
      // Convert response to blob
      const blob = await response.blob();
      
      // Create a link element to trigger the download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `session-${sessionId}.${format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error(`Error downloading ${format} report:`, err);
      alert(`Failed to download ${format} report: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setReportLoading(null);
    }
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

  // Other functions and useEffect hooks

  // Modified Verification Box for Guards
  if (canVerify) {
    return (
      <Container maxWidth="md">
        <Box mb={3}>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>

        {/* Session Details View */}
        {!verificationFormOpen && (
          <>
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

            {/* Comment section */}
            <CommentSection sessionId={sessionId} />

            {/* Verification Results */}
            {renderVerificationResults()}
          </>
        )}

        {/* Verification Form */}
        {verificationFormOpen && (
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            {/* Verification form content */}
          </Paper>
        )}

        {/* Verification Button */}
        {!verificationFormOpen && (
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

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onClose={closeConfirmDialog}>
          {/* Dialog content */}
        </Dialog>

        {/* Success Notification */}
        {verificationSuccess && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <AlertTitle>Success!</AlertTitle>
            Trip successfully verified.
          </Alert>
        )}
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

      {/* Loading indicator while session data is being fetched */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ my: 2 }}>
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      ) : !session ? (
        <Alert severity="warning" sx={{ my: 2 }}>
          <AlertTitle>Session Not Found</AlertTitle>
          The requested session could not be found.
        </Alert>
      ) : (
        <>
          {/* Trip Details Section */}
          <Paper elevation={1} sx={{ mb: 3, overflow: 'hidden' }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              p: 2,
              borderBottom: '1px solid rgba(0,0,0,0.1)' 
            }}>
              <Typography variant="h5" component="h1">Trip Details</Typography>
              <Chip 
                label={session.status === "IN_PROGRESS" ? "IN PROGRESS" : session.status} 
                color={
                  session.status === "IN_PROGRESS" ? "primary" : 
                  session.status === "COMPLETED" ? "success" : 
                  session.status === "CANCELLED" ? "error" : 
                  "default"
                }
              />
            </Box>

            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Basic Information</Typography>
              
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
                {/* Left Column: Source, Destination, Created At */}
                <Box sx={{ flex: 1 }}>
                  {/* Source */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Source:</Typography>
                      <Typography variant="body1">{session.source || 'SourceData'}</Typography>
                    </Box>
                  </Box>

                  {/* Destination */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Destination:</Typography>
                      <Typography variant="body1">{session.destination || 'DestinationData'}</Typography>
                    </Box>
                  </Box>

                  {/* Created Timestamp */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <AccessTime color="primary" sx={{ mr: 1, mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Created:</Typography>
                      <Typography variant="body1">
                        {new Date(session.createdAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: 'numeric',
                          hour12: true
                        })}
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
                      <Typography variant="body1">{session.tripDetails?.vehicleNumber || 'MH02AB1234'}</Typography>
                    </Box>
                  </Box>

                  {/* Company */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Business color="primary" sx={{ mr: 1, mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Company:</Typography>
                      <Typography variant="body1">{session.company?.name || 'N/A'}</Typography>
                    </Box>
                  </Box>

                  {/* Operator Created */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                    <Person color="primary" sx={{ mr: 1, mt: 0.5 }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">Operator Created:</Typography>
                      <Typography variant="body1">{session.createdBy?.name || 'N/A'}</Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Loading Details Section - Added as per requirements */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Loading Details</Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              {session.tripDetails && (
                <>
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Transporter Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.transporterName || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Material Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.materialName || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">GPS IMEI Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.gpsImeiNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Loader Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.loaderName || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Loader Mobile Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.loaderMobileNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Loading Site:</Typography>
                    <Typography variant="body1">{session.tripDetails.loadingSite || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Challan/Royalty Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.challanRoyaltyNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">DO Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.doNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">TP Number:</Typography>
                    <Typography variant="body1">{session.tripDetails.tpNumber || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Freight:</Typography>
                    <Typography variant="body1">{session.tripDetails.freight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Quality of Materials:</Typography>
                    <Typography variant="body1">{session.tripDetails.qualityOfMaterials || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Gross Weight:</Typography>
                    <Typography variant="body1">{session.tripDetails.grossWeight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Tare Weight:</Typography>
                    <Typography variant="body1">{session.tripDetails.tareWeight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Net Material Weight:</Typography>
                    <Typography variant="body1">{session.tripDetails.netMaterialWeight || 'N/A'}</Typography>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle2" color="text.secondary">Receiver Party Name:</Typography>
                    <Typography variant="body1">{session.tripDetails.receiverPartyName || 'N/A'}</Typography>
                  </Grid>
                </>
              )}
            </Grid>
            {!session.tripDetails && (
              <Alert severity="info">No loading details available</Alert>
            )}
          </Paper>

          <CommentSection sessionId={sessionId} />

          {/* Operator Seal Tag Table Section */}
          {session.sealTags && session.sealTags.length > 0 && (
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
                    {session.sealTags.map((sealTag, index) => (
                      <TableRow key={sealTag.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{sealTag.barcode}</TableCell>
                        <TableCell>
                          <Chip 
                            label={sealTag.method ? 
                              (sealTag.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned') 
                              : 'Unknown'
                            } 
                            color={sealTag.method ? 
                              (sealTag.method.toLowerCase().includes('manual') ? 'secondary' : 'primary') 
                              : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {sealTag.imageUrl || sealTag.imageData ? (
                            <Box 
                              component="img" 
                              src={sealTag.imageUrl || sealTag.imageData}
                              alt="Seal Tag"
                              sx={{ 
                                maxWidth: '80px', 
                                maxHeight: '80px',
                                cursor: 'pointer',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                p: 0.5
                              }}
                              onClick={() => {
                                setSelectedImage(sealTag.imageUrl || sealTag.imageData || '');
                                setOpenImageModal(true);
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">No image</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {sealTag.createdAt ? new Date(sealTag.createdAt).toLocaleString('en-US', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: true
                          }) : 'N/A'}
                        </TableCell>
                        <TableCell>{sealTag.scannedByName || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Driver Details Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Driver Details
            </Typography>
            
            {session.tripDetails ? (
              <Grid container spacing={2}>
                <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <Person fontSize="small" /> Driver Name: {session.tripDetails.driverName || 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <Phone fontSize="small" /> Contact Number: {session.tripDetails.driverContactNumber || 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <VerifiedUser fontSize="small" /> License: {session.tripDetails.driverLicense || 'N/A'}
                  </Typography>
                </Box>
                
                {session.images?.driverPicture && (
                  <Box sx={{ width: '100%', p: 1 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      <Person fontSize="small" /> Driver Photo
                    </Typography>
                    <Box 
                      component="img" 
                      src={session.images.driverPicture}
                      alt="Driver Photo"
                      sx={{ 
                        maxWidth: '200px', 
                        maxHeight: '200px',
                        cursor: 'pointer',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        p: 1
                      }}
                      onClick={() => {
                        setSelectedImage(session.images?.driverPicture || '');
                        setOpenImageModal(true);
                      }}
                    />
                  </Box>
                )}
              </Grid>
            ) : (
              <Alert severity="info">No driver details available</Alert>
            )}
          </Paper>

          {/* Images Section - Comes before Reports section */}
          {session.images && Object.keys(session.images).some(key => {
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
          
          {/* Report Download Section - Only shown to authorized users */}
          {canAccessReports && (
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Reports
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
            </Paper>
          )}

          {/* Verification Results */}
          {renderVerificationResults()}
        </>
      )}

      {/* Start Trip Verification Button - Only for Guards */}
      {isGuard && session?.status === SessionStatus.IN_PROGRESS && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Lock />}
            onClick={startVerification}
            sx={{ px: 4, py: 1.5, borderRadius: '4px', fontWeight: 'bold' }}
          >
            Start Trip Verification
          </Button>
        </Box>
      )}

      {/* Dialog only needed for Guard confirmation */}
      <Dialog
        open={confirmDialogOpen}
        onClose={closeConfirmDialog}
      >
        <DialogTitle>Start Verification</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to start the verification process for this trip?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog}>Cancel</Button>
          <Button onClick={confirmVerification} color="primary" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Image Modal for viewing full-size images */}
      <Dialog
        open={openImageModal}
        onClose={() => setOpenImageModal(false)}
        maxWidth="md"
      >
        <DialogContent>
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Full Size"
              style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
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