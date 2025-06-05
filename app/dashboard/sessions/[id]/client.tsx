"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as React from 'react';
import { 
  Container, Box, Paper, Divider, Chip, CircularProgress, Button,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Alert, AlertTitle, LinearProgress, List, ListItem, ListItemText,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TextField, IconButton, Grid, InputAdornment, Tooltip, Typography,
  Tabs, Tab, FormControl, InputLabel, Select, MenuItem
} from "@mui/material";
import { 
  LocationOn, DirectionsCar, AccessTime, VerifiedUser, ArrowBack, Lock,
  CheckCircle, Warning, PictureAsPdf, TableChart, Description, Edit,
  BusinessCenter, RadioButtonUnchecked, Comment, ArrowForward, Delete,
  CloudUpload, Close, QrCode, InfoOutlined, Refresh, Person,
  KeyboardArrowUp, KeyboardArrowDown
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';
import ClientSideQrScanner from "@/app/components/ClientSideQrScanner";
import toast from "react-hot-toast";
import { compressImage } from "@/lib/imageUtils";

// Utility functions
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

function getStatusColor(status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" {
  switch (status?.toLowerCase()) {
    case 'verified':
    case 'completed':
      return 'success';
    case 'in_progress':
    case 'processing':
      return 'info';
    case 'rejected':
    case 'failed':
      return 'error';
    case 'pending':
    case 'waiting':
      return 'warning';
    default:
      return 'default';
  }
}

function isSystemField(key: string) {
  const systemFields = ['id', 'createdAt', 'updatedAt', 'sessionId', 'companyId'];
  return systemFields.includes(key);
}

// Type definitions
type SessionType = {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  company: { id: string; name: string; };
  createdBy: { id: string; name: string; email: string; };
  tripDetails?: Record<string, any>;
  images?: {
    gpsImeiPicture?: string;
    vehicleNumberPlatePicture?: string;
    driverPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
  };
  sealTags?: { id: string; barcode: string; method: string; imageUrl?: string | null; createdAt: string; }[];
  guardSealTags?: {
    id: string;
    barcode: string;
    method: string;
    imageUrl?: string | null;
    imageData?: string | null;
    createdAt: string;
    status?: string;
    verifiedById?: string;
    verifiedBy?: { id: string; name: string; email: string; };
  }[];
};

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data: authSession, status: authStatus } = useSession();
  
  // Core state
  const [session, setSession] = useState<SessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // User permissions
  const [userRole, setUserRole] = useState('');
  const [userSubrole, setUserSubrole] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  
  // UI state
  const [activeTab, setActiveTab] = useState(0);
  const [openImageModal, setOpenImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  
  // Verification state
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationFields, setVerificationFields] = useState<Record<string, any>>({});
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<any>(null);
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  
  // Seal management
  const [guardScannedSeals, setGuardScannedSeals] = useState<Array<{
    id: string;
    method: string;
    image: File | null;
    imagePreview: string | null;
    timestamp: string;
    verified: boolean;
  }>>([]);
  const [operatorSeals, setOperatorSeals] = useState<Array<{id: string}>>([]);
  const [sealComparison, setSealComparison] = useState<{matched: string[], mismatched: string[]}>({
    matched: [], mismatched: []
  });
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState('');
  
  // Image management
  const [guardImages, setGuardImages] = useState<Record<string, any>>({});
  const [imagePreviews, setImagePreviews] = useState<Record<string, any>>({});

  // Session data fetching
  useEffect(() => {
    if (!sessionId) return;
    
    const fetchSessionData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/sessions/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${response.status}`);
        }
        
        const data = await response.json();
        setSession(data);
        
        // Extract operator seal tags if available
        if (data.sealTags && Array.isArray(data.sealTags)) {
          setOperatorSeals(data.sealTags.map((tag: any) => ({ id: tag.barcode })));
        }
        
        // Fetch guard seal tags
        fetchGuardSealTags();
        
      } catch (error) {
        console.error('Error fetching session:', error);
        setError('Failed to load session data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessionData();
  }, [sessionId]);
  
  // Role and permissions
  useEffect(() => {
    if (authSession?.user) {
      const role = authSession.user.role as string;
      const subrole = authSession.user.subrole as string;
      
      setUserRole(role);
      setUserSubrole(subrole);
      
      // Determine if user can edit based on role/subrole
      const canEditSession = 
        role === 'ADMIN' || 
        role === 'COMPANY' || 
        (role === 'EMPLOYEE' && 
          (subrole === EmployeeSubrole.GUARD || 
           subrole === EmployeeSubrole.OPERATOR));
      
      setCanEdit(canEditSession);
    }
  }, [authSession]);
  
  // Fetch guard seal tags
  const fetchGuardSealTags = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/guardSealTags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch guard seal tags: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        // Process guard seal tags
        const guardTags = data.map((tag: any) => ({
          id: tag.barcode,
          method: tag.method || 'digital',
          image: null,
          imagePreview: tag.imageUrl || null,
          timestamp: tag.createdAt || new Date().toISOString(),
          verified: operatorSeals.some(seal => 
            seal.id.trim().toLowerCase() === tag.barcode.trim().toLowerCase()
          )
        }));
        
        setGuardScannedSeals(guardTags);
        updateSealComparison(guardTags);
      }
    } catch (error) {
      console.error('Error fetching guard seal tags:', error);
    }
  }, [sessionId, operatorSeals]);
  
  // Update seal comparison status
  const updateSealComparison = useCallback((guardTags: any[]) => {
    const matched: string[] = [];
    const mismatched: string[] = [];
    
    // Find matches and mismatches between operator and guard scanned seals
    guardTags.forEach(guardTag => {
      const isMatch = operatorSeals.some(
        opSeal => opSeal.id.trim().toLowerCase() === guardTag.id.trim().toLowerCase()
      );
      
      if (isMatch) {
        matched.push(guardTag.id);
      } else {
        mismatched.push(guardTag.id);
      }
    });
    
    setSealComparison({ matched, mismatched });
  }, [operatorSeals]);
  
  // Process image for upload with compression
  const processImageForUpload = async (imageFile: File): Promise<string> => {
    const reader = new FileReader();
    return new Promise<string>((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64Image = reader.result as string;
          
          // Compression strategy based on size
          let compressedImageData = base64Image;
          if (base64Image.length > 1000000) { // 1MB
            compressedImageData = await compressImage(base64Image, 0.6);
          }
          
          if (compressedImageData.length > 800000) { // 800KB
            compressedImageData = await compressImage(compressedImageData, 0.4);
          }
          
          if (compressedImageData.length > 500000) { // 500KB
            compressedImageData = await compressImage(compressedImageData, 0.2);
          }
          
          resolve(compressedImageData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  };
  
  // Handle QR/barcode scanner input
  const handleScanComplete = async (barcodeData: string, method: string = 'digital', imageFile?: File) => {
    // Don't process empty input
    if (!barcodeData.trim()) {
      setScanError('Please enter a valid Seal Tag ID');
      setTimeout(() => setScanError(''), 3000);
      return;
    }
    
    try {
      const trimmedData = barcodeData.trim();
      
      // Check if already scanned by guard
      if (guardScannedSeals.some(seal => seal.id.toLowerCase() === trimmedData.toLowerCase())) {
        setScanError('This seal has already been scanned');
        setTimeout(() => setScanError(''), 3000);
        return;
      }
      
      // Check if this seal matches an operator seal
      const isVerified = operatorSeals.some(seal => 
        seal.id.trim().toLowerCase() === trimmedData.toLowerCase()
      );
      
      // Handle image if provided
      let imageDataBase64 = null;
      if (imageFile) {
        imageDataBase64 = await processImageForUpload(imageFile);
      }
      
      // Save to API
      const response = await fetch(`/api/sessions/${sessionId}/guardSealTags`, {
        method: 'POST',
        credentials: 'same-origin',
        mode: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: trimmedData,
          method,
          imageData: imageDataBase64
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        
        // Handle duplicate error
        if (response.status === 409) {
                        try {
                const errorData = JSON.parse(errorText);
                if (errorData.existingTag) {
                  toast.success(`Seal tag ${trimmedData} was already scanned previously`);
              fetchGuardSealTags();
              return;
            }
          } catch (e) {
            // If parsing fails, just show the generic error
          }
        }
        
        throw new Error(`Failed to save guard seal tag: ${response.status}`);
      }
      
      const savedTag = await response.json();
      console.log('Guard seal tag saved:', savedTag);
      
      // Refresh tags and update UI
      fetchGuardSealTags();
      toast.success(`Seal tag ${trimmedData} saved successfully!`);
      
      // Create temporary seal for immediate UI feedback
      const newSeal = {
        id: trimmedData,
        method,
        image: imageFile || null,
        imagePreview: null,
        timestamp: new Date().toISOString(),
        verified: isVerified
      };
      
      const updatedSeals = [...guardScannedSeals, newSeal];
      setGuardScannedSeals(updatedSeals);
      updateSealComparison(updatedSeals);
      setScanInput('');
      
    } catch (error) {
      console.error('Error saving guard seal tag:', error);
      toast.error('Failed to save guard seal tag. Please try again.');
    }
  };

  // Handle image upload for verification
  const handleImageUpload = async (imageType: string, file: File | FileList | null) => {
    if (!file) return;
    
    try {
      let processedFiles: File[];
      
      if (file instanceof FileList) {
        // Convert FileList to array and limit to 10 images
        processedFiles = Array.from(file).slice(0, 10);
      } else {
        processedFiles = [file];
      }
      
      // Process each image
      for (const imageFile of processedFiles) {
        const imageData = await processImageForUpload(imageFile);
        
        // Update state with the new image
        setGuardImages(prev => ({
          ...prev,
          [imageType]: imageData
        }));
        
        // Create a URL for preview
        const objectUrl = URL.createObjectURL(imageFile);
        setImagePreviews(prev => ({
          ...prev,
          [imageType]: objectUrl
        }));
      }
      
      toast.success(`Image uploaded for ${getFieldLabel(imageType)}`);
    } catch (error) {
      console.error(`Error uploading image for ${imageType}:`, error);
      toast.error(`Failed to upload image for ${getFieldLabel(imageType)}`);
    }
  };
  
  // Remove uploaded image
  const removeUploadedImage = (imageType: string) => {
    setGuardImages(prev => {
      const newImages = { ...prev };
      delete newImages[imageType];
      return newImages;
    });
    
    setImagePreviews(prev => {
      const newPreviews = { ...prev };
      // Revoke object URL to avoid memory leaks
      if (newPreviews[imageType]) {
        URL.revokeObjectURL(newPreviews[imageType]);
      }
      delete newPreviews[imageType];
      return newPreviews;
    });
    
    toast.success(`Image removed for ${getFieldLabel(imageType)}`);
  };
  
  // Handle image comment change
  const handleImageCommentChange = (imageKey: string, comment: string) => {
    setImageComments(prev => ({
      ...prev,
      [imageKey]: comment
    }));
  };
  
  // Verification functions
  
  // Start verification process
  const startVerification = () => {
    setVerificationFormOpen(true);
    setVerificationStep(0);
  };
  
  // Verify a specific field
  const verifyField = (field: string) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        verified: true,
        timestamp: new Date().toISOString(),
        verifiedBy: authSession?.user?.name || 'Unknown'
      }
    }));
  };
  
  // Verify an image
  const verifyImage = (imageKey: string) => {
    verifyField(imageKey);
  };
  
  // Verify all fields at once
  const verifyAllFields = () => {
    const fields = session?.tripDetails ? Object.keys(session.tripDetails) : [];
    const newVerifications: Record<string, any> = {};
    
    fields.forEach(field => {
      if (!isSystemField(field)) {
        newVerifications[field] = {
          verified: true,
          timestamp: new Date().toISOString(),
          verifiedBy: authSession?.user?.name || 'Unknown'
        };
      }
    });
    
    setVerificationFields(prev => ({
      ...prev,
      ...newVerifications
    }));
  };
  
  // Get verification statistics
  const getVerificationStats = () => {
    if (!session?.tripDetails) return { total: 0, verified: 0, percentage: 0 };
    
    const fields = Object.keys(session.tripDetails).filter(key => !isSystemField(key));
    const verifiedCount = fields.filter(field => verificationFields[field]?.verified).length;
    
    return {
      total: fields.length,
      verified: verifiedCount,
      percentage: fields.length > 0 ? Math.round((verifiedCount / fields.length) * 100) : 0
    };
  };
  
  // Complete verification process
  const handleVerifySeal = async () => {
    if (!sessionId || !session) return;
    
    try {
      setVerifying(true);
      
      // Check if all required items are verified
      const stats = getVerificationStats();
      if (stats.percentage < 100) {
        toast.error('Please verify all fields before completing the verification');
        setVerifying(false);
        return;
      }
      
      // Prepare verification data
      const verificationData = {
        sessionId,
        fieldVerifications: verificationFields,
        guardImages,
        imageComments,
        sealTags: {
          matched: sealComparison.matched,
          mismatched: sealComparison.mismatched,
          operator: operatorSeals.map(seal => seal.id),
          guard: guardScannedSeals.map(seal => seal.id)
        },
        allMatch: sealComparison.mismatched.length === 0 && sealComparison.matched.length > 0
      };
      
      // Submit verification
      const response = await fetch(`/api/sessions/${sessionId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verificationData),
      });
      
      if (!response.ok) {
        throw new Error(`Verification failed: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Update UI
      setVerificationResults(result);
      setVerificationFormOpen(false);
      
      // Refresh session data
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      if (sessionResponse.ok) {
        const refreshedSession = await sessionResponse.json();
        setSession(refreshedSession);
      }
      
      toast.success('Session verification completed successfully');
      
    } catch (error) {
      console.error('Error verifying session:', error);
      toast.error('Failed to complete verification. Please try again.');
    } finally {
      setVerifying(false);
    }
  };
  
  // Helper function to fix toast.info not available
  const notifyToastInfo = (message: string) => {
    toast.success(message); // Using success instead of info which might not be available
  };
  
  // Render function
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      ) : !session ? (
        <Alert severity="warning">
          <AlertTitle>Session Not Found</AlertTitle>
          The requested session could not be found.
        </Alert>
      ) : (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/dashboard/sessions')}
              variant="outlined"
            >
              Back to Sessions
            </Button>
            
            <Box>
              <Chip 
                label={session.status.replace('_', ' ')}
                color={getStatusColor(session.status)}
                sx={{ fontWeight: 'bold', mr: 1 }}
              />
              
              {userRole === 'ADMIN' || userRole === 'COMPANY' || userSubrole === EmployeeSubrole.GUARD ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={startVerification}
                  startIcon={<VerifiedUser />}
                  disabled={verifying || verificationFormOpen}
                >
                  Verify Session
                </Button>
              ) : null}
            </Box>
          </Box>
          
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Session Details
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <LocationOn fontSize="small" /> Source: {session?.source}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <LocationOn fontSize="small" /> Destination: {session?.destination}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <AccessTime fontSize="small" /> Created: {session ? new Date(session.createdAt).toLocaleString() : ''}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <BusinessCenter fontSize="small" /> Company: {session?.company?.name || 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
          
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              Trip Details
            </Typography>
            
            {session.tripDetails ? (
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {Object.entries(session.tripDetails)
                      .filter(([key]) => !isSystemField(key))
                      .map(([key, value]) => (
                        <TableRow key={key}>
                          <TableCell sx={{ fontWeight: 'bold' }}>
                            {getFieldLabel(key)}
                          </TableCell>
                          <TableCell>{value || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No trip details available</Alert>
            )}
          </Paper>
          
          {/* Verification Dialog */}
          <Dialog
            open={verificationFormOpen}
            onClose={() => !verifying && setVerificationFormOpen(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Verify Session
              <IconButton
                aria-label="close"
                onClick={() => !verifying && setVerificationFormOpen(false)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
                disabled={verifying}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            
            <DialogContent>
              <LinearProgress
                variant="determinate"
                value={verificationStep * 33.3}
                sx={{ mb: 3 }}
              />
              
              {verificationStep === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Verify Trip Details
                  </Typography>
                  
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Field</TableCell>
                          <TableCell>Value</TableCell>
                          <TableCell align="center">Status</TableCell>
                          <TableCell align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {session.tripDetails && Object.entries(session.tripDetails)
                          .filter(([key]) => !isSystemField(key))
                          .map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell>{getFieldLabel(key)}</TableCell>
                              <TableCell>{value || 'N/A'}</TableCell>
                              <TableCell align="center">
                                {verificationFields[key]?.verified ? (
                                  <Chip 
                                    icon={<CheckCircle />} 
                                    label="Verified" 
                                    color="success" 
                                    size="small"
                                  />
                                ) : (
                                  <Chip 
                                    icon={<RadioButtonUnchecked />} 
                                    label="Pending" 
                                    color="default" 
                                    size="small"
                                  />
                                )}
                              </TableCell>
                              <TableCell align="center">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  color={verificationFields[key]?.verified ? "success" : "primary"}
                                  onClick={() => verifyField(key)}
                                  startIcon={verificationFields[key]?.verified ? <CheckCircle /> : <VerifiedUser />}
                                >
                                  {verificationFields[key]?.verified ? "Verified" : "Verify"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={verifyAllFields}
                    >
                      Verify All Fields
                    </Button>
                    
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => setVerificationStep(1)}
                      endIcon={<ArrowForward />}
                    >
                      Next
                    </Button>
                  </Box>
                </Box>
              )}
              
              {verificationStep === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Verify Seal Tags
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <ClientSideQrScanner 
                      onScan={(data) => handleScanComplete(data, 'digital')}
                      buttonText="Scan QR Code"
                    />
                    
                    {scanError && (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        {scanError}
                      </Alert>
                    )}
                  </Box>
                  
                  <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Seal ID</TableCell>
                          <TableCell>Scanned By</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {guardScannedSeals.map((seal) => (
                          <TableRow key={seal.id}>
                            <TableCell>{seal.id}</TableCell>
                            <TableCell>Guard</TableCell>
                            <TableCell>
                              <Chip 
                                label={getMethodDisplay(seal.method)}
                                color={getMethodColor(seal.method)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {seal.verified ? (
                                <Chip 
                                  icon={<CheckCircle />} 
                                  label="Verified" 
                                  color="success" 
                                  size="small"
                                />
                              ) : (
                                <Chip 
                                  icon={<Warning />} 
                                  label="Not Matched" 
                                  color="error" 
                                  size="small"
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      variant="outlined"
                      onClick={() => setVerificationStep(0)}
                      startIcon={<ArrowBack />}
                    >
                      Back
                    </Button>
                    
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={() => setVerificationStep(2)}
                      endIcon={<ArrowForward />}
                    >
                      Next
                    </Button>
                  </Box>
                </Box>
              )}
              
              {verificationStep === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Complete Verification
                  </Typography>
                  
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Please review the verification details below before completing the process.
                  </Alert>
                  
                  <Paper sx={{ p: 2, mb: 3 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Verification Summary
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        Trip Details Verification: {getVerificationStats().verified}/{getVerificationStats().total} fields verified ({getVerificationStats().percentage}%)
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getVerificationStats().percentage}
                        color={getVerificationStats().percentage === 100 ? "success" : "primary"}
                        sx={{ mt: 1 }}
                      />
                    </Box>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2">
                        Seal Tags: {sealComparison.matched.length} matched, {sealComparison.mismatched.length} mismatched
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={guardScannedSeals.length > 0 ? (sealComparison.matched.length / guardScannedSeals.length) * 100 : 0}
                        color={sealComparison.mismatched.length === 0 && sealComparison.matched.length > 0 ? "success" : "warning"}
                        sx={{ mt: 1 }}
                      />
                    </Box>
                  </Paper>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                      variant="outlined"
                      onClick={() => setVerificationStep(1)}
                      startIcon={<ArrowBack />}
                    >
                      Back
                    </Button>
                    
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleVerifySeal}
                      disabled={verifying || getVerificationStats().percentage < 100}
                      startIcon={verifying ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                    >
                      {verifying ? "Processing..." : "Complete Verification"}
                    </Button>
                  </Box>
                </Box>
              )}
            </DialogContent>
          </Dialog>
          
          {/* Image Preview Modal */}
          <Dialog
            open={openImageModal}
            onClose={() => setOpenImageModal(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>
              Image Preview
              <IconButton
                aria-label="close"
                onClick={() => setOpenImageModal(false)}
                sx={{ position: 'absolute', right: 8, top: 8 }}
              >
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              {selectedImage && (
                <Box
                  component="img"
                  src={selectedImage}
                  alt="Preview"
                  sx={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </Container>
  );
} 