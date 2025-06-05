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
  KeyboardArrowUp, KeyboardArrowDown, Phone
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
          
          // Check for issues that need fixing
          let needsReload = false;
          
          // 1. Check for missing images
          const hasMissingImages = data.sealTags.some((tag: any) => 
            (!tag.imageUrl && !tag.imageData) || 
            (tag.imageUrl === null && tag.imageData === null)
          );
          
          // 2. Check for identical timestamps
          const timestamps = data.sealTags.map((tag: any) => new Date(tag.createdAt).getTime());
          const uniqueTimestamps = new Set(timestamps);
          const hasIdenticalTimestamps = uniqueTimestamps.size === 1 && data.sealTags.length > 1;
          
          // Fix missing images if needed
          if (hasMissingImages) {
            console.log("Detected missing seal tag images, attempting to fix...");
            try {
              const fixResponse = await fetch(`/api/sessions/${sessionId}/fix-seal-images`);
              if (fixResponse.ok) {
                const fixResult = await fixResponse.json();
                console.log("Fix seal images result:", fixResult);
                if (fixResult.fixed > 0) {
                  needsReload = true;
                }
              }
            } catch (fixError) {
              console.error("Failed to fix seal tag images:", fixError);
            }
          }
          
          // Fix identical timestamps if needed
          if (hasIdenticalTimestamps) {
            console.log('Detected identical timestamps for all seal tags. Attempting to fix...');
            try {
              const fixResponse = await fetch(`/api/sessions/${sessionId}/fix-seal-timestamps`);
              if (fixResponse.ok) {
                const fixResult = await fixResponse.json();
                console.log('Fix seal timestamps result:', fixResult);
                if (fixResult.fixed > 0) {
                  needsReload = true;
                }
              }
            } catch (fixError) {
              console.error('Failed to fix seal tag timestamps:', fixError);
            }
          }
          
          // Check guard seal tags if they exist
          if (data.guardSealTags && Array.isArray(data.guardSealTags) && data.guardSealTags.length > 0) {
            console.log("Processing guard seal tags:", data.guardSealTags.length);
            
            // 1. Check for missing guard images
            const hasMissingGuardImages = data.guardSealTags.some((tag: any) => 
              (!tag.imageUrl && !tag.imageData) || 
              (tag.imageUrl === null && tag.imageData === null)
            );
            
            // 2. Check for identical timestamps in guard tags
            const guardTimestamps = data.guardSealTags.map((tag: any) => new Date(tag.createdAt).getTime());
            const uniqueGuardTimestamps = new Set(guardTimestamps);
            const hasIdenticalGuardTimestamps = uniqueGuardTimestamps.size === 1 && data.guardSealTags.length > 1;
            
            // Fix missing guard images if needed
            if (hasMissingGuardImages) {
              console.log("Detected missing guard seal tag images, attempting to fix...");
              try {
                const fixResponse = await fetch(`/api/sessions/${sessionId}/fix-guard-seal-images`);
                if (fixResponse.ok) {
                  const fixResult = await fixResponse.json();
                  console.log("Fix guard seal images result:", fixResult);
                  if (fixResult.fixed > 0) {
                    needsReload = true;
                  }
                }
              } catch (fixError) {
                console.error("Failed to fix guard seal tag images:", fixError);
              }
            }
            
            // Fix identical guard timestamps if needed
            if (hasIdenticalGuardTimestamps) {
              console.log('Detected identical timestamps for all guard seal tags. Attempting to fix...');
              try {
                const fixResponse = await fetch(`/api/sessions/${sessionId}/fix-guard-seal-timestamps`);
                if (fixResponse.ok) {
                  const fixResult = await fixResponse.json();
                  console.log('Fix guard seal timestamps result:', fixResult);
                  if (fixResult.fixed > 0) {
                    needsReload = true;
                  }
                }
              } catch (fixError) {
                console.error('Failed to fix guard seal tag timestamps:', fixError);
              }
            }
          }
          
          // Reload session data if any fixes were applied
          if (needsReload) {
            console.log('Reloading session data after applying fixes...');
            const updatedResponse = await fetch(`/api/sessions/${sessionId}`);
            if (updatedResponse.ok) {
              const updatedData = await updatedResponse.json();
              setSession(updatedData);
              console.log('Session data reloaded with fixes applied');
            }
          }
        }
        
        // Fetch guard seal tags
        fetchGuardSealTags();
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching session data:', error);
        setError('Failed to load session details');
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
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header with navigation and action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={() => router.push('/dashboard/sessions')}
        >
          Back to Sessions
        </Button>
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          {/* PDF Export Button - available to all users */}
          <Button
            variant="outlined"
            startIcon={<PictureAsPdf />}
            onClick={generatePdfReport}
            disabled={!!reportLoading}
          >
            {reportLoading === 'pdf' ? 'Generating...' : 'Export PDF'}
          </Button>
          
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => router.push(`/dashboard/sessions/${sessionId}/edit`)}
            >
              Edit Session
            </Button>
          )}
        </Box>
      </Box>

      {/* Session Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Session Details
        </Typography>
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
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Chip 
                label={session.status.replace('_', ' ')}
                color={getStatusColor(session.status)}
                sx={{ fontWeight: 'bold' }}
              />
            </Box>
          </Box>
          <Box sx={{ width: { xs: '100%', md: '50%' }, p: 1 }}>
            {userRole === 'ADMIN' || userRole === 'COMPANY' || userSubrole === EmployeeSubrole.GUARD ? (
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
      
      {/* Seal Tags Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Seal Tags
        </Typography>
        
        {session.sealTags && session.sealTags.length > 0 ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Seal ID</TableCell>
                  <TableCell>Scanned By</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Image</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {session.sealTags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>{tag.barcode}</TableCell>
                    <TableCell>
                      {tag.scannedByName || 'Unknown Operator'}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getMethodDisplay(tag.method)}
                        color={getMethodColor(tag.method)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{new Date(tag.createdAt).toLocaleString()}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
                  {verifying ? "Verifying..." : "Complete Verification"}
                </Button>
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Inline Seal Tag Verification UI */}
      {verificationFormOpen && (
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Seal Tags Verification
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
          </Typography>
          
          {/* Scan Seal Tags */}
          <Box sx={{ mt: 3, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Scan Seal Tags
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                variant="outlined"
                size="small"
                placeholder="Seal Tag ID"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                sx={{ flexGrow: 1 }}
              />
              
              <Button
                variant="outlined"
                onClick={() => handleScanComplete(scanInput, 'manual')}
                sx={{ minWidth: 120 }}
              >
                Add Manually
              </Button>
              
              <Button
                variant="contained"
                color="primary"
                startIcon={<QrCode />}
                onClick={() => {
                  // Show QR scanner
                  const scanner = document.getElementById('qr-scanner-container');
                  if (scanner) {
                    scanner.style.display = scanner.style.display === 'none' ? 'block' : 'none';
                  }
                }}
                sx={{ minWidth: 200 }}
              >
                Scan QR/Barcode
              </Button>
            </Box>
            
            <Box id="qr-scanner-container" sx={{ mb: 2, display: 'none' }}>
              <ClientSideQrScanner 
                onScan={(data) => handleScanComplete(data, 'digital')}
                buttonText="Scan QR Code"
              />
            </Box>
            
            {scanError && (
              <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                {scanError}
              </Alert>
            )}
          </Box>
          
          {/* Verification Progress */}
          <Box 
            sx={{ 
              p: 2, 
              mb: 3, 
              border: '1px solid', 
              borderColor: 'divider',
              borderLeft: '4px solid',
              borderLeftColor: 'primary.main',
              borderRadius: 1
            }}
          >
            <Typography variant="subtitle1" gutterBottom>
              Verification Progress:
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                label={`${sealComparison.matched.length}/${operatorSeals.length} Verified`}
                color="primary"
                variant="outlined"
              />
              
              <Chip 
                icon={<CheckCircle fontSize="small" />}
                label={`${sealComparison.matched.length} Matched`}
                color="success" 
                variant="outlined"
              />
              
              {sealComparison.mismatched.length > 0 && (
                <Chip 
                  icon={<Warning fontSize="small" />}
                  label={`${sealComparison.mismatched.length} Not Scanned`}
                  color="warning" 
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          
          {/* Seal Tags Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'background.paper' }}>
                  <TableCell>Seal Tag ID</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Matched seals displayed with details */}
                {guardScannedSeals.filter(seal => seal.verified).map((seal) => (
                  <React.Fragment key={seal.id}>
                    <TableRow sx={{ backgroundColor: '#f5fff5' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CheckCircle color="success" fontSize="small" sx={{ mr: 1 }} />
                          {seal.id}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={getMethodDisplay(seal.method)}
                          color={getMethodColor(seal.method)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label="Both"
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={<CheckCircle fontSize="small" />}
                          label="Matched" 
                          color="success" 
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => {
                          // Toggle details visibility
                          const detailsRow = document.getElementById(`details-${seal.id}`);
                          if (detailsRow) {
                            detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
                          }
                        }}>
                          <KeyboardArrowDown />
                        </IconButton>
                        
                        <IconButton size="small" color="error">
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    
                    {/* Details row for each verified seal */}
                    <TableRow id={`details-${seal.id}`} sx={{ display: 'none' }}>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
                        <Box sx={{ display: 'flex', p: 2 }}>
                          {/* Operator Information */}
                          <Box sx={{ flex: 1, mr: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Operator Information
                            </Typography>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Seal ID:
                              </Typography>
                              <Typography variant="body1">
                                {seal.id}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Method:
                              </Typography>
                              <Chip 
                                label={getMethodDisplay(seal.method)}
                                color={getMethodColor(seal.method)}
                                size="small"
                              />
                            </Box>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Timestamp:
                              </Typography>
                              <Typography variant="body1">
                                {new Date(seal.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                            
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Image:
                              </Typography>
                              {seal.imagePreview ? (
                                <Box
                                  component="img"
                                  src={seal.imagePreview}
                                  alt={`Seal ${seal.id}`}
                                  sx={{ 
                                    width: '100%',
                                    maxHeight: 150,
                                    objectFit: 'cover',
                                    borderRadius: 1,
                                    mt: 1,
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => {
                                    setSelectedImage(seal.imagePreview!);
                                    setOpenImageModal(true);
                                  }}
                                />
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No image available
                                </Typography>
                              )}
                            </Box>
                          </Box>
                          
                          {/* Guard Information */}
                          <Box sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              Guard Information
                            </Typography>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Seal ID:
                              </Typography>
                              <Typography variant="body1">
                                {seal.id}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Method:
                              </Typography>
                              <Chip 
                                label={getMethodDisplay(seal.method)}
                                color={getMethodColor(seal.method)}
                                size="small"
                              />
                            </Box>
                            
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary">
                                Timestamp:
                              </Typography>
                              <Typography variant="body1">
                                {new Date(seal.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                            
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Image:
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                <Button
                                  variant="outlined"
                                  startIcon={<CloudUpload />}
                                  size="small"
                                  component="label"
                                >
                                  Upload Image
                                  <input
                                    type="file"
                                    hidden
                                    accept="image/*"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        // Handle image upload
                                      }
                                    }}
                                  />
                                </Button>
                                
                                <Button
                                  variant="outlined"
                                  startIcon={<QrCode />}
                                  size="small"
                                >
                                  Capture Image
                                </Button>
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                        
                        {/* Verification Status */}
                        <Box 
                          sx={{ 
                            p: 2, 
                            mt: 1, 
                            backgroundColor: '#f5fff5',
                            borderTop: '1px solid',
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <Typography variant="subtitle2">
                            Verification Status: 
                            <Chip 
                              label="Verified Match"
                              color="success"
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                          
                          <Button
                            size="small"
                            endIcon={<KeyboardArrowUp />}
                            onClick={() => {
                              // Hide details
                              const detailsRow = document.getElementById(`details-${seal.id}`);
                              if (detailsRow) {
                                detailsRow.style.display = 'none';
                              }
                            }}
                          >
                            Close Details
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
                
                {/* Unverified operator seals */}
                {operatorSeals.filter(opSeal => 
                  !guardScannedSeals.some(gSeal => gSeal.id.toLowerCase() === opSeal.id.toLowerCase())
                ).map((seal) => (
                  <TableRow key={seal.id}>
                    <TableCell>{seal.id}</TableCell>
                    <TableCell>
                      <Chip 
                        label="Digitally Scanned"
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Operator"
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        icon={<Warning fontSize="small" />}
                        label="Not Scanned" 
                        color="warning" 
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" disabled>
                        <KeyboardArrowDown />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                
                {/* Mismatched seals (guard only) */}
                {guardScannedSeals.filter(seal => !seal.verified).map((seal) => (
                  <TableRow key={seal.id} sx={{ backgroundColor: '#fff5f5' }}>
                    <TableCell>{seal.id}</TableCell>
                    <TableCell>
                      <Chip 
                        label={getMethodDisplay(seal.method)}
                        color={getMethodColor(seal.method)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Guard Only"
                        color="error"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        icon={<Warning fontSize="small" />}
                        label="Mismatched" 
                        color="error" 
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error">
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Complete verification button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircle />}
              onClick={handleVerifySeal}
              disabled={verifying}
              sx={{ minWidth: 200 }}
            >
              {verifying ? (
                <>
                  <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                  Completing...
                </>
              ) : (
                "Complete Verification"
              )}
            </Button>
          </Box>
        </Paper>
      )}
      
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
          {selectedImage ? (
            <Box
              component="img"
              src={selectedImage}
              alt="Preview"
              sx={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }}
              onError={(e) => {
                console.error("Failed to load image in modal:", e);
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.parentElement!.innerHTML = 'Failed to load image. The image data may be corrupted or in an unsupported format.';
              }}
            />
          ) : (
            <Typography variant="body1" color="text.secondary" align="center">
              No image selected
            </Typography>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Comment Section */}
      <CommentSection sessionId={sessionId} />
    </Container>
  );
} 