"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Container from '@mui/material/Container';

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
  Refresh,
  BusinessCenter,
  Close,
  Inventory,
  Router,
  Money,
  Assessment,
  Scale
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole, UserRole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';
// Import autoTable as a separate named import instead of side-effect import
import autoTable from 'jspdf-autotable';
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
      verified: operatorIds.includes(seal.id),
      imagePreview: seal.imagePreview || null,
      image: seal.image || null
    }));
    
    // Use type assertion to bypass TypeScript error
    setGuardScannedSeals(updatedGuardSeals as any);
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
      // Create a new jsPDF instance - landscape to fit more content
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      let yPos = 15; // Starting y position
      const leftMargin = 14;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      
      // Helper function to add a new page and reset y position
      const addNewPageIfNeeded = (requiredSpace = 20) => {
        if (yPos + requiredSpace > pageHeight - 15) {
          doc.addPage();
          yPos = 15;
          return true;
        }
        return false;
      };
      
      // Add title
      doc.setFontSize(20);
      doc.text('Trip Session Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += 12;
      
      // Add session details
      doc.setFontSize(14);
      doc.text('Basic Information', leftMargin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.text(`Session ID: ${session.id}`, leftMargin, yPos); yPos += 6;
      doc.text(`Created: ${new Date(session.createdAt).toLocaleString()}`, leftMargin, yPos); yPos += 6;
      doc.text(`Status: ${session.status.replace('_', ' ')}`, leftMargin, yPos); yPos += 6;
      doc.text(`Company: ${session.company.name}`, leftMargin, yPos); yPos += 6;
      doc.text(`Created By: ${session.createdBy.name}`, leftMargin, yPos); yPos += 6;
      doc.text(`Source: ${session.source}`, leftMargin, yPos); yPos += 6;
      doc.text(`Destination: ${session.destination}`, leftMargin, yPos); yPos += 10;
      
      // Function to add an image to PDF
      const addImageToPdf = async (imageUrl: string, title: string) => {
        if (!imageUrl) return;
        
        try {
          addNewPageIfNeeded(70);
          
          // Add image title
          doc.setFontSize(10);
          doc.text(title, leftMargin, yPos);
          yPos += 5;
          
          // Create a temporary image element to load the image
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          
          // Wait for image to load
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
          });
          
          // Calculate image dimensions to fit in PDF
          const maxWidth = 120;
          const maxHeight = 60;
          
          let imgWidth = img.width;
          let imgHeight = img.height;
          
          if (imgWidth > maxWidth) {
            const ratio = maxWidth / imgWidth;
            imgWidth = maxWidth;
            imgHeight = imgHeight * ratio;
          }
          
          if (imgHeight > maxHeight) {
            const ratio = maxHeight / imgHeight;
            imgHeight = maxHeight;
            imgWidth = imgWidth * ratio;
          }
          
          // Add image to PDF
          doc.addImage(img, 'JPEG', leftMargin, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
          
        } catch (error) {
          console.error(`Error adding image to PDF: ${title}`, error);
          doc.text(`[Error loading image: ${title}]`, leftMargin, yPos);
          yPos += 10;
        }
      };
      
      // Add trip details section
      if (session.tripDetails) {
        addNewPageIfNeeded(60);
        doc.setFontSize(14);
        doc.text('Trip Details', leftMargin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        const tripDetails = session.tripDetails;
        
        // Create trip details table
        const tripDetailsArray = Object.entries(tripDetails)
          .filter(([key]) => !isSystemField(key))
          .map(([key, value]) => [getFieldLabel(key), value || 'N/A']);
        
        if (tripDetailsArray.length > 0) {
          // Call autoTable with doc as first parameter
          autoTable(doc, {
            head: [['Field', 'Value']],
            body: tripDetailsArray,
            startY: yPos,
            margin: { left: leftMargin },
            styles: { fontSize: 9 },
            headStyles: { fillColor: [75, 75, 75] }
          });
          
          // Update yPos using the current autoTable object
          yPos = (doc as any).lastAutoTable.finalY + 10;
        } else {
          doc.text('No trip details available', leftMargin, yPos);
          yPos += 10;
        }
      }
      
      // Add seal information
      if (session.sealTags && session.sealTags.length > 0) {
        addNewPageIfNeeded(60);
        doc.setFontSize(14);
        doc.text('Seal Tags', leftMargin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        doc.text(`Total Seal Tags: ${session.sealTags.length}`, leftMargin, yPos);
        yPos += 8;
        
        // Create seal tags table
        const sealTagsArray = session.sealTags.map((tag, index) => [
          index + 1,
          tag.barcode,
          getMethodDisplay(tag.method),
          new Date(tag.createdAt).toLocaleString(),
          tag.scannedByName || 'Unknown'
        ]);
        
        // Call autoTable with doc as first parameter
        autoTable(doc, {
          head: [['No.', 'Seal Tag ID', 'Method', 'Created At', 'Created By']],
          body: sealTagsArray,
          startY: yPos,
          margin: { left: leftMargin },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [75, 75, 75] }
        });
        
        // Update yPos using the current autoTable object
        yPos = (doc as any).lastAutoTable.finalY + 10;
        
        // Add seal tag images
        addNewPageIfNeeded(20);
        doc.setFontSize(12);
        doc.text('Seal Tag Images', leftMargin, yPos);
        yPos += 8;
        
        // Process seal tag images
        for (let i = 0; i < session.sealTags.length; i++) {
          const tag = session.sealTags[i];
          if (tag.imageUrl || tag.imageData) {
            await addImageToPdf(
              tag.imageUrl || tag.imageData || '', 
              `Seal Tag ${i + 1}: ${tag.barcode}`
            );
          }
        }
      }
      
      // Add images section - vehicle and document images
      if (session.images) {
        addNewPageIfNeeded(80);
        doc.setFontSize(14);
        doc.text('Vehicle & Document Images', leftMargin, yPos);
        yPos += 8;
        
        // Process all images
        if (session.images.vehicleNumberPlatePicture) {
          await addImageToPdf(session.images.vehicleNumberPlatePicture, 'Vehicle Number Plate');
        }
        
        if (session.images.gpsImeiPicture) {
          await addImageToPdf(session.images.gpsImeiPicture, 'GPS IMEI Photo');
        }
        
        if (session.images.driverPicture) {
          await addImageToPdf(session.images.driverPicture, 'Driver Photo');
        }
        
        // Add vehicle images
        if (session.images.vehicleImages && session.images.vehicleImages.length > 0) {
          for (let i = 0; i < session.images.vehicleImages.length; i++) {
            await addImageToPdf(session.images.vehicleImages[i], `Vehicle Image ${i + 1}`);
          }
        }
        
        // Add sealing images
        if (session.images.sealingImages && session.images.sealingImages.length > 0) {
          for (let i = 0; i < session.images.sealingImages.length; i++) {
            await addImageToPdf(session.images.sealingImages[i], `Sealing Image ${i + 1}`);
          }
        }
        
        // Add additional images
        if (session.images.additionalImages && session.images.additionalImages.length > 0) {
          for (let i = 0; i < session.images.additionalImages.length; i++) {
            await addImageToPdf(session.images.additionalImages[i], `Additional Image ${i + 1}`);
          }
        }
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
        </Paper>

        {/* Session Details */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">
              Session Details
            </Typography>
            <Chip 
              label={session.status.replace('_', ' ')}
              color={getStatusColor(session.status)}
              sx={{ fontWeight: 'bold' }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationOn fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Source:</strong> {session.source}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LocationOn fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Destination:</strong> {session.destination}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AccessTime fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Created At:</strong> {new Date(session.createdAt).toLocaleString()}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BusinessCenter fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Company:</strong> {session.company?.name || 'N/A'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DirectionsCar fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Vehicle Number:</strong> {session.tripDetails?.vehicleNumber || 'N/A'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Person fontSize="small" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Created By:</strong> {session.createdBy?.name || 'N/A'}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
              {((userRole === UserRole.ADMIN) || (userRole === UserRole.COMPANY) || (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.GUARD)) ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={startVerification}
                  startIcon={<VerifiedUser />}
                  disabled={verifying || verificationFormOpen}
                  size="small"
                >
                  Verify Session
                </Button>
              ) : null}
            </Box>
          </Box>
        </Paper>
        
        {/* Trip Details Section */}
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
        
        {/* Driver Details Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Driver Details
          </Typography>
          
          {session.tripDetails ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <Person fontSize="small" /> Driver Name: {session.tripDetails.driverName || 'N/A'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <Phone fontSize="small" /> Contact Number: {session.tripDetails.driverContactNumber || 'N/A'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1">
                  <VerifiedUser fontSize="small" /> License: {session.tripDetails.driverLicense || 'N/A'}
                </Typography>
              </Grid>
              
              {session.images?.driverPicture && (
                <Grid item xs={12}>
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
                </Grid>
              )}
            </Grid>
          ) : (
            <Alert severity="info">No driver details available</Alert>
          )}
        </Paper>
        
              {/* Seal Information Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Seal Information
        </Typography>
        
        {session.sealTags && session.sealTags.length > 0 ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 'bold' }}>
                Total Seal Tags: {session.sealTags.length}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
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
                            sx={{
                              width: '50px',
                              height: '50px',
                              cursor: 'pointer',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                            onClick={() => {
                              setSelectedImage(tag.imageUrl || tag.imageData || '');
                              setOpenImageModal(true);
                            }}
                          >
                            <img
                              src={tag.imageUrl || tag.imageData || ''}
                              alt={`Seal tag ${tag.barcode}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                console.error(`Failed to load image for seal tag ${tag.barcode}:`, e);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = 'Load Error';
                              }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No image
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{new Date(tag.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{tag.scannedByName || 'Unknown'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : (
          <Alert severity="info">No seal tags available</Alert>
        )}
        </Paper>
        
        {/* Images Section */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            Vehicle & Document Images
          </Typography>
          
          {session.images ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.vehicleNumberPlatePicture && (
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }}>
                  <Paper 
                    elevation={2} 
                    sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <Typography variant="subtitle1" gutterBottom>
                      Vehicle Number Plate
                    </Typography>
                    <Box 
                      component="img" 
                      src={session.images.vehicleNumberPlatePicture}
                      alt="Vehicle Number Plate"
                      sx={{ 
                        width: '100%', 
                        height: '200px',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        mb: 1
                      }}
                      onClick={() => {
                        setSelectedImage(session.images?.vehicleNumberPlatePicture || '');
                        setOpenImageModal(true);
                      }}
                    />
                  </Paper>
                </Box>
              )}
              
              {session.images.gpsImeiPicture && (
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }}>
                  <Paper 
                    elevation={2} 
                    sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <Typography variant="subtitle1" gutterBottom>
                      GPS IMEI Photo
                    </Typography>
                    <Box 
                      component="img" 
                      src={session.images.gpsImeiPicture}
                      alt="GPS IMEI"
                      sx={{ 
                        width: '100%', 
                        height: '200px',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        mb: 1
                      }}
                      onClick={() => {
                        setSelectedImage(session.images?.gpsImeiPicture || '');
                        setOpenImageModal(true);
                      }}
                    />
                  </Paper>
                </Box>
              )}
              
              {session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
                session.images.vehicleImages.map((imageUrl, index) => (
                  <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }} key={`vehicle-${index}`}>
                    <Paper 
                      elevation={2} 
                      sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                    >
                      <Typography variant="subtitle1" gutterBottom>
                        Vehicle Image {index + 1}
                      </Typography>
                      <Box 
                        component="img" 
                        src={imageUrl}
                        alt={`Vehicle Image ${index + 1}`}
                        sx={{ 
                          width: '100%', 
                          height: '200px',
                          objectFit: 'cover',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          mb: 1
                        }}
                        onClick={() => {
                          setSelectedImage(imageUrl);
                          setOpenImageModal(true);
                        }}
                      />
                    </Paper>
                  </Box>
                ))
              )}
              
              {(!session.images.vehicleNumberPlatePicture && 
                !session.images.gpsImeiPicture && 
                (!session.images.vehicleImages || session.images.vehicleImages.length === 0)) && (
                <Box sx={{ width: '100%', p: 2 }}>
                  <Alert severity="info">No images available</Alert>
                </Box>
              )}
            </Box>
          ) : (
            <Alert severity="info">No images available</Alert>
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
          </DialogContent>
        </Dialog>
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
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Chip
              label={session.status.replace('_', ' ')}
              color={getStatusColor(session.status)}
              sx={{ mr: 2, fontWeight: 'bold' }}
            />
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
        
        {/* Basic Information Section */}
        <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
          Basic Information
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LocationOn color="primary" sx={{ mr: 1 }} />
              <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Source:</Typography>
              <Typography>{session.source}</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LocationOn color="primary" sx={{ mr: 1 }} />
              <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Destination:</Typography>
              <Typography>{session.destination}</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <AccessTime color="primary" sx={{ mr: 1 }} />
              <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Created:</Typography>
              <Typography>{new Date(session.createdAt).toLocaleString()}</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <BusinessCenter color="primary" sx={{ mr: 1 }} />
              <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Company:</Typography>
              <Typography>{session.company?.name || 'N/A'}</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Person color="primary" sx={{ mr: 1 }} />
              <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Operator Created:</Typography>
              <Typography>{session.createdBy?.name || 'N/A'}</Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DirectionsCar color="primary" sx={{ mr: 1 }} />
              <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Vehicle Number:</Typography>
              <Typography>{session.tripDetails?.vehicleNumber || 'N/A'}</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      {/* Trip Details Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Trip Details
        </Typography>
        
        {session.tripDetails ? (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DirectionsCar color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Transporter Name:</Typography>
                <Typography>{session.tripDetails.transporterName || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Inventory color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Material Name:</Typography>
                <Typography>{session.tripDetails.materialName || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DirectionsCar color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Vehicle Number:</Typography>
                <Typography>{session.tripDetails.vehicleNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Router color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>GPS/IMEI Number:</Typography>
                <Typography>{session.tripDetails.gpsImeiNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Driver Name:</Typography>
                <Typography>{session.tripDetails.driverName || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Phone color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Driver Contact Number:</Typography>
                <Typography>{session.tripDetails.driverContactNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Loader Name:</Typography>
                <Typography>{session.tripDetails.loaderName || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Description color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Challan Royalty Number:</Typography>
                <Typography>{session.tripDetails.challanRoyaltyNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Description color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>DO Number:</Typography>
                <Typography>{session.tripDetails.doNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Money color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Freight:</Typography>
                <Typography>{session.tripDetails.freight ? `${session.tripDetails.freight} kg` : 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Quality of Materials:</Typography>
                <Typography>{session.tripDetails.qualityOfMaterials || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Description color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>TP Number:</Typography>
                <Typography>{session.tripDetails.tpNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Scale color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Gross Weight:</Typography>
                <Typography>{session.tripDetails.grossWeight ? `${session.tripDetails.grossWeight} kg` : 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Scale color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Tare Weight:</Typography>
                <Typography>{session.tripDetails.tareWeight ? `${session.tripDetails.tareWeight} kg` : 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Scale color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Net Material Weight:</Typography>
                <Typography>{session.tripDetails.netMaterialWeight ? `${session.tripDetails.netMaterialWeight} kg` : 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Phone color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Loader Mobile Number:</Typography>
                <Typography>{session.tripDetails.loaderMobileNumber || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LocationOn color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Loading Site:</Typography>
                <Typography>{session.tripDetails.loadingSite || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Receiver Party Name:</Typography>
                <Typography>{session.tripDetails.receiverPartyName || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <VerifiedUser color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Driver License:</Typography>
                <Typography>{session.tripDetails.driverLicense || 'N/A'}</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Description color="primary" sx={{ mr: 1 }} />
                <Typography sx={{ fontWeight: 'bold', mr: 1 }}>Registration Certificate:</Typography>
                <Typography>N/A</Typography>
              </Box>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">No trip details available</Alert>
        )}
      </Paper>
      
      {/* Seal Information Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Seal Information
        </Typography>
        
        {session.sealTags && session.sealTags.length > 0 ? (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 'bold' }}>
                Total Seal Tags: {session.sealTags.length}
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
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
                            sx={{
                              width: '50px',
                              height: '50px',
                              cursor: 'pointer',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              overflow: 'hidden',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                            onClick={() => {
                              setSelectedImage(tag.imageUrl || tag.imageData || '');
                              setOpenImageModal(true);
                            }}
                          >
                            <img
                              src={tag.imageUrl || tag.imageData || ''}
                              alt={`Seal tag ${tag.barcode}`}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                              }}
                              onError={(e) => {
                                console.error(`Failed to load image for seal tag ${tag.barcode}:`, e);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = 'Load Error';
                              }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No image
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{new Date(tag.createdAt).toLocaleString()}</TableCell>
                      <TableCell>{tag.scannedByName || 'Unknown'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        ) : (
          <Alert severity="info">No seal tags available</Alert>
        )}
      </Paper>
      
      {/* Vehicle & Document Images Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Vehicle & Document Images
        </Typography>
        
        {session.images ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {session.images.vehicleNumberPlatePicture && (
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }}>
                <Paper 
                  elevation={2} 
                  sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    Vehicle Number Plate
                  </Typography>
                  <Box 
                    component="img" 
                    src={session.images.vehicleNumberPlatePicture}
                    alt="Vehicle Number Plate"
                    sx={{ 
                      width: '100%', 
                      height: '200px',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      mb: 1
                    }}
                    onClick={() => {
                      setSelectedImage(session.images?.vehicleNumberPlatePicture || '');
                      setOpenImageModal(true);
                    }}
                  />
                </Paper>
              </Box>
            )}
            
            {session.images.gpsImeiPicture && (
              <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }}>
                <Paper 
                  elevation={2} 
                  sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    GPS IMEI Photo
                  </Typography>
                  <Box 
                    component="img" 
                    src={session.images.gpsImeiPicture}
                    alt="GPS IMEI"
                    sx={{ 
                      width: '100%', 
                      height: '200px',
                      objectFit: 'cover',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      mb: 1
                    }}
                    onClick={() => {
                      setSelectedImage(session.images?.gpsImeiPicture || '');
                      setOpenImageModal(true);
                    }}
                  />
                </Paper>
              </Box>
            )}
            
            {session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
              session.images.vehicleImages.map((imageUrl, index) => (
                <Box sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)', md: 'calc(33.33% - 11px)' } }} key={`vehicle-${index}`}>
                  <Paper 
                    elevation={2} 
                    sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}
                  >
                    <Typography variant="subtitle1" gutterBottom>
                      Vehicle Image {index + 1}
                    </Typography>
                    <Box 
                      component="img" 
                      src={imageUrl}
                      alt={`Vehicle Image ${index + 1}`}
                      sx={{ 
                        width: '100%', 
                        height: '200px',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        mb: 1
                      }}
                      onClick={() => {
                        setSelectedImage(imageUrl);
                        setOpenImageModal(true);
                      }}
                    />
                  </Paper>
                </Box>
              ))
            )}
            
            {(!session.images.vehicleNumberPlatePicture && 
              !session.images.gpsImeiPicture && 
              (!session.images.vehicleImages || session.images.vehicleImages.length === 0)) && (
              <Box sx={{ width: '100%', p: 2 }}>
                <Alert severity="info">No images available</Alert>
              </Box>
            )}
          </Box>
        ) : (
          <Alert severity="info">No images available</Alert>
        )}
      </Paper>
      
      {/* Comments Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Comments
        </Typography>
        <CommentSection sessionId={sessionId} />
      </Paper>
      
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