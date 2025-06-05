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
  Grid as MuiGrid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  IconButton
} from "@mui/material";

// Fix for TypeScript errors with Grid
const Grid = MuiGrid;

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
  QrCode,
  Refresh
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';
import toast from "react-hot-toast";

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
    imageUrl?: string | null; 
    imageData?: string | null;
    createdAt: string;
    scannedById?: string;
    scannedByName?: string;
  }[];
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

// TabPanel component for verification mode
function TabPanel(props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`verification-tabpanel-${index}`}
      aria-labelledby={`verification-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

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
  const [verificationMode, setVerificationMode] = useState(false); // Controls Guard tabbed UI
  
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
    session?.status === SessionStatus.IN_PROGRESS,
    [isGuard, session]
  );

  // Session data and user role loading
  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user) {
      setUserRole(authSession.user.role || "");
      setUserSubrole(authSession.user.subrole || "");
      fetchSessionDetails();
    }
  }, [authStatus, authSession, sessionId]);

  // Check for verification mode on load
  useEffect(() => {
    // Auto-enter verification mode for guards
    if (isGuard && session && session.status === SessionStatus.IN_PROGRESS) {
      setVerificationMode(true);
      startVerification();
    }
  }, [isGuard, session]);

  // Update seal comparison when seals change
  useEffect(() => {
    updateSealComparison(guardScannedSeals);
  }, [guardScannedSeals, operatorSeals]);

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
      const response = await fetch(`/api/sessions/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Session data received:", data);
      setSession(data);
      
      // Initialize operator seals if available
      if (data.sealTags && Array.isArray(data.sealTags)) {
        setOperatorSeals(data.sealTags.map((tag: any) => ({ 
          id: tag.barcode,
          method: tag.method,
          timestamp: tag.createdAt
        })));
      }
      
      // Fetch guard seal tags if in verification mode
      if (isGuard) {
        fetchGuardSealTags();
      }
      
    } catch (err) {
      console.error("Error fetching session:", err);
      setError(`Failed to load session: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, isGuard]);

  // Fetch guard seal tags for verification
  const fetchGuardSealTags = async () => {
    if (!sessionId) return;
    
    try {
      console.log("Fetching guard verification sessions");
      const response = await fetch(`/api/sessions/${sessionId}/guard-seals`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch guard seal tags: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Guard seal tags received:", data);
      
      // Process and set guard scanned seals
      if (data && Array.isArray(data)) {
        const processedSeals = data.map((tag: any) => ({
          id: tag.barcode,
          method: tag.method,
          image: tag.imageUrl || null,
          timestamp: tag.createdAt,
          verified: false // Will be updated during comparison
        }));
        
        setGuardScannedSeals(processedSeals);
        updateSealComparison(processedSeals);
      }
    } catch (err) {
      console.error("Error fetching guard seal tags:", err);
      toast.error(`Failed to load guard verification data: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  // Update seal comparison
  const updateSealComparison = (guardSeals: any[]) => {
    const matched: string[] = [];
    const mismatched: string[] = [];
    
    // Extract just the barcode/id values
    const operatorIds = operatorSeals.map(seal => seal.id);
    const guardIds = guardSeals.map(seal => seal.id);
    
    // Find matches and mismatches
    guardIds.forEach(id => {
      if (operatorIds.includes(id)) {
        matched.push(id);
      } else {
        mismatched.push(id);
      }
    });
    
    // Update state
    setSealComparison({ matched, mismatched });
    
    // Update verification status on guard seals
    const updatedGuardSeals = guardSeals.map(seal => ({
      ...seal,
      verified: operatorIds.includes(seal.id)
    }));
    
    setGuardScannedSeals(updatedGuardSeals);
  };

  // Process images for upload
  const processImageForUpload = async (imageFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data);
      };
      reader.onerror = () => {
        reject(new Error("Failed to read image file"));
      };
      reader.readAsDataURL(imageFile);
    });
  };

  // Handle scanned barcode
  const handleScanComplete = async (barcodeData: string, method: string = 'digital', imageFile?: File) => {
    if (!barcodeData.trim()) {
      setScanError("Please enter a valid seal tag");
      return;
    }
    
    setScanError("");
    const trimmedData = barcodeData.trim();
    
    // Check if already scanned
    if (guardScannedSeals.some(seal => seal.id === trimmedData)) {
      toast.error(`Seal tag ${trimmedData} has already been scanned`);
      return;
    }
    
    try {
      // Process image if provided
      let imageData = null;
      if (imageFile) {
        imageData = await processImageForUpload(imageFile);
      }
      
      // Determine if this scan matches an operator seal
      const isVerified = operatorSeals.some(seal => seal.id === trimmedData);
      
      // Save the seal tag to the backend
      const response = await fetch(`/api/sessions/${sessionId}/guard-seals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: trimmedData,
          method,
          imageData,
          verified: isVerified
        }),
      });
      
      if (!response.ok) {
        // Try to extract specific error
        if (response.status === 409) {
          const errorData = await response.json();
          if (errorData.existingTag) {
            toast.success(`Seal tag ${trimmedData} was already scanned previously`);
          }
          fetchGuardSealTags();
          return;
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
  const startVerification = async () => {
    setVerifying(true);
    try {
      // Make sure operator seals are loaded
      if (session?.sealTags && Array.isArray(session.sealTags) && operatorSeals.length === 0) {
        setOperatorSeals(session.sealTags.map((tag: any) => ({ id: tag.barcode })));
      }
      
      // Load guard seal tags if needed
      await fetchGuardSealTags();
      
      // Update UI state to show verification form
      setVerificationFormOpen(true);
      setVerificationMode(true); // Enable verification mode UI
      setVerificationStep(0);
      console.log("Verification form opened");
    } catch (error) {
      console.error("Error starting verification:", error);
      toast.error("Failed to start verification. Please try again.");
    } finally {
      setVerifying(false);
    }
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
        throw new Error(`Failed to complete verification: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Verification result:', result);
      
      setVerificationResults(result);
      toast.success('Verification completed successfully!');
    } catch (error) {
      console.error('Error completing verification:', error);
      toast.error('Failed to complete verification. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Fix toast.info - replace with toast success
  const notifyToastInfo = (message: string) => {
    toast.success(message); // Using success instead of info which might not be available
  };

  // Function to generate PDF report
  const generatePdfReport = useCallback(async () => {
    if (!session) return;
    
    setReportLoading('pdf');
    try {
      // Create a new jsPDF instance
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Trip Session Report', 105, 15, { align: 'center' });
      
      // Add session details
      doc.setFontSize(12);
      doc.text(`Session ID: ${session.id}`, 14, 30);
      doc.text(`Created: ${new Date(session.createdAt).toLocaleString()}`, 14, 38);
      doc.text(`Status: ${session.status}`, 14, 46);
      doc.text(`Company: ${session.company.name}`, 14, 54);
      doc.text(`Created By: ${session.createdBy.name}`, 14, 62);
      
      // Add source & destination
      doc.setFontSize(16);
      doc.text('Trip Route', 14, 75);
      doc.setFontSize(12);
      doc.text(`Source: ${session.source}`, 14, 83);
      doc.text(`Destination: ${session.destination}`, 14, 91);
      
      // Add driver details
      if (session.tripDetails) {
        doc.setFontSize(16);
        doc.text('Driver Details', 14, 105);
        doc.setFontSize(12);
        doc.text(`Driver: ${session.tripDetails.driverName || 'N/A'}`, 14, 113);
        doc.text(`Contact: ${session.tripDetails.driverContactNumber || 'N/A'}`, 14, 121);
        doc.text(`License: ${session.tripDetails.driverLicense || 'N/A'}`, 14, 129);
        doc.text(`Registration Certificate: ${session.tripDetails.registrationCertificate || 'N/A'}`, 14, 137);
      }
      
      // Add vehicle details
      if (session.tripDetails) {
        doc.setFontSize(16);
        doc.text('Vehicle Details', 14, 151);
        doc.setFontSize(12);
        doc.text(`Vehicle Number: ${session.tripDetails.vehicleNumber || 'N/A'}`, 14, 159);
        doc.text(`Transporter: ${session.tripDetails.transporterName || 'N/A'}`, 14, 167);
        doc.text(`GPS IMEI: ${session.tripDetails.gpsImeiNumber || 'N/A'}`, 14, 175);
      }
      
      // Add seal information
      if (session.sealTags && session.sealTags.length > 0) {
        doc.setFontSize(16);
        doc.text('Seal Tags', 14, 189);
        doc.setFontSize(12);
        
        session.sealTags.forEach((tag, index) => {
          const y = 197 + (index * 8);
          doc.text(`Tag ${index + 1}: ${tag.barcode} (${getMethodDisplay(tag.method)})`, 14, y);
        });
      }
      
      // Save the PDF
      doc.save(`Session_${session.id}.pdf`);
      
      toast.success('PDF report generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    } finally {
      setReportLoading(null);
    }
  }, [session, toast]);

  // Render function
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <Alert severity="error">
        <AlertTitle>Error</AlertTitle>
        {error}
      </Alert>
    );
  }
  
  if (!session) {
    return (
      <Alert severity="warning">
        <AlertTitle>Session Not Found</AlertTitle>
        The requested session could not be found. It may have been deleted or you may not have permission to view it.
      </Alert>
    );
  }
  
  // For GUARD users with verification mode
  if (verificationMode && userRole === 'EMPLOYEE' && userSubrole === EmployeeSubrole.GUARD) {
    return (
      <Container maxWidth="xl">
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5" component="h1">
              Guard Verification
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.back()}
            >
              Back
            </Button>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Session {session.id}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Basic Information
                  </Typography>
                  <List>
                    <ListItem>
                      <ListItemText primary="Source" secondary={session.source} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Destination" secondary={session.destination} />
                    </ListItem>
                    <ListItem>
                      <ListItemText primary="Created" secondary={new Date(session.createdAt).toLocaleString()} />
                    </ListItem>
                  </List>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Trip Details
                  </Typography>
                  <List>
                    {session.tripDetails && Object.entries(session.tripDetails)
                      .filter(([key]) => !isSystemField(key))
                      .slice(0, 5) // Show only a few key details
                      .map(([key, value]) => (
                        <ListItem key={key}>
                          <ListItemText primary={getFieldLabel(key)} secondary={value || 'N/A'} />
                        </ListItem>
                      ))}
                  </List>
                </Paper>
              </Grid>
            </Grid>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Seal Tag Verification
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Scan Seal Tags
                  </Typography>
                  
                  <TextField
                    fullWidth
                    label="Scan or Enter Seal Tag"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    error={!!scanError}
                    helperText={scanError}
                    sx={{ mb: 2 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => handleScanComplete(scanInput, 'manual')}
                            disabled={!scanInput.trim()}
                          >
                            <CheckCircle />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => handleScanComplete(scanInput, 'manual')}
                    disabled={!scanInput.trim()}
                  >
                    Submit Manual Entry
                  </Button>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Verification Progress
                  </Typography>
                  
                  <Box sx={{ mb: 2 }}>
                    <Grid container spacing={1} alignItems="center">
                      <Grid item>
                        <Chip
                          label={`${sealComparison.matched.length}/${operatorSeals.length} Verified`}
                          color="primary"
                          variant="outlined"
                        />
                      </Grid>
                      <Grid item>
                        <Chip
                          icon={<CheckCircle fontSize="small" />}
                          label={`${sealComparison.matched.length} Matched`}
                          color="success"
                          variant="outlined"
                        />
                      </Grid>
                      {sealComparison.mismatched.length > 0 && (
                        <Grid item>
                          <Chip
                            icon={<Warning fontSize="small" />}
                            label={`${sealComparison.mismatched.length} Not Matched`}
                            color="warning"
                            variant="outlined"
                          />
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                  
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleVerifySeal}
                    disabled={verifying || sealComparison.matched.length === 0}
                    fullWidth
                  >
                    {verifying ? 'Submitting...' : 'Complete Verification'}
                  </Button>
                </Paper>
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Scanned Tags
              </Typography>
              
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Seal Tag</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {guardScannedSeals.map((seal) => (
                      <TableRow key={seal.id}>
                        <TableCell>{seal.id}</TableCell>
                        <TableCell>
                          <Chip
                            label={getMethodDisplay(seal.method)}
                            color={getMethodColor(seal.method)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{new Date(seal.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <Chip
                            icon={seal.verified ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                            label={seal.verified ? 'Matched' : 'Not Matched'}
                            color={seal.verified ? 'success' : 'warning'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {guardScannedSeals.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No seal tags scanned yet. Scan seal tags to verify.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        </Paper>
      </Container>
    );
  }
  
  // Regular view for other users
  return (
    <Container maxWidth="xl">
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h1">
            Session Details
          </Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => router.back()}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              startIcon={<PictureAsPdf />}
              onClick={generatePdfReport}
              disabled={!!reportLoading}
            >
              {reportLoading === 'pdf' ? 'Generating...' : 'Download PDF'}
            </Button>
          </Box>
        </Box>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Session ID"
                    secondary={session.id}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Status"
                    secondary={
                      <Chip
                        label={session.status}
                        color={getStatusColor(session.status)}
                        size="small"
                      />
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Created At"
                    secondary={new Date(session.createdAt).toLocaleString()}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Company Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Company"
                    secondary={session.company.name}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Created By"
                    secondary={session.createdBy.name}
                  />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
      
      <Box sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Trip Details" />
          <Tab label="Seal Tags" />
          <Tab label="Images" />
          <Tab label="Comments" />
        </Tabs>
        
        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Route Information
                </Typography>
                <List>
                  <ListItem>
                    <ListItemText
                      primary="Source"
                      secondary={session.source}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Destination"
                      secondary={session.destination}
                    />
                  </ListItem>
                </List>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Trip Details
                </Typography>
                <List>
                  {session.tripDetails && Object.entries(session.tripDetails)
                    .filter(([key]) => !isSystemField(key))
                    .map(([key, value]) => (
                      <ListItem key={key}>
                        <ListItemText
                          primary={getFieldLabel(key)}
                          secondary={value || 'N/A'}
                        />
                      </ListItem>
                    ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
        
        <TabPanel value={activeTab} index={1}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Seal Tags
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Barcode</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Scanned By</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Image</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {session.sealTags?.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell>{tag.barcode}</TableCell>
                      <TableCell>
                        <Chip
                          label={getMethodDisplay(tag.method)}
                          color={getMethodColor(tag.method)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{tag.scannedByName || 'N/A'}</TableCell>
                      <TableCell>{new Date(tag.createdAt).toLocaleString()}</TableCell>
                      <TableCell>
                        {tag.imageUrl && (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedImage(tag.imageUrl!);
                              setOpenImageModal(true);
                            }}
                          >
                            <QrCode />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </TabPanel>
        
        <TabPanel value={activeTab} index={2}>
          <Grid container spacing={2}>
            {session.images && (
              <>
                {session.images.gpsImeiPicture && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        GPS IMEI Picture
                      </Typography>
                      <Box
                        component="img"
                        src={session.images.gpsImeiPicture}
                        alt="GPS IMEI"
                        sx={{
                          width: '100%',
                          height: 180,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          borderRadius: 1,
                          mb: 2
                        }}
                        onClick={() => {
                          setSelectedImage(session.images?.gpsImeiPicture || '');
                          setOpenImageModal(true);
                        }}
                      />
                    </Paper>
                  </Grid>
                )}
                
                {session.images.vehicleNumberPlatePicture && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Vehicle Number Plate
                      </Typography>
                      <Box
                        component="img"
                        src={session.images.vehicleNumberPlatePicture}
                        alt="Vehicle Number Plate"
                        sx={{
                          width: '100%',
                          height: 180,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          borderRadius: 1,
                          mb: 2
                        }}
                        onClick={() => {
                          setSelectedImage(session.images?.vehicleNumberPlatePicture || '');
                          setOpenImageModal(true);
                        }}
                      />
                    </Paper>
                  </Grid>
                )}
                
                {session.images.driverPicture && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Driver Picture
                      </Typography>
                      <Box
                        component="img"
                        src={session.images.driverPicture}
                        alt="Driver"
                        sx={{
                          width: '100%',
                          height: 180,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          borderRadius: 1,
                          mb: 2
                        }}
                        onClick={() => {
                          setSelectedImage(session.images?.driverPicture || '');
                          setOpenImageModal(true);
                        }}
                      />
                    </Paper>
                  </Grid>
                )}
                
                {session.images.vehicleImages && session.images.vehicleImages.map((imageUrl, index) => (
                  <Grid item xs={12} sm={6} md={4} key={`vehicle-${index}`}>
                    <Paper elevation={1} sx={{ p: 2 }}>
                      <Typography variant="subtitle1" gutterBottom>
                        Vehicle Image {index + 1}
                      </Typography>
                      <Box
                        component="img"
                        src={imageUrl}
                        alt={`Vehicle ${index + 1}`}
                        sx={{
                          width: '100%',
                          height: 180,
                          objectFit: 'cover',
                          cursor: 'pointer',
                          borderRadius: 1,
                          mb: 2
                        }}
                        onClick={() => {
                          setSelectedImage(imageUrl);
                          setOpenImageModal(true);
                        }}
                      />
                    </Paper>
                  </Grid>
                ))}
              </>
            )}
          </Grid>
        </TabPanel>
        
        <TabPanel value={activeTab} index={3}>
          <CommentSection sessionId={sessionId} />
        </TabPanel>
      </Box>
      
      <Dialog
        open={openImageModal}
        onClose={() => setOpenImageModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Image Preview</DialogTitle>
        <DialogContent>
          <Box
            component="img"
            src={selectedImage}
            alt="Preview"
            sx={{
              width: '100%',
              height: 'auto',
              maxHeight: '80vh',
              objectFit: 'contain'
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImageModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}