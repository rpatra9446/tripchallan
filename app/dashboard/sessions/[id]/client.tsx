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
  TextField, IconButton, InputAdornment, Tooltip, Typography,
  Tabs, Tab, FormControl, InputLabel, Select, MenuItem, Grid
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

// Fix for TypeScript errors with Grid
// @ts-ignore
const Grid = Grid;

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
      
      // Set verification mode for GUARD role
      if (role === 'EMPLOYEE' && subrole === EmployeeSubrole.GUARD) {
        setVerificationMode(true);
      }
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
    if (operatorSeals && operatorSeals.length > 0) {
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
    }
    
    setSealComparison({ matched, mismatched });
  }, [operatorSeals]);
  
  // Utility function to compress images
  const compressImage = async (base64Image: string, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.src = base64Image;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Calculate size - respect aspect ratio but limit max dimensions
          const MAX_SIZE = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to webp format for better compression if supported
          const mimeType = 'image/jpeg';
          
          // Get compressed base64
          const compressedBase64 = canvas.toDataURL(mimeType, quality);
          resolve(compressedBase64);
        };
        
        img.onerror = () => {
          reject(new Error('Error loading image for compression'));
        };
      } catch (error) {
        reject(error);
      }
    });
  };
  
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