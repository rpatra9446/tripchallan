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
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  IconButton,
  Grid as MuiGrid,
  InputAdornment,
  Tooltip,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem
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
  BusinessCenter,
  RadioButtonUnchecked,
  Comment,
  ArrowForward,
  Delete,
  CloudUpload,
  Close,
  QrCode,
  InfoOutlined,
  Refresh,
  Person,
  KeyboardArrowUp,
  KeyboardArrowDown
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';
import ClientSideQrScanner from "@/app/components/ClientSideQrScanner";
import toast from "react-hot-toast";
import { processMultipleImages, resizeAndCompressImage } from "@/lib/imageUtils";
import { useTheme } from "@mui/material/styles";
import { compressImage } from "@/lib/imageUtils";


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
  verificationData?: {
    fieldVerifications?: Record<string, any>;
    guardImages?: Record<string, any>;
    sealBarcode?: string | null;
    allMatch?: boolean;
    verificationTimestamp?: string;
    // Add the missing properties
    guardScannedSeals?: Array<any>;
    sealTags?: Record<string, any>;
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
  // Direct access to seal tags from database
  sealTags?: {
    id: string;
    barcode: string;
    method: string;
    imageUrl?: string | null;
    createdAt: string;
  }[];
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
    source?: string;
    destination?: string;
    cargoType?: string;
    numberOfPackages?: string | number;
    sealTagIds?: string[] | string;
    sealTagMethods?: Record<string, string>;
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
    createdAt?: string;
    details?: {
      verification?: {
        fieldVerifications?: Record<string, any>;
        allMatch?: boolean;
      };
    };
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
     verifiedBy?: {
       id: string;
       name: string;
       email: string;
    };
  }[];
};

// For Material-UI Grid component
const Grid = MuiGrid;

// Add print styles
const printStyles = `
  @media print {
    body * {
      visibility: hidden;
    }
    .session-details-print, .session-details-print * {
      visibility: visible;
    }
    .session-details-print {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
    }
    .no-print {
      display: none !important;
    }
  }
`;

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  // Helper function to display method consistently
  const getMethodDisplay = (methodVar: string | null | undefined): string => {
    if (!methodVar) return 'Unknown';
    if (typeof methodVar !== 'string') return 'Unknown';
    return methodVar.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned';
  };
  const getMethodColor = (methodVar: string | null | undefined): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    if (!methodVar) return 'default';
    if (typeof methodVar !== 'string') return 'default';
    return methodVar.toLowerCase().includes('manual') ? 'secondary' : 'primary';
  };

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
  const [imageVerificationStatus, setImageVerificationStatus] = useState<Record<string, boolean>>({});
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  
  // Add new state for verification tabs
  const [activeTab, setActiveTab] = useState(0);
  const verificationTabs = ['Loading Details', 'Session Info', 'Seal Tags', 'Driver Details', 'Images'];
  
  // State for seal verification results tabs
  const [activeSealTab, setActiveSealTab] = useState(0);
  
  // Add new state for guard's uploaded images
  const [guardImages, setGuardImages] = useState<{
    driverPicture?: File | null;
    vehicleNumberPlatePicture?: File | null;
    gpsImeiPicture?: File | null;
    sealingImages?: File[];
    vehicleImages?: File[];
    additionalImages?: File[];
  }>({
    driverPicture: null,
    vehicleNumberPlatePicture: null,
    gpsImeiPicture: null,
    sealingImages: [],
    vehicleImages: [],
    additionalImages: []
  });

  // Add state for image previews
  const [imagePreviews, setImagePreviews] = useState<{
    driverPicture?: string;
    vehicleNumberPlatePicture?: string;
    gpsImeiPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
  }>({
    sealingImages: [],
    vehicleImages: [],
    additionalImages: []
  });
  
  // Add state for expandable rows in seal verification
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  // Add state for verification results to display matched/mismatched fields
  const [verificationResults, setVerificationResults] = useState<{
    matches: string[];
    mismatches: string[];
    unverified: string[];
    allFields: Record<string, {
      operatorValue: any;
      guardValue: any;
      matches: boolean;
      comment: string;
      isVerified: boolean;
    }>;
    timestamp: string;
  } | null>(null);
  
  // New state for seal tag verification
  const [scanInput, setScanInput] = useState('');
  const [scanMethod, setScanMethod] = useState('manual');
  const [scanError, setScanError] = useState('');
  const [guardScannedSeals, setGuardScannedSeals] = useState<Array<{
    id: string;
    method: string;
    image: File | null;
    imagePreview: string | null;
    timestamp: string;
    verified: boolean;
  }>>([]);
  const [sealComparison, setSealComparison] = useState<{
    matched: string[];
    mismatched: string[];
  }>({
    matched: [],
    mismatched: []
  });
  
  // Add new state for session seals
  const [sessionSeals, setSessionSeals] = useState<any[]>([]);
  const [loadingSeals, setLoadingSeals] = useState(false);
  const [sealsError, setSealsError] = useState("");
  
  // Add a new state for the details dialog
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Add state for image modal
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [openImageModal, setOpenImageModal] = useState(false);
  
  // Utility functions needed before other definitions
  const getFieldLabel = useCallback((key: string): string => {
    // Define custom labels for specific fields
    const customLabels: Record<string, string> = {
      'transporterName': 'Transporter Name',
      'materialName': 'Material Name',
      'vehicleNumber': 'Vehicle Number',
      'gpsImeiNumber': 'GPS/IMEI Number',
      'driverName': 'Driver Name',
      'driverContactNumber': 'Driver Contact Number',
      'loaderName': 'Loader Name',
      'challanRoyaltyNumber': 'Challan Royalty Number',
      'doNumber': 'DO Number',
      'freight': 'Freight',
      'qualityOfMaterials': 'Quality of Materials',
      'tpNumber': 'TP Number',
      'grossWeight': 'Gross Weight',
      'tareWeight': 'Tare Weight',
      'netMaterialWeight': 'Net Material Weight',
      'loaderMobileNumber': 'Loader Mobile Number',
      'loadingSite': 'Loading Site',
      'receiverPartyName': 'Receiver Party Name',
      'source': 'Source',
      'destination': 'Destination',
      'cargoType': 'Cargo Type',
      'numberOfPackages': 'Number of Packages',
      'createdById': 'Created By ID',
      'createdByName': 'Created By Name'
    };
    
    // Return custom label if exists, otherwise convert camelCase to Title Case
    return customLabels[key] || key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }, []);

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
      
      // Try both API endpoints to provide redundancy with cache-busting
      const apiUrls = [
        `/api/session/${sessionId}?nocache=${Date.now()}`,
        `/api/sessions/${sessionId}?nocache=${Date.now()}`
      ];
      
      let response;
      let errorText = '';
      
      // Try each endpoint until one works
      for (const url of apiUrls) {
        console.log(`Attempting to fetch from ${url}`);
        try {
          response = await fetch(url, {
            cache: 'no-store',
            headers: {
              'Pragma': 'no-cache',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Expires': '0'
            }
          });
          if (response.ok) {
            console.log(`Successfully fetched data from ${url}`);
            break;
          } else {
            const error = await response.text();
            errorText += `${url}: ${response.status} - ${error}\n`;
            console.error(`API Error (${response.status}) from ${url}:`, error);
          }
        } catch (err) {
          errorText += `${url}: ${err}\n`;
          console.error(`Fetch error from ${url}:`, err);
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`Failed to fetch session details: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Session data received:", data);
      
      // Fetch guard seal tags separately
      try {
        const guardSealsResponse = await fetch(`/api/sessions/${sessionId}/guardSealTags?nocache=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Expires': '0'
          }
        });
        
        if (guardSealsResponse.ok) {
          const guardSealsData = await guardSealsResponse.json();
          console.log("Guard seal tags received:", guardSealsData);
          // Add guard seal tags to session data
          data.guardSealTags = guardSealsData;
        }
      } catch (err) {
        console.error("Error fetching guard seal tags:", err);
        // Continue without guard seal tags
      }
      
      setSession(data);
    } catch (err) {
      console.error("Error fetching session details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Add useEffect to fetch session details when component mounts
  useEffect(() => {
    console.log("Component mounted, fetching session details...");
      fetchSessionDetails();
  }, [fetchSessionDetails]);

  // Add function to fetch guard seal tags
  const fetchGuardSealTags = useCallback(async () => {
    try {
      console.log("Fetching guard seal tags...");
      const response = await fetch(`/api/sessions/${sessionId}/guardSealTags?nocache=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Expires': '0'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch guard seal tags');
      }
      
      const guardSealTagsData = await response.json();
      console.log("Guard seal tags received:", guardSealTagsData);
      
      // Update session with new guard seal tags
      setSession(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          guardSealTags: guardSealTagsData
        };
      });
      
      return guardSealTagsData;
    } catch (error) {
      console.error("Error fetching guard seal tags:", error);
      toast.error("Failed to refresh seal tags");
      return [];
    }
  }, [sessionId, toast]);

  // Format field names for display
  const formatFieldName = (field: string): string => {
    return field.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };
  
  // Add useEffect to extract verification data from session when it's loaded
  useEffect(() => {
    if (session && session.status === SessionStatus.COMPLETED) {
      console.log("Extracting verification data from completed session");
      
      // Look for verification data in activity logs or seal
      let foundVerificationData = false;
      
      // First check if there are any activity logs with verification data
      if (session.activityLogs && session.activityLogs.length > 0) {
        const verificationLog = session.activityLogs.find(log => {
          const details = log.details as any;
          return details?.verification?.fieldVerifications;
        });
        
        if (verificationLog && verificationLog.details) {
          console.log("Found verification data in activity log");
          const verificationDetails = (verificationLog.details as any).verification;
          
          if (verificationDetails && verificationDetails.fieldVerifications) {
            // Process verification data
            const fieldVerifications = verificationDetails.fieldVerifications;
            
    const matches: string[] = [];
    const mismatches: string[] = [];
    const unverified: string[] = [];
            const allFields: Record<string, any> = {};
    
            // Process each field
    Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
              allFields[field] = data;
              
              if (data.isVerified) {
                if (data?.matches) {
          matches.push(field);
        } else {
          mismatches.push(field);
        }
      } else {
        unverified.push(field);
      }
    });
    
            // Set verification results
            setVerificationResults({
              matches,
              mismatches,
              unverified,
              allFields,
              timestamp: verificationDetails.verificationTimestamp || verificationLog.createdAt || new Date().toISOString()
            });
            
            foundVerificationData = true;
          }
        }
      }
      
      // If no data in activity logs, check seal verificationData
      if (!foundVerificationData && session.seal?.verificationData) {
        console.log("Found verification data in seal");
        const verificationData = session.seal.verificationData;
        
        if (verificationData.fieldVerifications) {
          // Process verification data
          const fieldVerifications = verificationData.fieldVerifications;
          
          const matches: string[] = [];
          const mismatches: string[] = [];
          const unverified: string[] = [];
          const allFields: Record<string, any> = {};
          
          // Process each field
          Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
            allFields[field] = data;
            
            if (data.isVerified) {
              if (data?.matches) {
                matches.push(field);
              } else {
                mismatches.push(field);
              }
            } else {
              unverified.push(field);
            }
          });
          
          // Set verification results
    setVerificationResults({
      matches,
      mismatches,
      unverified,
            allFields,
            timestamp: verificationData.verificationTimestamp || session.seal.scannedAt || new Date().toISOString()
          });
          
          foundVerificationData = true;
        }
      }
      
      // Check system seals for verification data if we haven't found any yet
      if (!foundVerificationData && sessionSeals && sessionSeals.length > 0) {
        console.log("Looking for verification data in session seals");
        
        // Find the first verification seal with verification details
        const verificationSeal = sessionSeals.find(seal => 
          seal.verificationDetails && seal.verificationDetails.fieldVerifications
        );
        
        if (verificationSeal && verificationSeal.verificationDetails) {
          console.log("Found verification data in session seal");
          const verificationDetails = verificationSeal.verificationDetails;
          
          if (verificationDetails.fieldVerifications) {
            // Process verification data
            const fieldVerifications = verificationDetails.fieldVerifications;
            
            const matches: string[] = [];
            const mismatches: string[] = [];
            const unverified: string[] = [];
            const allFields: Record<string, any> = {};
            
            // Process each field
            Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
              allFields[field] = data;
              
              if (data.isVerified) {
                if (data?.matches) {
                  matches.push(field);
                } else {
                  mismatches.push(field);
                }
              } else {
                unverified.push(field);
              }
            });
            
            // Set verification results
            setVerificationResults({
              matches,
              mismatches,
              unverified,
              allFields,
              timestamp: verificationDetails.verificationTimestamp || verificationSeal.scannedAt || new Date().toISOString()
            });
            
            foundVerificationData = true;
          }
        }
      }
      
      if (!foundVerificationData) {
        console.log("No verification data found for completed session");
      }
    }
  }, [session, sessionSeals]);
   
  // Extract operator seals from session data - pulling from activity logs and sessionSeals
  const operatorSeals = useMemo(() => {
    // Add debug logging
    console.log("[DEBUG] Session sealTags:", session?.sealTags);
    console.log("[DEBUG] Session images:", session?.images);
    console.log("[DEBUG] SessionSeals data:", sessionSeals);
    
    // Initialize our merged seals array
    let mergedSeals: Array<{
      id: string;
      method: string;
      image: string | null;
      imageData: string | null;
      timestamp: string;
    }> = [];
    
    // First, create a map of all seal tags from session.sealTags for method data
    const sealTagsMap = new Map<string, { method: string, timestamp: string }>();
    
    // Populate from session.sealTags (Table A - has correct Method values)
    if (session?.sealTags && session.sealTags.length > 0) {
      console.log("[DEBUG] Extracting methods from sealTags:", session.sealTags.length);
      
      session.sealTags.forEach(tag => {
        // Generate unique timestamps for each tag if they don't have their own
        const tagTimestamp = tag.createdAt || 
          // Add a slight offset to each tag's timestamp if using session.createdAt
          (session.createdAt ? new Date(new Date(session.createdAt).getTime()).toISOString() : new Date().toISOString());
          
        sealTagsMap.set(tag.barcode, {
          method: tag?.method,
          timestamp: tagTimestamp
        });
        console.log(`[DEBUG] Method for ${tag.barcode} from sealTags: ${tag?.method}, timestamp: ${tagTimestamp}`);
      });
    }
    
    // Check if verification data contains GUARD's scan of OPERATOR method
    if (session?.seal?.verificationData && 'guardScannedSeals' in (session.seal.verificationData as any)) {
      const guardScannedSeals = (session.seal.verificationData as any).guardScannedSeals;
      console.log("[DEBUG] Found guardScannedSeals in verification data:", guardScannedSeals);
      
      // Update method from guard verification if available
      guardScannedSeals.forEach((guardSeal: any) => {
        if (guardSeal.id && sealTagsMap.has(guardSeal.id)) {
          const existing = sealTagsMap.get(guardSeal.id);
          if (existing) {
            console.log(`[DEBUG] Using method from guard verification for ${guardSeal.id}: ${guardSeal?.method}`);
            if (existing && guardSeal?.method) {
              existing.method = guardSeal.method;
            }
          }
        }
      });
    }
    
    // If verification data exists, check if it has method information
    if (session?.seal?.verificationData?.sealTags) {
      const verificationSealTags = session.seal.verificationData.sealTags;
      // Update the method information from guard verification data if available
      Object.keys(verificationSealTags).forEach(key => {
        const tag = verificationSealTags[key];
        if (tag && tag.barcode && tag?.method) {
          if (sealTagsMap.has(tag.barcode)) {
            // Update the method if it exists
            const existing = sealTagsMap.get(tag.barcode);
            if (existing) {
              // Create a new object to avoid modifying the existing one directly
              sealTagsMap.set(tag.barcode, {
                ...existing,
                method: tag?.method
              });
              console.log(`[DEBUG] Updated method for ${tag.barcode} from verification data: ${tag?.method}`);
            }
          }
        }
      });
    }
    
    // Next, create a map of all seal tags from sessionSeals for image data
    const sessionSealsMap = new Map<string, string | null>();
    
    // Populate from sessionSeals (Table B - has correct Image values)
    if (sessionSeals && sessionSeals.length > 0) {
      console.log("[DEBUG] Extracting images from sessionSeals:", sessionSeals.length);
      
      const tagSeals = sessionSeals.filter(seal => seal.type === 'tag');
      tagSeals.forEach(seal => {
        sessionSealsMap.set(seal.barcode, seal?.imageData || null);
        console.log(`[DEBUG] Image for ${seal.barcode} from sessionSeals: ${seal?.imageData ? 'present' : 'null'}`);
      });
    }
    
    // Now merge the data - Start with sealTags as primary source
    if (sealTagsMap.size > 0) {
      console.log("[DEBUG] Merging data from sealTags and sessionSeals");
      
      sealTagsMap.forEach((data, barcode) => {
        mergedSeals.push({
          id: barcode,
          method: data?.method, // From Table A
          image: sessionSealsMap.get(barcode) || null, // From Table B
          imageData: sessionSealsMap.get(barcode) || null, // From Table B
          timestamp: data.timestamp
        });
      });
      
      console.log(`[DEBUG] Merged ${mergedSeals.length} seals from sealTags`);
    } 
    // If no sealTags, use sessionSeals
    else if (sessionSeals && sessionSeals.length > 0) {
      console.log("[DEBUG] Using sessionSeals as primary source");
      
      const tagSeals = sessionSeals.filter(seal => seal.type === 'tag');
      
      if (tagSeals.length > 0) {
        console.log("[DEBUG] Found tag seals in sessionSeals:", tagSeals.length);
        
        mergedSeals = tagSeals.map((seal, index) => {
          let imageUrl = seal?.imageData || null;
          
          // For debug only
          console.log(`[DEBUG] Using seal from sessionSeals: ${seal.barcode}, method: ${seal?.method}`);
          
          // Use seal's createdAt if available, or create a unique timestamp with offset
          const uniqueTimestamp = seal.createdAt || 
            (session?.createdAt ? 
              new Date(new Date(session.createdAt).getTime() + (index * 1000)).toISOString() : 
              new Date(Date.now() + (index * 1000)).toISOString());
          
          return {
            id: seal.barcode,
            method: seal?.method, // Use method from sessionSeals if sealTags isn't available
            image: imageUrl,
            imageData: imageUrl,
            timestamp: uniqueTimestamp
          };
        });
      }
    }
    
    // Fallback to tripDetails if we still have no seals
    if (mergedSeals.length === 0 && session?.tripDetails?.sealTagIds) {
      console.log("[DEBUG] Using sealTagIds from tripDetails");
      
      const sealTagIds = Array.isArray(session.tripDetails.sealTagIds) 
        ? session.tripDetails.sealTagIds 
        : [session.tripDetails.sealTagIds];
      
      const sealTagMethods = session.tripDetails.sealTagMethods || {};
      
      // Check if we have any sealing images to use
      const hasImages = session?.images?.sealingImages && session.images.sealingImages.length > 0;
      
      mergedSeals = sealTagIds.map((id, index) => {
        // Try to get an image for this tag
        let imageUrl = null;
        if (hasImages && session?.images?.sealingImages) {
          imageUrl = session.images.sealingImages[index % session.images.sealingImages.length];
        }
        
        // Create a unique timestamp for each seal tag by adding a slight offset (index * 1 second)
        const uniqueTimestamp = session?.createdAt ? 
          new Date(new Date(session.createdAt).getTime() + (index * 1000)).toISOString() : 
          new Date(Date.now() + (index * 1000)).toISOString();
        
        return {
            id,
          method: sealTagMethods[id] || 'manually entered', // Default to manually entered if no method provided
          image: imageUrl,
          imageData: imageUrl,
          timestamp: uniqueTimestamp
        };
        });
    }
    
    // Log the final result
    console.log(`[DEBUG] Final merged seals count: ${mergedSeals.length}`);
    mergedSeals.forEach(seal => {
      console.log(`[DEBUG] Final seal ${seal.id}, method: ${seal?.method}, has image: ${seal.image ? 'yes' : 'no'}`);
    });
    
    return mergedSeals;
  }, [session, sessionSeals]);

  // Update seal comparison data
  const updateSealComparison = useCallback((scannedSeals: any[]) => {
    const guardSealIds = scannedSeals.map(seal => seal.id.trim());
    const operatorSealIds = operatorSeals.map(seal => seal.id.trim());
    
    console.log('Guard Seal IDs:', guardSealIds);
    console.log('Operator Seal IDs:', operatorSealIds);
    
    // Use normalized strings for comparison (trim and lowercase)
    const matched = guardSealIds.filter(id => 
      operatorSealIds.some(opId => opId.toLowerCase() === id.toLowerCase())
    );
    
    const mismatched = guardSealIds.filter(id => 
      !operatorSealIds.some(opId => opId.toLowerCase() === id.toLowerCase())
    );
    
    console.log('Matched Seal IDs:', matched);
    console.log('Mismatched Seal IDs:', mismatched);
    
    setSealComparison({ matched, mismatched });


  // Update seal comparison when operator seals or guard scanned seals change
  useEffect(() => {
    if (operatorSeals.length > 0 || guardScannedSeals.length > 0) {
      updateSealComparison(guardScannedSeals);
    }
  }, [operatorSeals, guardScannedSeals, updateSealComparison]);

  }, [operatorSeals]);

  // Input handlers
  const handleInputChange = useCallback((field: string, value: any) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        guardValue: value
      }
    }));
  }, []);

  const handleCommentChange = useCallback((field: string, comment: string) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        comment
      }
    }));
  }, []);

  // Handle field verification state toggle
  const verifyField = (field: string) => {
    setVerificationFields(prev => {
      const updatedFields = { ...prev };
      updatedFields[field] = {
        ...updatedFields[field],
        isVerified: !updatedFields[field].isVerified
      };
      return updatedFields;
    });
  };

  // The handleScanComplete function is moved below after the compressImage function to avoid reference errors

  // Handle image upload for a seal
  const handleSealImageUpload = useCallback(async (index: number, file: File | null) => {
    if (!file) return;
    
    const updatedSeals = [...guardScannedSeals];
    updatedSeals[index].image = file;
    
    // Don't create blob URLs anymore - read the file and upload to server directly
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      
      try {
        // Get the seal ID
        const sealId = updatedSeals[index].id;
        
        // Compress image if it's too large
        let compressedImageData = base64Image;
        if (base64Image.length > 1000000) { // 1MB
          console.log('Image is large, compressing...');
          compressedImageData = await compressImage(base64Image, 0.6); // Compress to 60% quality
          console.log(`Compressed image from ${base64Image.length} to ${compressedImageData.length} bytes`);
        }
                              
        // Upload the guard seal tag directly to the server - use relative URL to work in all environments
        const apiUrl = `/api/sessions/${sessionId}/guardSealTags`;
        console.log('Posting to API URL:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            barcode: sealId,
            method: updatedSeals[index].method || 'manual',
            imageData: compressedImageData
          }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save guard seal tag');
        }
        
        const savedTag = await response.json();
        console.log('Guard seal tag saved:', savedTag);
        
        // Refresh the guard seal tags from the server
        fetchGuardSealTags();
        toast.success(`Seal tag image uploaded successfully!`);
      } catch (error) {
        console.error('Error saving guard seal tag:', error);
        toast.error('Failed to upload seal tag image. Please try again.');
      }
    };
    reader.readAsDataURL(file);
    
    // Update the state with null preview (we'll load from server)
    updatedSeals[index].imagePreview = null;
    setGuardScannedSeals(updatedSeals);
  }, [guardScannedSeals, sessionId, fetchGuardSealTags]);

  // Remove a scanned seal
  const removeSealTag = useCallback((index: number) => {
    const updatedSeals = [...guardScannedSeals];
    
    // Revoke object URL if exists to prevent memory leaks
    if (updatedSeals[index].imagePreview) {
      URL.revokeObjectURL(updatedSeals[index].imagePreview as string);
    }
    
    updatedSeals.splice(index, 1);
    setGuardScannedSeals(updatedSeals);
    
    // Update comparison
    updateSealComparison(updatedSeals);
  }, [guardScannedSeals, updateSealComparison]);
  
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
  
  // Check if the session can be verified - only using operator-entered seal tags
  const canVerify = useMemo(() => {
    console.log("Calculating canVerify:");
    console.log("- isGuard:", isGuard);
    console.log("- session status:", session?.status);
    console.log("- operator seals:", operatorSeals?.length || 0);
    
    // For debugging: log the raw values
    console.log("- userRole:", userRole);
    console.log("- userSubrole:", userSubrole);
    console.log("- EmployeeSubrole.GUARD:", EmployeeSubrole.GUARD);
    
    return isGuard && 
      session?.status === SessionStatus.IN_PROGRESS && 
      (operatorSeals.length > 0 || session?.seal?.barcode);
  }, [isGuard, session, operatorSeals]);
  
  // Check if user has edit permission
  useEffect(() => {
    // Only OPERATOR users with canModify permission can edit
    if (userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.OPERATOR && authSession?.user?.id) {
      fetch(`/api/employees/${authSession.user.id}/permissions`)
        .then(response => response.json())
        .then(data => {
          setCanEdit(data.canModify || false);
        })
        .catch(error => {
          console.error("Error checking edit permission:", error);
          setCanEdit(false);
        });
    } else {
      setCanEdit(false);
    }
  }, [userRole, userSubrole, authSession?.user?.id]);

  useEffect(() => {
    // Initialize verification fields when session data is loaded
    if (session && isGuard) {
      const fields: {[key: string]: any} = {};
      
      // Add trip details fields for verification
      if (session.tripDetails) {
        Object.entries(session.tripDetails).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            fields[key] = {
              operatorValue: value,
              guardValue: '',
              comment: '',
              isVerified: false
            };
          }
        });
      }
      
      // Add system fields like createdBy
      if (session.createdBy) {
        fields['createdById'] = {
          operatorValue: session.createdBy.id,
          guardValue: '',
          comment: '',
          isVerified: false
        };
        
        fields['createdByName'] = {
          operatorValue: session.createdBy.name,
          guardValue: '',
          comment: '',
          isVerified: false
        };
      }
      
      // Ensure source and destination are added from either tripDetails or session
      if (session.source && !fields['source']) {
        fields['source'] = {
          operatorValue: session.source,
          guardValue: '',
          comment: '',
          isVerified: false
        };
      }
      
      if (session.destination && !fields['destination']) {
        fields['destination'] = {
          operatorValue: session.destination,
          guardValue: '',
          comment: '',
          isVerified: false
        };
      }
      
      // Make sure driver contact number is included
      if (session.tripDetails?.driverContactNumber && !fields['driverContactNumber']) {
        fields['driverContactNumber'] = {
          operatorValue: session.tripDetails.driverContactNumber,
          guardValue: '',
          comment: '',
          isVerified: false
        };
      }
      
      setVerificationFields(fields);
      
      // Initialize image verification status
      const imageStatus: {[key: string]: boolean} = {};
      if (session.images) {
        if (session.images.driverPicture) imageStatus['driverPicture'] = false;
        if (session.images.vehicleNumberPlatePicture) imageStatus['vehicleNumberPlatePicture'] = false;
        if (session.images.gpsImeiPicture) imageStatus['gpsImeiPicture'] = false;
        if (session.images.sealingImages?.length) imageStatus['sealingImages'] = false;
        if (session.images.vehicleImages?.length) imageStatus['vehicleImages'] = false;
        if (session.images.additionalImages?.length) imageStatus['additionalImages'] = false;
      }
      
      setImageVerificationStatus(imageStatus);
    }
  }, [session, isGuard]);

  // Calculate verification progress
  useEffect(() => {
    if (Object.keys(verificationFields).length === 0) return;
    
    const verified = Object.values(verificationFields).filter(f => f.isVerified).length;
    const total = Object.keys(verificationFields).length;
    
    const imagesVerified = Object.values(imageVerificationStatus).filter(status => status).length;
    const totalImages = Object.keys(imageVerificationStatus).length;
    
    // Add 1 for seal verification at the end
    const progress = Math.round(
      ((verified + imagesVerified) / (total + totalImages + 1)) * 100
    );
    
    setVerificationProgress(progress);
  }, [verificationFields, imageVerificationStatus]);

  // Add useEffect to get user role and subrole when auth session is available
  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user?.id) {
      // Fetch user role and subrole
      console.log("Fetching user role for user ID:", authSession.user.id);
      
      // First try to use the role directly from the auth session if available
      if (authSession.user.role) {
        console.log("Using role from auth session:", authSession.user.role);
        setUserRole(authSession.user.role);
        
        // Also set subrole if available
        if (authSession.user.subrole) {
          console.log("Using subrole from auth session:", authSession.user.subrole);
          setUserSubrole(authSession.user.subrole);
        }
      }
      
      // Always fetch from API as well to ensure we have the latest data
      fetch(`/api/users/${authSession.user.id}/role`)
        .then(response => {
          console.log("Role API response status:", response.status);
          if (!response.ok) {
            throw new Error(`Failed to fetch role: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("User role data received:", data);
          setUserRole(data.role || "");
          setUserSubrole(data.subrole || "");
          
          // Log if this is a guard for debugging
          const isThisGuard = data.role === "EMPLOYEE" && data.subrole === EmployeeSubrole.GUARD;
          console.log("Is this user a GUARD?", isThisGuard);
          console.log("EmployeeSubrole.GUARD value:", EmployeeSubrole.GUARD);
          
          // Check if operator seals exist
          console.log("Operator seals count:", operatorSeals.length);
          console.log("Session status:", session?.status);
          
          // Calculate canVerify manually for debugging
          const shouldCanVerify = isThisGuard && 
            session?.status === SessionStatus.IN_PROGRESS && 
            (operatorSeals.length > 0 || session?.seal?.barcode);
          console.log("Should canVerify be true?", shouldCanVerify);
        })
        .catch(error => {
          console.error("Error fetching user role:", error);
        });
    } else if (authStatus === "unauthenticated") {
      console.log("User is not authenticated");
      setUserRole("");
      setUserSubrole("");
    }
  }, [authStatus, authSession?.user?.id, session, operatorSeals]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };


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


  const getStatusColor = (status: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'in_transit':
      case 'in transit':
        return 'primary';
      case 'pending':
        return 'warning';
      case 'cancelled':
        return 'error';
      case 'verified':
        return 'info';
      default:
        return 'default';
    }
  };

  const startVerification = () => {
    setVerificationFormOpen(true);
    setVerificationStep(0);
  };
  
  // Handle image verification status toggle
  const verifyImage = (imageKey: string) => {
    setImageVerificationStatus(prev => ({
      ...prev,
      [imageKey]: !prev[imageKey]
    }));
  };
  
  const verifyAllFields = () => {
    // Mark all fields as verified
    const updatedFields = {...verificationFields};
    Object.keys(updatedFields).forEach(field => {
      updatedFields[field].isVerified = true;
    });
    setVerificationFields(updatedFields);
    
    // Move to image verification
    setVerificationStep(1);
  };
  
  // Calculate verification statistics
  const getVerificationStats = () => {
    // Field verification stats
    const fieldStats = {
      verified: Object.values(verificationFields).filter(field => field.isVerified).length,
      matched: Object.values(verificationFields).filter(field => 
        field.isVerified && field.operatorValue === field.guardValue
      ).length,
      mismatched: Object.values(verificationFields).filter(field => 
        field.isVerified && field.operatorValue !== field.guardValue
      ).length,
      total: Object.keys(verificationFields).length
    };

    // Image verification stats
    const imageStats = {
      verified: Object.values(imageVerificationStatus).filter(status => status).length,
      total: Object.keys(imageVerificationStatus).length
    };

    // Combined stats for summary display
    const total = fieldStats.total + imageStats.total;
    const verified = fieldStats.verified + imageStats.verified;

    return {
      fieldStats,
      imageStats,
      total,
      verified
    };
  };
  
  // Modified version of handleVerifySeal to allow completion without a seal barcode
  const handleVerifySeal = async () => {
    try {
    setVerifying(true);
      setError(""); // Clear any previous error
      
      // Upload any guard images that were provided
      const uploadedImageUrls: Record<string, any> = {};
      
      // Process the scanned seal tags and convert to proper format
      const processedGuardSealTags = guardScannedSeals.map(seal => {
        // Prepare the data for the database
        return {
          id: seal.id,
          method: seal?.method,
          imageUrl: seal.imagePreview, // Use the preview URL
          verified: seal.verified
        };
      });
      
      // Add the processed seal tags to the uploadedImageUrls
      uploadedImageUrls.sealTags = processedGuardSealTags;
      
      // Add any other guard images that were provided
      for (const [key, value] of Object.entries(guardImages)) {
        if (key !== 'sealingImages' && key !== 'vehicleImages' && key !== 'additionalImages') {
          if (value && imagePreviews[key as PreviewImageKey]) {
            uploadedImageUrls[key] = imagePreviews[key as PreviewImageKey];
          }
        }
      }
      
      // Handle array image types (sealingImages, vehicleImages, additionalImages)
      ['sealingImages', 'vehicleImages', 'additionalImages'].forEach(imageType => {
        const imagesArray = guardImages[imageType as GuardImageKey] as File[] | undefined;
        const previewsArray = imagePreviews[imageType as PreviewImageKey] as string[] | undefined;
        
        if (imagesArray && imagesArray.length > 0 && previewsArray && previewsArray.length > 0) {
          uploadedImageUrls[imageType] = previewsArray;
        }
      });
      
      // Calculate verification results for each field
      const fieldVerificationResults = Object.entries(verificationFields).reduce(
        (results, [field, data]) => {
            results[field] = {
              operatorValue: data.operatorValue,
            guardValue: data.operatorValue, // Use operator value as the guard value
            matches: true, // Always match since we're just verifying
              comment: data.comment,
            isVerified: data.isVerified
          };
          return results;
        },
        {} as Record<string, any>
      );
      
      // If session has a seal, update it, otherwise create a new one
      let response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          if (session?.seal?.id) {
            response = await fetch("/api/seals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          sealId: session.seal.id,
          verificationData: {
            fieldVerifications: fieldVerificationResults,
            guardImages: uploadedImageUrls,
            sealBarcode: sealInput || null,
                allMatch: true, // Always match since we're just verifying
            verificationTimestamp: new Date().toISOString()
          }
        }),
      });
          } else if (session) {
            // Create a new seal for this session
            response = await fetch("/api/seals", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                sessionId: session.id,
                verificationData: {
                  fieldVerifications: fieldVerificationResults,
                  guardImages: uploadedImageUrls,
                  sealBarcode: sealInput || null,
                  allMatch: true, // Always match since we're just verifying
                  verificationTimestamp: new Date().toISOString()
                }
              }),
            });
          }
          
          // If we got a response, break out of the retry loop
          if (response) break;
        } catch (fetchError) {
          console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
          // If this was our last retry, throw the error to be caught by the outer try/catch
          if (retryCount === maxRetries) throw fetchError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }
      
      if (!response) {
        throw new Error("Failed to connect to the server after multiple attempts");
      }
      
      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse response JSON:", jsonError);
      }
      
      if (!response.ok) {
        // Check if we have detailed error information
        const errorMessage = responseData?.error || 
          `Server returned error (${response.status}): ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      // Success! Update the UI
      setVerificationSuccess(true);
      setVerificationFormOpen(false);
      
      // If email sending succeeded, show a toast notification
      if (responseData && responseData.emailSent === true) {
        toast.success("Verification report email sent to company", {
          duration: 5000,
          icon: '📧'
        });
      }
      // If email sending failed but verification succeeded, show a warning
      else if (responseData && responseData.emailSent === false) {
        console.warn("Verification completed but email notification failed:", responseData.emailError);
        if (responseData.emailError) {
          toast.error(`Email notification failed: ${responseData.emailError}`, {
            duration: 4000
          });
        }
      }
      
      // Save verification results for displaying matched/mismatched fields
      const matches = Object.entries(fieldVerificationResults)
        .filter(([_, data]) => data?.matches && data.isVerified)
        .map(([field, _]) => field);
        
      const mismatches = Object.entries(fieldVerificationResults)
        .filter(([_, data]) => !data?.matches && data.isVerified)
        .map(([field, _]) => field);
      
      const unverified = Object.entries(fieldVerificationResults)
        .filter(([_, data]) => !data.isVerified)
        .map(([field, _]) => field);
        
      // Set state for displaying verification results
      setVerificationResults({
        matches,
        mismatches,
        unverified,
        allFields: fieldVerificationResults,
        timestamp: new Date().toISOString()
      });
      
      // Reload session data to update status
      setTimeout(() => {
      fetchSessionDetails();
      }, 1000);
    } catch (err) {
      console.error("Error verifying seal:", err);
      setError(err instanceof Error ? err.message : "Failed to verify seal");
    } finally {
      setVerifying(false);
      setConfirmDialogOpen(false);
    }
  };
  
  const openConfirmDialog = () => {
    setConfirmDialogOpen(true);
  };
  
  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  // Handle file uploads
  // Define type-safe image type keys
  type GuardImageKey = keyof typeof guardImages;
  type PreviewImageKey = keyof typeof imagePreviews;
  
  const handleImageUpload = async (imageType: string, file: File | FileList | null) => {
    if (!file) return;

    try {
      // Type assertion to ensure type safety
      const imageTypeKey = imageType as GuardImageKey;
      const previewTypeKey = imageType as PreviewImageKey;

    // Handle single file uploads
    if (file instanceof File) {
        const processedFile = await resizeAndCompressImage(file, 800, 800, 0.6, 2);
        
      setGuardImages(prev => ({
        ...prev,
          [imageTypeKey]: processedFile
      }));
      
      // Create preview URL
        const previewUrl = URL.createObjectURL(processedFile);
      setImagePreviews(prev => ({
        ...prev,
          [previewTypeKey]: previewUrl
      }));
      
      // Mark as "verified" for progress tracking
      setImageVerificationStatus(prev => ({
        ...prev,
        [imageType]: true
      }));
    } 
    // Handle multiple file uploads
    else if (file instanceof FileList) {
      const fileArray = Array.from(file);
        
        // For vehicle images, enforce a maximum of 10 images
        if (imageType === 'vehicleImages') {
          const currentImages = (guardImages[imageTypeKey] as File[] | undefined) || [];
          const currentCount = currentImages.length;
          const maxNewImages = Math.max(0, 10 - currentCount);
          
          if (maxNewImages <= 0) {
            toast.error("Maximum of 10 vehicle images allowed");
            return;
          }
          
          if (fileArray.length > maxNewImages) {
            toast("Only " + maxNewImages + " more image(s) can be added (maximum 10 total)", {
              icon: '⚠️'
            });
          }
          
          // Process and compress the allowed number of images
          const limitedFiles = fileArray.slice(0, maxNewImages);
          const processedFiles = await processMultipleImages(limitedFiles, maxNewImages, 2);
      
      setGuardImages(prev => ({
        ...prev,
            [imageTypeKey]: [...((prev[imageTypeKey] as File[] | undefined) || []), ...processedFiles]
      }));
      
      // Create preview URLs
          const previewUrls = processedFiles.map(f => URL.createObjectURL(f));
      setImagePreviews(prev => ({
        ...prev,
            [previewTypeKey]: [...((prev[previewTypeKey] as string[] | undefined) || []), ...previewUrls]
          }));
        } else {
          // For other image types, still compress but without the strict limit
          const processedFiles = await processMultipleImages(fileArray);
          
          setGuardImages(prev => ({
            ...prev,
            [imageTypeKey]: [...((prev[imageTypeKey] as File[] | undefined) || []), ...processedFiles]
          }));
          
          // Create preview URLs
          const previewUrls = processedFiles.map(f => URL.createObjectURL(f));
          setImagePreviews(prev => ({
            ...prev,
            [previewTypeKey]: [...((prev[previewTypeKey] as string[] | undefined) || []), ...previewUrls]
      }));
        }
      
      // Mark as "verified" for progress tracking
      setImageVerificationStatus(prev => ({
        ...prev,
        [imageType]: true
      }));
      }
    } catch (error) {
      console.error("Error processing images:", error);
      toast.error("Failed to process images. Please try with smaller images.");
    }
  };

  // Remove uploaded image
  const removeUploadedImage = (imageType: string, index?: number) => {
    // For single images
    if (index === undefined) {
      setGuardImages(prev => ({
        ...prev,
        [imageType]: null
      }));
      
      // Revoke preview URL to prevent memory leaks
      if (imagePreviews[imageType as keyof typeof imagePreviews]) {
        URL.revokeObjectURL(imagePreviews[imageType as keyof typeof imagePreviews] as string);
      }
      
      setImagePreviews(prev => ({
        ...prev,
        [imageType]: undefined
      }));
      
      // Update verification status
      setImageVerificationStatus(prev => ({
        ...prev,
        [imageType]: false
      }));
    } 
    // For multiple images
    else if (typeof index === 'number') {
      const currentFiles = guardImages[imageType as keyof typeof guardImages] as File[] || [];
      const currentPreviews = imagePreviews[imageType as keyof typeof imagePreviews] as string[] || [];
      
      // Revoke preview URL
      if (currentPreviews[index]) {
        URL.revokeObjectURL(currentPreviews[index]);
      }
      
      // Remove file and preview
      const newFiles = [...currentFiles];
      newFiles.splice(index, 1);
      
      const newPreviews = [...currentPreviews];
      newPreviews.splice(index, 1);
      
      setGuardImages(prev => ({
        ...prev,
        [imageType]: newFiles
      }));
      
      setImagePreviews(prev => ({
        ...prev,
        [imageType]: newPreviews
      }));
      
      // Update verification status if all images are removed
      if (newFiles.length === 0) {
        setImageVerificationStatus(prev => ({
          ...prev,
          [imageType]: false
        }));
      }
    }
  };

  // Verification Form Step 1: Trip Details Verification
  const renderTripDetailsVerification = () => {
    if (!session || !session.tripDetails) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No trip details available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Loading Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the loading details by comparing physical documents and vehicle information.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'transporterName', 'materialName', 'receiverPartyName', 'vehicleNumber',
                  'registrationCertificate', 'gpsImeiNumber', 'cargoType', 'loadingSite',
                  'loaderName', 'challanRoyaltyNumber', 'doNumber', 'freight',
                  'qualityOfMaterials', 'numberOfPackages', 'tpNumber', 'grossWeight',
                  'tareWeight', 'netMaterialWeight', 'loaderMobileNumber'
                ].includes(field))
                .map(([field, data]) => (
                <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {getFieldLabel(field)}
                  </TableCell>
                  <TableCell>
                      {data.operatorValue}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="center">
                        <IconButton 
                          onClick={() => verifyField(field)}
                          color={data.isVerified ? "success" : "default"} size="small"
                        >
                          {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                        </IconButton>
                    <TextField 
                      size="small"
                          placeholder="Add comment"
                          value={data.comment}
                          onChange={(e) => handleCommentChange(field, e.target.value)}
                          variant="standard"
                          sx={{ mt: 1, width: '100%' }}
                          InputProps={{
                            endAdornment: data.comment ? (
                              <InputAdornment position="end">
                                <IconButton 
                                  onClick={() => handleCommentChange(field, '')}
                                  edge="end"
                                  size="small" 
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Session Information Verification
  const renderSessionInfoVerification = () => {
    if (!session) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No session information available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Session Information Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the session information details by comparing with the operator.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'createdById', 'createdByName', 'source', 'destination'
                ].includes(field))
                .map(([field, data]) => (
                <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {getFieldLabel(field)}
                  </TableCell>
                  <TableCell>
                      {data.operatorValue}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="center">
                        <IconButton 
                          onClick={() => verifyField(field)}
                          color={data.isVerified ? "success" : "default"} size="small"
                        >
                          {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                        </IconButton>
                    <TextField 
                      size="small"
                          placeholder="Add comment"
                          value={data.comment}
                          onChange={(e) => handleCommentChange(field, e.target.value)}
                          variant="standard"
                          sx={{ mt: 1, width: '100%' }}
                          InputProps={{
                            endAdornment: data.comment ? (
                              <InputAdornment position="end">
                                <IconButton 
                                  onClick={() => handleCommentChange(field, '')}
                                  edge="end"
                                  size="small" 
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Driver Details Verification
  const renderDriverDetailsVerification = () => {
    if (!session || !session.tripDetails) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No driver details available for verification.
                      </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Driver Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the driver's details and documents. Cross-check with physical license and identification.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'driverName', 'driverMobileNumber', 'driverContactNumber', 'driverLicenseNumber',
                  'driverLicenseExpiryDate', 'driverAddress', 'driverExperience'
                ].includes(field))
                .map(([field, data]) => (
                  <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">
                      {getFieldLabel(field)}
                    </TableCell>
                    <TableCell>
                      {data.operatorValue}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" flexDirection="column" alignItems="center">
                      <IconButton 
                        onClick={() => verifyField(field)}
                          color={data.isVerified ? "success" : "default"} size="small"
                      >
                          {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                      </IconButton>
                        <TextField
                          size="small"
                          placeholder="Add comment"
                          value={data.comment}
                          onChange={(e) => handleCommentChange(field, e.target.value)}
                          variant="standard"
                          sx={{ mt: 1, width: '100%' }}
                          InputProps={{
                            endAdornment: data.comment ? (
                              <InputAdornment position="end">
                      <IconButton 
                                  onClick={() => handleCommentChange(field, '')}
                                  edge="end"
                        size="small" 
                                >
                                  <Close fontSize="small" />
                      </IconButton>
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Driver's photo verification */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Driver's Photo Verification
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Original driver photo */}
            {session.images?.driverPicture && (
              <Box sx={{ width: '150px' }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Driver photo:
                </Typography>
                <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden' }}>
                  <img 
                    src={session.images.driverPicture} 
                    alt="Driver" 
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </Box>
                    </Box>
            )}
            
            {/* Verification radio button and comment */}
            <Box sx={{ flex: 1 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('driverPicture')}
                  color={imageVerificationStatus.driverPicture ? "success" : "default"} size="small"
                >
                  {imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.driverPicture || ''}
                onChange={(e) => handleImageCommentChange('driverPicture', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
            </Box>
                    </Box>
        </Box>
                    </Box>
    );
  };

  // Verification Form Step 2: Image Upload (formerly Image Verification)
  const renderImageVerification = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Image Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the images taken by the operator at source.
        </Typography>

        {/* Driver's Photo Verification */}
        {session?.images?.driverPicture && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Driver's Photo
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: '150px' }}>
                <img 
                  src={session.images.driverPicture} 
                  alt="Driver" 
                  style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box display="flex" alignItems="center">
                  <IconButton 
                    onClick={() => verifyImage('driverPicture')}
                    color={imageVerificationStatus.driverPicture ? "success" : "default"} size="small"
                  >
                    {imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add comment"
                  value={imageComments.driverPicture || ''}
                  onChange={(e) => handleImageCommentChange('driverPicture', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* Vehicle Number Plate Verification */}
        {session?.images?.vehicleNumberPlatePicture && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Vehicle Number Plate
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: '150px' }}>
                <img 
                  src={session.images.vehicleNumberPlatePicture} 
                  alt="Vehicle Number Plate" 
                  style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box display="flex" alignItems="center">
                  <IconButton 
                    onClick={() => verifyImage('vehicleNumberPlatePicture')}
                    color={imageVerificationStatus.vehicleNumberPlatePicture ? "success" : "default"} size="small"
                  >
                    {imageVerificationStatus.vehicleNumberPlatePicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add comment"
                  value={imageComments.vehicleNumberPlatePicture || ''}
                  onChange={(e) => handleImageCommentChange('vehicleNumberPlatePicture', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* GPS IMEI Verification */}
        {session?.images?.gpsImeiPicture && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              GPS IMEI
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: '150px' }}>
                <img 
                  src={session.images.gpsImeiPicture} 
                  alt="GPS IMEI" 
                  style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box display="flex" alignItems="center">
                  <IconButton 
                    onClick={() => verifyImage('gpsImeiPicture')}
                    color={imageVerificationStatus.gpsImeiPicture ? "success" : "default"} size="small"
                  >
                    {imageVerificationStatus.gpsImeiPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add comment"
                  value={imageComments.gpsImeiPicture || ''}
                  onChange={(e) => handleImageCommentChange('gpsImeiPicture', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* Sealing Images Verification */}
        {session?.images?.sealingImages && session.images.sealingImages.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Sealing Images
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('sealingImages')}
                  color={imageVerificationStatus.sealingImages ? "success" : "default"} size="small"
                >
                  {imageVerificationStatus.sealingImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark all sealing images as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.sealingImages || ''}
                onChange={(e) => handleImageCommentChange('sealingImages', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
              />
          </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.sealingImages.map((image, index) => (
                <Box key={`sealing-${index}`} sx={{ width: '150px' }}>
                  <img 
                    src={image} 
                    alt={`Sealing ${index + 1 || "Unknown"}`} 
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* Vehicle Images Verification */}
        {session?.images?.vehicleImages && session.images.vehicleImages.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Vehicle Images
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                      <IconButton 
                  onClick={() => verifyImage('vehicleImages')}
                  color={imageVerificationStatus.vehicleImages ? "success" : "default"} size="small"
                      >
                  {imageVerificationStatus.vehicleImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                      </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark all vehicle images as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.vehicleImages || ''}
                onChange={(e) => handleImageCommentChange('vehicleImages', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.vehicleImages.map((image, index) => (
                <Box key={`vehicle-${index}`} sx={{ width: '150px' }}>
                  <img 
                    src={image} 
                    alt={`Vehicle ${index + 1 || "Unknown"}`} 
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                    </Box>
                  ))}
                </Box>
          </Paper>
        )}

        {/* Additional Images Verification */}
        {session?.images?.additionalImages && session.images.additionalImages.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Additional Images
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('additionalImages')}
                  color={imageVerificationStatus.additionalImages ? "success" : "default"} size="small"
                >
                  {imageVerificationStatus.additionalImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark all additional images as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.additionalImages || ''}
                onChange={(e) => handleImageCommentChange('additionalImages', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.additionalImages.map((image, index) => (
                <Box key={`additional-${index}`} sx={{ width: '150px' }}>
                  <img 
                    src={image} 
                    alt={`Additional ${index + 1 || "Unknown"}`} 
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
          </Box>
              ))}
        </Box>
          </Paper>
        )}
      </Box>
    );
  };

  // Seal Verification Component
  const renderSealVerification = () => {
    if (!session) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Loading session data...
          </Typography>
        </Box>
      );
    }

    // Check if no operator seals or QR codes are available
    if (operatorSeals.length === 0 && 
        (!session.qrCodes || (!session.qrCodes.primaryBarcode && 
         (!session.qrCodes.additionalBarcodes || session.qrCodes.additionalBarcodes.length === 0)))) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No seal tag information available for verification. This session may have been created before seal tag scanning was implemented.
          </Typography>
        </Box>
      );
    }

    // Use expanded rows state from the component
    const toggleRowExpansion = (sealId: string) => {
      setExpandedRows(prev => ({
        ...prev,
        [sealId]: !prev[sealId]
      }));
    };

    // Create merged list of all seals (operator and guard)
    const allSealIds = [...new Set([
      ...operatorSeals.map(seal => seal.id),
      ...guardScannedSeals.map(seal => seal.id)
    ])];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>

        {/* Seal Scanner Section */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Scan Seal Tags
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="scan-method-label">Select Method:</InputLabel>
                  <Select
                    labelId="scan-method-label"
                    value={scanMethod}
                    label="Select Method:"
                    onChange={(e) => setScanMethod(e.target.value as 'manual' | 'digital')}
                  >
                    <MenuItem value="manual">Manual Entry</MenuItem>
                    <MenuItem value="digital">Digital Scan</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Seal Tag ID"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  error={!!scanError}
                  helperText={scanError}
                />
                
                <Button 
                  variant="contained" 
                  onClick={() => {
                    // Set method to manual since user is manually entering data
                    handleScanComplete(scanInput, 'manual');
                  }}
                  disabled={!scanInput.trim()}
                >
                  Add Manually
                </Button>
                
                <ClientSideQrScanner
                  onScanWithImage={(data, imageFile) => {
                    const trimmedData = data.trim();
                    
                    // Check if already scanned by guard (case insensitive)
                    if (guardScannedSeals.some(seal => seal.id.toLowerCase() === trimmedData.toLowerCase())) {
                      setScanError('This seal has already been scanned');
                      setTimeout(() => setScanError(''), 3000);
                      return;
                    }
                    
                    // Check if this seal matches an operator seal (case insensitive)
                    const isVerified = operatorSeals.some(seal => 
                      seal.id.trim().toLowerCase() === trimmedData.toLowerCase()
                    );
                    
                    console.log('Scanning seal ID (QR):', trimmedData);
                    console.log('Operator seals:', operatorSeals.map(s => s.id));
                    console.log('Is verified:', isVerified);
                    
                    // Pass method as digital and imageFile to handleScanComplete
                    handleScanComplete(trimmedData, 'digital', imageFile);
                  }}
                  buttonText="Scan QR/Barcode"
                  scannerTitle="Scan Seal Tag"
                  buttonVariant="contained"
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Seal Verification Summary */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: 2, 
            mb: 3, 
            position: 'sticky', 
            top: 0, 
            zIndex: 10,
            bgcolor: 'background.paper',
            borderLeft: '4px solid',
            borderColor: sealComparison.mismatched.length > 0 ? 'warning.main' : 'success.main' 
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            {/* Progress stats */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                Verification Progress:
                </Typography>
                        <Chip
                            label={`${sealComparison.matched.length}/${operatorSeals.length} Verified`}
                            color={sealComparison.matched.length === operatorSeals.length ? "success" : "primary"} size="small"
                          />
                          </Box>
            
            {/* Status indicators */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip 
                icon={<CheckCircle fontSize="small" />}
                label={`${sealComparison.matched.length} Matched`}
                color="success" 
                            variant="outlined"
                            size="small" />
              {operatorSeals.length - sealComparison.matched.length > 0 && (
                <Chip 
                  icon={<Warning fontSize="small" />}
                  label={`${operatorSeals.length - sealComparison.matched.length} Not Scanned`}
                  color="warning" 
                  variant="outlined"
                  size="small" />
              )}
              {sealComparison.mismatched.length > 0 && (
                        <Chip 
                  icon={<Warning fontSize="small" />}
                  label={`${sealComparison.mismatched.length} Extra Tags`}
                  color="error" 
                  variant="outlined"
                          size="small" />
              )}
                </Box>
                    </Box>
              </Paper>

        {/* Unified Seal Verification Table with Expandable Rows */}
        <Paper variant="outlined" sx={{ mb: 4 }}>
                    <TableContainer>
            <Table>
                        <TableHead>
                <TableRow sx={{ bgcolor: 'background.paper' }}>
                  <TableCell width="35%">Seal Tag ID</TableCell>
                  <TableCell width="15%">Method</TableCell>
                  <TableCell width="15%">Source</TableCell>
                  <TableCell width="20%">Status</TableCell>
                  <TableCell width="15%">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                {allSealIds.map((sealId, index) => {
                  const operatorSeal = operatorSeals.find(seal => seal.id === sealId);
                  const guardSeal = guardScannedSeals.find(seal => seal.id === sealId);
                  const isExpanded = expandedRows[sealId] || false;
                  
                  // Determine status
                  let statusColor: "success" | "warning" | "error" = "success";
                  let statusLabel = "Matched";
                  let statusIcon = <CheckCircle fontSize="small" />;
                  
                  if (operatorSeal && !guardSeal) {
                    statusColor = "warning";
                    statusLabel = "Not Scanned";
                    statusIcon = <Warning fontSize="small" />;
                  } else if (!operatorSeal && guardSeal) {
                    statusColor = "error";
                    statusLabel = "Extra Tag";
                    statusIcon = <Warning fontSize="small" />;
                  }
                  
                  return (
                    <React.Fragment key={`seal-${index}`}>
                      {/* Main Row */}
                      <TableRow 
                        hover
                        sx={{ 
                          cursor: 'pointer',
                          bgcolor: 
                            !operatorSeal ? 'rgba(211, 47, 47, 0.08)' : 
                            !guardSeal ? 'inherit' : 
                            'rgba(46, 125, 50, 0.08)'
                        }}
                      >
                        <TableCell onClick={() => toggleRowExpansion(sealId)}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {statusColor === "success" && (
                              <CheckCircle color="success" fontSize="small" sx={{ mr: 1 }} />
                            )}
                            <Typography 
                              variant="body2"
                              sx={{ 
                                fontWeight: 'medium',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem'
                              }}
                            >
                              {sealId}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(sealId)}>
                          {operatorSeal ? (
                        <Chip 
                              label={getMethodDisplay(operatorSeal?.method)}
                              color={getMethodColor(operatorSeal?.method)} size="small" />
                          ) : guardSeal ? (
                            <Chip 
                              label={getMethodDisplay(guardSeal?.method)}
                              color={getMethodColor(guardSeal?.method)} size="small" />
                      ) : (
                            <Chip label="Unknown" color="default" size="small" />
                          )}
                          </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(sealId)}>
                          {operatorSeal && guardSeal ? (
                            <Box>
                              <Chip size="small" label="Both" color="success" sx={{ mr: 1 }} />
                            </Box>
                          ) : operatorSeal ? (
                            <Chip size="small" label="Operator" color="primary" />
                          ) : (
                            <Chip size="small" label="Guard" color="secondary" />
                          )}
                              </TableCell>
                        <TableCell onClick={() => toggleRowExpansion(sealId)}>
                        <Chip 
                            icon={statusIcon}
                            label={statusLabel}
                            color={statusColor} size="small" />
                      </TableCell>
                      <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title={isExpanded ? "Hide details" : "Show details"}>
                              <IconButton 
                          size="small"
                                onClick={() => toggleRowExpansion(sealId)}
                              >
                                {isExpanded ? (
                                  <KeyboardArrowUp fontSize="small" />
                                ) : (
                                  <KeyboardArrowDown fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                            
                            {/* Remove button for guard scans */}
                            {guardSeal && (
                              <Tooltip title="Remove scanned seal">
                                <IconButton 
                                  size="small" 
                          color="error"
                                  onClick={() => {
                                    const index = guardScannedSeals.findIndex(s => s.id === sealId);
                                    if (index !== -1) {
                                      removeSealTag(index);
                                    }
                                  }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                    </Box>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expandable Detail Row */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={5} sx={{ py: 2, px: 3, bgcolor: 'grey.50' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {/* Comparison information */}
                              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
                                {/* Operator column */}
                                <Box sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                  <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
                                    Operator Information
                </Typography>
          
                      {operatorSeal ? (
                        <>
                                      <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Seal ID:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{operatorSeal.id}</Typography>
                                      </Box>
                                      
                                                                              <Box sx={{ mb: 2 }}>
                                          <Typography variant="body2" color="text.secondary">Method:</Typography>
                            <Chip 
                                            label={getMethodDisplay(operatorSeal?.method)} size="small"
                                            color={getMethodColor(operatorSeal?.method)}
                            />
                                        </Box>
                                      
                                      <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Timestamp:</Typography>
                                        <Typography variant="body2">{operatorSeal?.timestamp ? operatorSeal?.timestamp ? formatDate(operatorSeal.timestamp) : "N/A" : "N/A"}</Typography>
                                      </Box>
                                      
                                      {operatorSeal?.imageData && (
                                        <Box>
                                          <Typography variant="body2" color="text.secondary" gutterBottom>Image:</Typography>
                                          <Box 
                                            component="img" 
                                            src={operatorSeal?.imageData} 
                                            alt={`Seal ${operatorSeal?.id || "Unknown" || "Unknown"}`}
                                            sx={{ 
                                              maxWidth: '100%', 
                                              height: 'auto', 
                                              maxHeight: 200,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider'
                                            }}
                                />
            </Box>
                            )}
                        </>
                      ) : (
                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                      <Typography color="error">
                                        Not found in operator records
                          </Typography>
                                    </Box>
                      )}
                                </Box>
                      
                                {/* Guard column */}
                                <Box sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                  <Typography variant="subtitle2" gutterBottom sx={{ color: 'secondary.main' }}>
                                    Guard Information
                                  </Typography>
                                  
                      {guardSeal ? (
                        <>
                                      <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Seal ID:</Typography>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{guardSeal.id}</Typography>
                                      </Box>
                                      
                                                                              <Box sx={{ mb: 2 }}>
                                          <Typography variant="body2" color="text.secondary">Method:</Typography>
                            <Chip 
                                            label={getMethodDisplay(guardSeal?.method)} size="small"
                                            color={getMethodColor(guardSeal?.method)}
                            />
                                        </Box>
                                      
                                      <Box sx={{ mb: 2 }}>
                                        <Typography variant="body2" color="text.secondary">Timestamp:</Typography>
                                        <Typography variant="body2">{guardSeal?.timestamp ? guardSeal?.timestamp ? formatDate(guardSeal.timestamp) : "N/A" : "N/A"}</Typography>
                                      </Box>
                                      
                            {guardSeal.imagePreview ? (
                                        <Box>
                                          <Typography variant="body2" color="text.secondary" gutterBottom>Image:</Typography>
                                          <Box 
                                            component="img" 
                                  src={guardSeal.imagePreview} 
                                            alt={`Seal ${guardSeal?.id || "Unknown" || "Unknown"}`}
                                            sx={{ 
                                              maxWidth: '100%', 
                                              height: 'auto', 
                                              maxHeight: 200,
                                              borderRadius: 1,
                                              border: '1px solid',
                                              borderColor: 'divider'
                                            }}
                                />
          </Box>
                            ) : (
                                        <Box sx={{ mb: 2 }}>
                                          <Typography variant="body2" color="text.secondary" gutterBottom>Image:</Typography>
                                          <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                              component="label"
                                              variant="outlined"
                                              size="small"
                                              startIcon={<CloudUpload />}
                                            >
                                              Upload Image
                                              <input
                                                type="file"
                                                hidden
                                                accept="image/*"
                                                onChange={(e) => {
                                                  const guardIndex = guardScannedSeals.findIndex(s => s.id === sealId);
                                                  if (guardIndex !== -1) {
                                                    handleSealImageUpload(guardIndex, e.target.files?.[0] || null);
                                                  }
                                                }}
                                              />
                                            </Button>
                                            <Button
                                              component="label"
                                              variant="outlined"
                                              size="small"
                                              color="secondary"
                                              startIcon={<QrCode />}
                                            >
                                              Capture Image
                                              <input
                                                type="file"
                                                hidden
                                                accept="image/*"
                                                capture="environment"
                                                onChange={(e) => {
                                                  const guardIndex = guardScannedSeals.findIndex(s => s.id === sealId);
                                                  if (guardIndex !== -1) {
                                                    handleSealImageUpload(guardIndex, e.target.files?.[0] || null);
                                                  }
                                                }}
                                              />
                                            </Button>
                                          </Box>
                    </Box>
                                      )}
                        </>
                      ) : (
                                    <Box sx={{ p: 2, textAlign: 'center' }}>
                                      <Typography color="error">
                            Not scanned by guard
                          </Typography>
                                    </Box>
                      )}
                                </Box>
                    </Box>
                              
                              {/* Verification status and actions */}
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                                    Verification Status: 
                        <Chip 
                                      label={
                                        !operatorSeal ? "Extra Tag" : 
                                        !guardSeal ? "Not Scanned" : 
                                        "Verified Match"
                                      }
                                      color={
                                        !operatorSeal ? "error" : 
                                        !guardSeal ? "warning" : 
                                        "success"
                                      } size="small"
                                      sx={{ ml: 1 }}
                                    />
                                  </Typography>
                                </Box>
                                
                                <Button 
                                  size="small"
                                  onClick={() => toggleRowExpansion(sealId)}
                                  startIcon={<KeyboardArrowUp />}
                                >
                                  Close Details
                                </Button>
                              </Box>
                    </Box>
                      </TableCell>
                    </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  };

  // Enhanced function to display verification results with color coding
  const renderVerificationResults = () => {
    if (!verificationResults || !session) return null;
    
    const { matches, mismatches, unverified, allFields, timestamp } = verificationResults;
    
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Trip Verification Results
        </Typography>
        
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Verification Complete</AlertTitle>
          <Typography variant="body2">
            Verification was completed on {new Date(timestamp).toLocaleString()}
            {session.seal?.verifiedBy && ` by ${session.seal.verifiedBy.name}`}.
          </Typography>
        </Alert>
        
        {/* Tabs for verification results */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs 
            value={activeSealTab} 
            onChange={(_, newValue) => setActiveSealTab(newValue)}
            variant="fullWidth"
          >
            <Tab label="Verification Summary" />
            <Tab label="Detailed Comparison" />
          </Tabs>
        </Box>
        
        {/* Tab content */}
        {activeSealTab === 0 ? (
          /* Verification Summary Tab */
          <>
        {/* Seal verification information */}
            <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Typography variant="subtitle1" gutterBottom>Seal Tag Verification</Typography>
            
              {/* Show operator and guard seal tags side-by-side */}
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, mb: 3 }}>
                {/* Operator Seals */}
                <Box sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="primary.main" gutterBottom>
                    Operator Seal Tags ({operatorSeals.length})
                </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>No.</TableCell>
                    <TableCell>Seal Tag ID</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Image</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSeals.map((seal, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{seal.id}</TableCell>
                      <TableCell>
                        <Chip
                            label={seal?.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned'}
                            color={seal?.method.toLowerCase().includes('manual') ? 'secondary' : 'primary'} size="small"
                          />
                      </TableCell>
                      <TableCell>
                              {seal?.imageData ? (
                          <Box 
                            component="img" 
                                  src={seal?.imageData} 
                            alt={`Seal tag ${index+1 || "Unknown"}`}
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              objectFit: 'cover',
                              borderRadius: 1,
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              // Open image in modal
                                    setSelectedSeal(seal);
                                    setDetailsDialogOpen(true);
                                  }}
                                  onError={(e) => {
                                    console.error(`Failed to load image for seal ${seal.id}:`, seal?.imageData);
                                    // Try alternative image URL formats
                                    const img = e.target as HTMLImageElement;
                                    if (session?.id) {
                                      // Attempt direct URL to seal tag image
                                      img.src = `/api/images/${session.id}/sealing/${index}`;
                                      console.log(`Retrying with index-based URL: ${img.src}`);
                                    }
                            }}
                          />
                        ) : (
                          <Typography variant="caption">No image</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
              </Box>
                
                                {/* Guard Seals - Show if available in verificationData */}
                {session.seal?.verificationData?.guardImages && (
                  <Box sx={{ flex: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" color="secondary.main" gutterBottom>
                      Guard Verification Images
                    </Typography>

                    {/* Debug info for examining guardImages structure */}
                    {process.env.NODE_ENV === 'development' && (
                      <details>
                        <summary>Debug: Guard Images Structure</summary>
                        <pre style={{ fontSize: '10px', overflowX: 'auto', maxWidth: '100%' }}>
                          {JSON.stringify(session.seal.verificationData.guardImages, null, 2)}
                        </pre>
                      </details>
                    )}
                    
                    {/* Display guard seal images - Comprehensive approach to show all possible formats */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {/* First show a table with seal tag images for better comparison */}
                      <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, width: '100%' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>No.</TableCell>
                              <TableCell>Seal Tag ID</TableCell>
                              <TableCell>Image</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {/* Try multiple approaches to extract and display guard seal images */}
                            {(() => {
                              // Extract all possible seal-related images using different methods
                              let guardSealImages: Array<{id: string, url: string, index: number}> = [];
                              let idx = 0;
                              
                              // 1. Direct tag images in guardImages root
                              Object.entries(session.seal?.verificationData?.guardImages || {}).forEach(([key, url]) => {
                                const isTag = key.toLowerCase().includes('seal') || 
                                            key.toLowerCase().includes('tag') || 
                                            key.toLowerCase().includes('barcode');
                                
                                // Skip non-tag keys for now
                                if (!isTag) return;
                                
                                // Handle different data formats
                                if (Array.isArray(url)) {
                                  url.forEach((imgUrl, i) => {
                                    if (typeof imgUrl === 'string') {
                                      guardSealImages.push({
                                        id: `${key}_${i}`,
                                        url: imgUrl,
                                        index: idx++
                                      });
                                    }
                                  });
                                } else if (typeof url === 'string') {
                                  guardSealImages.push({
                                    id: key,
                                    url,
                                    index: idx++
                                  });
                                }
                              });
                              
                              // 2. Look for sealingImages array in guardImages
                              const sealingImages = session.seal?.verificationData?.guardImages?.sealingImages;
                              if (Array.isArray(sealingImages)) {
                                sealingImages.forEach((url, i) => {
                                  if (typeof url === 'string') {
                                    guardSealImages.push({
                                      id: `Seal Tag ${i+1}`,
                                      url,
                                      index: idx++
                                    });
                                  }
                                });
                              }
                              
                              // 3. Look for a collection of numbered seal tags
                              for (let i = 1; i <= 20; i++) {
                                const possibleKeys = [
                                  `sealTag_${i}`, 
                                  `seal_${i}`, 
                                  `sealImage_${i}`,
                                  `seal${i}`,
                                  `tag${i}`
                                ];
                                
                                for (const key of possibleKeys) {
                                  const url = session.seal?.verificationData?.guardImages?.[key];
                                  if (url && typeof url === 'string') {
                                    guardSealImages.push({
                                      id: `Seal ${i}`,
                                      url,
                                      index: idx++
                                    });
                                    break; // Found this numbered seal, no need to check other formats
                                  }
                                }
                              }
                              
                              // Extract IDs from operator seals for better naming
                              const operatorSealIds = operatorSeals.map(seal => seal.id);
                              
                              // If we found seal images, display them
                              if (guardSealImages.length > 0) {
                                return guardSealImages.map((item, index) => {
                                  // Try to match with operator seals for better ID display
                                  const matchingOperatorId = operatorSealIds[index] || item.id;
                                  
                                  return (
                                    <TableRow key={`guard-seal-${index}`}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                                          {matchingOperatorId}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <Box 
                                          component="img" 
                                          src={item.url}
                                          alt={`Guard Seal ${index + 1 || "Unknown"}`}
                                          sx={{ 
                                            width: 60, 
                                            height: 60, 
                                            objectFit: 'cover',
                                            borderRadius: 1,
                                            cursor: 'pointer'
                                          }}
                                          onClick={() => {
                                            setSelectedImage(item.url);
                                            setOpenImageModal(true);
                                          }}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  );
                                });
                              }
                              
                              // No guard seal images found with our methods
                              return (
                                <TableRow>
                                  <TableCell colSpan={3} align="center">
                                    <Typography variant="body2" color="text.secondary">
                                      No guard seal tag images found
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      
                      {/* Show all seal-related guard images as thumbnails too */}
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2, width: '100%' }}>
                        {(() => {
                          // Collect all images that might be seal-related from various sources
                          let allPossibleSealImages: Array<{key: string, url: string}> = [];
                          
                          // Direct examination of guardImages for anything that might be a seal
                          Object.entries(session.seal?.verificationData?.guardImages || {}).forEach(([key, value]) => {
                            // Process arrays of images
                            if (Array.isArray(value)) {
                              value.forEach((url, idx) => {
                                if (typeof url === 'string') {
                                  allPossibleSealImages.push({
                                    key: `${key} ${idx+1}`,
                                    url
                                  });
                                }
                              });
                            } 
                            // Process direct string URLs
                            else if (typeof value === 'string') {
                              allPossibleSealImages.push({
                                key,
                                url: value
                              });
                            }
                          });
                          
                          // If we found images, display them all
                          if (allPossibleSealImages.length > 0) {
                            return allPossibleSealImages.map((item, index) => (
                              <Box key={`all-guard-${index}`} sx={{ width: 120, height: 120, position: 'relative' }}>
                                <Typography variant="caption" sx={{ fontSize: '0.7rem', mb: 0.5, display: 'block' }}>
                                  {getFieldLabel(item.key)}
                                </Typography>
                                <Box
                                  component="img" 
                                  src={item.url} 
                                  alt={item.key}
                                  sx={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => {
                                    setSelectedImage(item.url);
                                    setOpenImageModal(true);
                                  }}
                                />
                              </Box>
                            ));
                          }
                          
                          return (
                            <Box sx={{ width: '100%', textAlign: 'center', py: 2 }}>
                              <Typography variant="body2" color="text.secondary">
                                No guard verification images available
                              </Typography>
                            </Box>
                          );
                        })()}
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
                    </Box>
            
            {/* Field verification summary */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Field Verification Summary</Typography>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                    <Typography variant="h5" align="center">{matches.length}</Typography>
                    <Typography variant="body2" align="center">Matching Fields</Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                    <Typography variant="h5" align="center">{mismatches.length}</Typography>
                    <Typography variant="body2" align="center">Mismatched Fields</Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                    <Typography variant="h5" align="center">{unverified.length}</Typography>
                    <Typography variant="body2" align="center">Unverified Fields</Typography>
                  </Paper>
                </Box>
                    </Box>
            </Box>
            
            {/* Guard Verification Images - Show other image types */}
            {session.seal?.verificationData?.guardImages && Object.keys(session.seal.verificationData.guardImages).length > 0 && (
              <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>Guard Verification Images</Typography>
                
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {Object.entries(session.seal.verificationData.guardImages).map(([key, url]) => {
                    // Skip seal images as they're shown above
                    if (key.toLowerCase().includes('seal')) return null;
                    
                    if (Array.isArray(url)) {
                      return url.map((imageUrl, idx) => (
                        <Box key={`${key}-${idx}`} sx={{ width: 120, height: 120, position: 'relative' }}>
                          <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                            {getFieldLabel(key)} {idx + 1}
                          </Typography>
                          <Box
                            component="img" 
                            src={imageUrl as string} 
                            alt={`${key} ${idx + 1 || "Unknown"}`}
                            sx={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              setSelectedImage(imageUrl as string);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      ));
                    } else if (typeof url === 'string') {
                      return (
                        <Box key={key} sx={{ width: 120, height: 120, position: 'relative' }}>
                          <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                            {getFieldLabel(key)}
                          </Typography>
                          <Box 
                            component="img" 
                            src={url} 
                            alt={key}
                            sx={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover',
                              borderRadius: '4px',
                              border: '1px solid #ddd',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              setSelectedImage(url);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      );
                    }
                    return null;
                  })}
                </Box>
                    </Box>
            )}
          </>
        ) : (
          /* Detailed Comparison Tab */
          <>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell width="30%"><strong>Field</strong></TableCell>
                    <TableCell width="25%"><strong>Operator Value</strong></TableCell>
                    <TableCell width="25%"><strong>Guard Value</strong></TableCell>
                    <TableCell width="20%" align="center"><strong>Status</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Matching fields (green) - PASS */}
                  {matches.map(field => {
                    const data = allFields[field];
                    return (
                      <TableRow key={field} sx={{ 
                        bgcolor: 'rgba(46, 125, 50, 0.15)', 
                        '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.25)' }
                      }}>
                        <TableCell component="th" scope="row" sx={{ color: 'success.dark', fontWeight: 'medium' }}>
                          {getFieldLabel(field)}
                        </TableCell>
                        <TableCell sx={{ color: 'success.dark' }}>{String(data.operatorValue || 'N/A')}</TableCell>
                        <TableCell sx={{ color: 'success.dark' }}>{String(data.guardValue || 'Not provided')}</TableCell>
                        <TableCell align="center">
                          <Box display="flex" alignItems="center" justifyContent="center" sx={{ color: 'success.main' }}>
                            <CheckCircle fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>Pass</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {/* Mismatched fields (red) - FAIL */}
                  {mismatches.map(field => {
                    const data = allFields[field];
                    return (
                      <TableRow key={field} sx={{ 
                        bgcolor: 'rgba(211, 47, 47, 0.15)', 
                        '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.25)' }
                      }}>
                        <TableCell component="th" scope="row" sx={{ color: 'error.dark', fontWeight: 'medium' }}>
                          {getFieldLabel(field)}
                        </TableCell>
                        <TableCell sx={{ color: 'error.dark' }}>{String(data.operatorValue || 'N/A')}</TableCell>
                        <TableCell sx={{ color: 'error.dark' }}>{String(data.guardValue || 'Not provided')}</TableCell>
                        <TableCell align="center">
                          <Box display="flex" alignItems="center" justifyContent="center" sx={{ color: 'error.main' }}>
                            <Warning fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>Fail</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  
                  {/* Unverified fields (orange) - NOT VERIFIED */}
                  {unverified.map(field => {
                    const data = allFields[field];
                    return (
                      <TableRow key={field} sx={{ 
                        bgcolor: 'rgba(255, 152, 0, 0.15)', 
                        '&:hover': { bgcolor: 'rgba(255, 152, 0, 0.25)' }
                      }}>
                        <TableCell component="th" scope="row" sx={{ color: 'warning.dark', fontWeight: 'medium' }}>
                          {getFieldLabel(field)}
                        </TableCell>
                        <TableCell sx={{ color: 'warning.dark' }}>{String(data.operatorValue || 'N/A')}</TableCell>
                        <TableCell sx={{ color: 'warning.dark' }}>{String(data.guardValue || 'Not verified')}</TableCell>
                        <TableCell align="center">
                          <Box display="flex" alignItems="center" justifyContent="center" sx={{ color: 'warning.main' }}>
                            <RadioButtonUnchecked fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>Not Verified</Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    );
  };

  // Report download handlers
  const handleDownloadReport = async (format: string) => {
    if (!sessionId || !session) return;
    
    try {
      setReportLoading(format);
      
      if (format === "excel") {
        // For Excel, continue using the server-side endpoint
        const endpoint = `/api/reports/sessions/${sessionId}/excel`;
        const response = await fetch(endpoint);
        
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData || `Failed to download excel report`);
        }
        
        // Convert response to blob
        const blob = await response.blob();
        
        // Create a link element to trigger the download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `session-${sessionId}.xlsx`;
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
      } else if (format === "pdf") {
        // Generate PDF client-side for more control and faster generation
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true, // Better quality
          putOnlyUsedFonts: true, // Better quality
          floatPrecision: 16 // Better quality for floating point values
        });
        
        // PDF styling constants
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15; // Increased margin for better readability
        const contentWidth = pageWidth - (margin * 2);
        let currentY = margin + 5; // Start a bit lower for better spacing
        
        // Helper functions for PDF generation with improved styling
        const addTitle = (text: string) => {
          // Add colored background for title
          pdf.setFillColor(42, 54, 95); // Dark blue background
          pdf.rect(0, currentY - 8, pageWidth, 14, 'F');
          
          pdf.setTextColor(255, 255, 255); // White text
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(16);
          pdf.text(text, margin, currentY);
          currentY += 12; // More space after title
          pdf.setTextColor(0, 0, 0); // Reset text color
        };
        
        const addSectionTitle = (text: string) => {
          // Add light background for section titles
          pdf.setFillColor(240, 240, 250); // Light blue background
          pdf.rect(margin - 3, currentY - 5, contentWidth + 6, 10, 'F');
          
          pdf.setTextColor(42, 54, 95); // Dark blue text
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(12);
          pdf.text(text, margin, currentY);
          currentY += 10; // More space after section title
          pdf.setTextColor(0, 0, 0); // Reset text color
        };
        
        const addField = (label: string, value: any, inline = false) => {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          
          // Format value
          let formattedValue = value === null || value === undefined
            ? 'N/A'
            : typeof value === 'object'
              ? JSON.stringify(value)
              : String(value); // Ensure all values are strings
          
          // Truncate long values to prevent overflow
          const maxValueLength = 60;
          if (formattedValue.length > maxValueLength) {
            formattedValue = formattedValue.substring(0, maxValueLength) + '...';
          }
          
          if (inline) {
            // Improved styling for field/value pairs
            pdf.setTextColor(70, 70, 70); // Dark gray for label
            pdf.text(`${label}:  `, margin, currentY);
            pdf.setFont("helvetica", "normal");
            
            // Calculate position for value text (after label)
            const labelWidth = pdf.getStringUnitWidth(`${label}: `) * 10 * 0.4; // approximate conversion
            pdf.setTextColor(0, 0, 0); // Black for value
            pdf.text(formattedValue, margin + labelWidth, currentY);
            currentY += 6; // Increased spacing between lines
          } else {
            pdf.setTextColor(70, 70, 70); // Dark gray for label
            pdf.text(`${label}:`, margin, currentY);
            currentY += 5;
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(0, 0, 0); // Black for value
            pdf.text(formattedValue, margin + 5, currentY);
            currentY += 7; // Increased spacing
          }
        };
        
        const addDivider = () => {
          pdf.setDrawColor(180, 180, 200);
          pdf.setLineWidth(0.5);
          pdf.line(margin, currentY, pageWidth - margin, currentY);
          currentY += 8; // More space after divider
        };
        
        const checkPageBreak = (spaceNeeded: number = 10) => {
          if (currentY + spaceNeeded > pdf.internal.pageSize.getHeight() - margin) {
            pdf.addPage();
            currentY = margin;
            return true;
          }
          return false;
        };
        
        const formatDate = (dateString: string) => {
          return new Date(dateString).toLocaleString();
        };
        
        // Header with company name and logo placeholder
        pdf.setFillColor(245, 245, 250);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        
        // Add a border at the bottom of the header
        pdf.setDrawColor(200, 200, 220);
        pdf.setLineWidth(0.5);
        pdf.line(0, 25, pageWidth, 25);
        
        // Company name (placeholder for actual company name)
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(50, 50, 100);
        pdf.text("Trip Challan Management System", margin, 15);
        
        // Current date on the right
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        const dateString = new Date().toLocaleDateString();
        const dateWidth = pdf.getStringUnitWidth(dateString) * 10 * 0.3;
        pdf.text(dateString, pageWidth - margin - dateWidth, 15);
        
        // Reset for content
        pdf.setTextColor(0, 0, 0);
        currentY = 35; // Start content after header
        
        // Title and basic info
        addTitle(`Session Report: ${sessionId}`);
        addField("Generated On", new Date().toLocaleString(), true);
        addDivider();
        
        // Basic Session Information
        addSectionTitle("Session Information");
        addField("Status", session.status, true);
        addField("Source", session.source, true);
        addField("Destination", session.destination, true);
        addField("Created At", formatDate(session.createdAt), true);
        addField("Company", session.company?.name || "N/A", true);
        addField("Created By", session.createdBy?.name || "N/A", true);
        
        checkPageBreak(20);
        addDivider();
        
        // Trip Details Section
        if (session.tripDetails && Object.keys(session.tripDetails).length > 0) {
          addSectionTitle("Trip Details");
          
          Object.entries(session.tripDetails).forEach(([key, value]) => {
            if (value) {
              // Format key from camelCase to Title Case
              const formattedKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              addField(formattedKey, value, true);
            }
          });
          
          checkPageBreak(10);
          addDivider();
        }
        
                 // Driver & Vehicle Details (specific fields for better organization)
         addSectionTitle("Driver & Vehicle Information");
         if (session.tripDetails) {
           const driverFields = [
             { key: 'driverName', label: 'Driver Name' },
             { key: 'driverContactNumber', label: 'Driver Contact' },
             { key: 'vehicleNumber', label: 'Vehicle Number' },
             { key: 'gpsImeiNumber', label: 'GPS IMEI Number' },
             { key: 'transporterName', label: 'Transporter' }
           ];
           
           driverFields.forEach(({ key, label }) => {
             const tripDetails = session.tripDetails as Record<string, any>;
             if (tripDetails && tripDetails[key]) {
               addField(label, tripDetails[key], true);
             }
           });
         }
        
        checkPageBreak(20);
        addDivider();
        
                 // Material Details
         addSectionTitle("Material Information");
         if (session.tripDetails) {
           const materialFields = [
             { key: 'materialName', label: 'Material' },
             { key: 'qualityOfMaterials', label: 'Quality' },
             { key: 'grossWeight', label: 'Gross Weight' },
             { key: 'tareWeight', label: 'Tare Weight' },
             { key: 'netMaterialWeight', label: 'Net Weight' },
             { key: 'loaderName', label: 'Loader Name' },
             { key: 'loaderMobileNumber', label: 'Loader Contact' },
             { key: 'receiverPartyName', label: 'Receiver' }
           ];
           
           materialFields.forEach(({ key, label }) => {
             const tripDetails = session.tripDetails as Record<string, any>;
             if (tripDetails && tripDetails[key]) {
               addField(label, tripDetails[key], true);
             }
           });
         }
        
        checkPageBreak(20);
        addDivider();
        
                 // Document Information
         addSectionTitle("Document Information");
         if (session.tripDetails) {
           const documentFields = [
             { key: 'challanRoyaltyNumber', label: 'Challan/Royalty Number' },
             { key: 'doNumber', label: 'DO Number' },
             { key: 'tpNumber', label: 'TP Number' },
             { key: 'freight', label: 'Freight' }
           ];
           
           documentFields.forEach(({ key, label }) => {
             const tripDetails = session.tripDetails as Record<string, any>;
             if (tripDetails && tripDetails[key]) {
               addField(label, tripDetails[key], true);
             }
           });
         }
        
        checkPageBreak(20);
        addDivider();
        
        // Verification Information
        if (verificationResults && Object.keys(verificationResults).length > 0) {
          addSectionTitle("Verification Results");
          
          // Summary
          const matches = verificationResults?.matches || [];
          const mismatches = verificationResults?.mismatches || [];
          const unverified = verificationResults?.unverified || [];
          
                     addField("Verified Fields", String(matches.length), true);
           addField("Mismatched Fields", String(mismatches.length), true);
           addField("Unverified Fields", String(unverified.length), true);
          
          if (verificationResults.timestamp) {
            addField("Verification Time", verificationResults?.timestamp ? formatDate(verificationResults.timestamp) : "N/A", true);
          }
          
          checkPageBreak(30);
          
          // Add improved table for verification details
          if (verificationResults?.allFields && Object.keys(verificationResults?.allFields).length > 0) {
            currentY += 8; // More space before table
            
            const tableTop = currentY;
            const colWidths = [contentWidth * 0.3, contentWidth * 0.3, contentWidth * 0.2, contentWidth * 0.2];
            const rowHeight = 10; // Taller rows for better readability
            
            // Table headers with better styling
            pdf.setFont("helvetica", "bold");
            pdf.setFillColor(42, 54, 95); // Dark blue for header
            pdf.rect(margin, tableTop, contentWidth, rowHeight, 'F');
            
            pdf.setTextColor(255, 255, 255); // White text for header
            let colPos = margin + 2; // Add padding
            pdf.text("Field", colPos, tableTop + 6.5); // Centered text
            colPos += colWidths[0];
            
            pdf.text("Operator Value", colPos, tableTop + 6.5);
            colPos += colWidths[1];
            
            pdf.text("Guard Value", colPos, tableTop + 6.5);
            colPos += colWidths[2];
            
            pdf.text("Status", colPos, tableTop + 6.5);
            
            currentY = tableTop + rowHeight;
            
            // Draw vertical lines for columns
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.2);
            
            // Table rows with improved styling
            pdf.setFont("helvetica", "normal");
            pdf.setTextColor(0, 0, 0); // Reset text color
            let rowCount = 0;
            
            // For drawing vertical lines later
            const columnPositions = [
              margin, 
              margin + colWidths[0], 
              margin + colWidths[0] + colWidths[1], 
              margin + colWidths[0] + colWidths[1] + colWidths[2],
              margin + contentWidth
            ];
            
            Object.entries(verificationResults?.allFields).forEach(([field, data]) => {
              checkPageBreak(rowHeight + 3);
              
              // Format field name from camelCase to Title Case
              const formattedField = field
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              const matches = data?.matches === true;
              
              // Alternating row background
              if (rowCount % 2 === 0) {
                pdf.setFillColor(245, 245, 250);
                pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
              } else {
                pdf.setFillColor(255, 255, 255);
                pdf.rect(margin, currentY, contentWidth, rowHeight, 'F');
              }
              
              // Draw horizontal grid line
              pdf.setDrawColor(220, 220, 220);
              pdf.line(margin, currentY, margin + contentWidth, currentY);
              
              // Text content
              pdf.setTextColor(0, 0, 0);
              colPos = margin + 2; // Padding
              pdf.text(formattedField, colPos, currentY + 6.5); // Centered text
              colPos += colWidths[0];
              
              // Convert to string to avoid type errors
              pdf.text(String(data.operatorValue || 'N/A'), colPos, currentY + 6.5);
              colPos += colWidths[1];
              
              // Convert to string to avoid type errors
              pdf.text(String(data.guardValue || 'Not provided'), colPos, currentY + 6.5);
              colPos += colWidths[2];
              
              // Status with color and better styling
              if (matches) {
                pdf.setTextColor(0, 128, 0); // Green for matches
                pdf.text('✓ Match', colPos, currentY + 6.5);
              } else {
                pdf.setTextColor(255, 0, 0); // Red for mismatches
                pdf.text('✗ Mismatch', colPos, currentY + 6.5);
              }
              pdf.setTextColor(0, 0, 0); // Reset text color
              
              currentY += rowHeight;
              rowCount++;
            });
            
            // Draw the final horizontal line
            pdf.setDrawColor(220, 220, 220);
            pdf.line(margin, currentY, margin + contentWidth, currentY);
            
            // Draw vertical grid lines
            pdf.setDrawColor(220, 220, 220);
            columnPositions.forEach(xPos => {
              pdf.line(xPos, tableTop, xPos, currentY);
            });
            
            // Outer table border
            pdf.setDrawColor(150, 150, 150);
            pdf.setLineWidth(0.5);
            pdf.rect(margin, tableTop, contentWidth, currentY - tableTop, 'S');
            
            currentY += 10; // More space after table
          }
          
          addDivider();
        }
        
        // QR Code information
        if (session.qrCodes) {
          checkPageBreak(20);
          addSectionTitle("QR Codes");
          
          if (session.qrCodes.primaryBarcode) {
            addField("Primary Barcode", session.qrCodes.primaryBarcode, true);
          }
          
          if (session.qrCodes.additionalBarcodes && session.qrCodes.additionalBarcodes.length > 0) {
            addField("Additional Barcodes", session.qrCodes.additionalBarcodes.join(", "), true);
          }
          
          addDivider();
        }
        
                 // Enhanced footer with page numbers and company info
         const totalPages = pdf.internal.pages.length - 1;
         for (let i = 1; i <= totalPages; i++) {
           pdf.setPage(i);
           
           // Footer background
           pdf.setFillColor(245, 245, 250);
           pdf.rect(0, pageHeight - 15, pageWidth, 15, 'F');
           
           // Add a border at the top of the footer
           pdf.setDrawColor(200, 200, 220);
           pdf.setLineWidth(0.5);
           pdf.line(0, pageHeight - 15, pageWidth, pageHeight - 15);
           
           // Page numbers
           pdf.setFont("helvetica", "normal");
           pdf.setFontSize(9);
           pdf.setTextColor(50, 50, 100);
           
           // Ensure all values are strings when added to text
           pdf.text(
             `Page ${String(i)} of ${String(totalPages)}`,
             margin,
             pageHeight - 5
           );
           
           // Center text - timestamp
           pdf.text(
             `Generated on ${new Date().toLocaleString()}`,
             pageWidth / 2,
             pageHeight - 5,
             { align: 'center' }
           );
           
           // Right aligned - copyright
           pdf.text(
             "Trip Challan © " + new Date().getFullYear(),
             pageWidth - margin,
             pageHeight - 5,
             { align: 'right' }
           );
         }
        
        // Save the PDF
        pdf.save(`session-${sessionId}.pdf`);
      } else {
        throw new Error("Unsupported report format");
      }
    } catch (err) {
      console.error(`Error downloading ${format} report:`, err);
      alert(`Failed to download ${format} report: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setReportLoading(null);
    }
  };

  // Add a function to fetch all seals for this session
  const fetchSessionSeals = useCallback(async () => {
    if (!sessionId) return;
    
    setLoadingSeals(true);
    setSealsError("");
    
    try {
      console.log("Fetching seals for session ID:", sessionId);
      const response = await fetch(`/api/sessions/${sessionId}/seals`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`API Error (${response.status}):`, errorData);
        throw new Error(`Failed to fetch session seals: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      const data = await response.json();
      console.log("Session seals received:", data);
      setSessionSeals(data);
    } catch (err) {
      console.error("Error fetching session seals:", err);
      setSealsError(err instanceof Error ? err.message : "Failed to fetch seals");
    } finally {
      setLoadingSeals(false);
    }
  }, [sessionId]);
  
  // Add useEffect to fetch seals when session details are loaded
  useEffect(() => {
    if (session) {
      fetchSessionSeals();
    }
  }, [session, fetchSessionSeals]);
  
  // Enhanced render all seals function
  const renderAllSeals = () => {
    if (loadingSeals) {
      return (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    
    if (sealsError) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Error Loading Seals</AlertTitle>
          {sealsError}
          <Button 
            size="small" 
            onClick={fetchSessionSeals} 
            sx={{ mt: 1 }}
            startIcon={<Refresh />}
          >
            Retry
          </Button>
        </Alert>
      );
    }
    
    if (!sessionSeals || sessionSeals.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No seals found for this session.
          </Typography>
        </Box>
      );
    }
    
    // Group seals by type
    const tagSeals = sessionSeals.filter(seal => seal.type === 'tag');
    const systemSeals = sessionSeals.filter(seal => seal.type === 'system' || seal.type === 'verification');
    
    return (
      <>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Total Seals: <strong>{sessionSeals.length}</strong> 
          {tagSeals.length > 0 && <> (Operator Tags: <strong>{tagSeals.length}</strong>, Verification Seals: <strong>{systemSeals.length}</strong>)</>}
        </Typography>
        
        {/* System Seals Table */}
        {systemSeals.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Verification Seals
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>No.</TableCell>
                    <TableCell>Barcode/ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Verified By</TableCell>
                    <TableCell>Verified At</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {systemSeals.map((seal, index) => {
                    // Determine if all fields match from verification data
                    const allMatch = seal.verificationDetails?.allMatch;
                    let statusColor = seal.verified ? "success" : "default";
                    
                    // If verified but fields don't match, use warning color
                    if (seal.verified && allMatch === false) {
                      statusColor = "warning";
                    }
                    
                    return (
                      <TableRow key={seal.id} hover sx={{
                        bgcolor: seal.verified ? 
                          (allMatch === false ? 'rgba(255, 152, 0, 0.08)' : 'rgba(46, 125, 50, 0.08)') : 
                          'inherit'
                      }}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Box 
                            sx={{ 
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 0.75,
                              bgcolor: 'background.paper',
                              maxWidth: 180,
                              overflow: 'hidden'
                            }}
                          >
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'medium' }}>
                              {seal.barcode}
                    </Typography>
                  </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={seal.type === 'system' ? 'System' : 'Verification'} 
                            color={seal.type === 'system' ? 'primary' : 'secondary'}
                          />
                        </TableCell>
                        <TableCell>
                          {seal?.method && (
                            <Chip 
                              size="small" 
                              label={seal?.method && typeof seal?.method === 'string' && 
                                     seal?.method.toLowerCase().includes('manual') ? 
                                     'Manually Entered' : 'Digitally Scanned'}
                              color={seal?.method && typeof seal?.method === 'string' && 
                                     seal?.method.toLowerCase().includes('manual') ? 
                                     'secondary' : 'primary'} 
                            />
                          )}
                        </TableCell>
                        <TableCell>{formatDate(seal.createdAt)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={
                              seal.verified 
                                ? (allMatch === false 
                                    ? "Verified with Issues" 
                                    : "Verified")
                                : "Unverified"
                            } 
                            color={statusColor as "success" | "warning" | "default"} size="small"
                            icon={
                              seal.verified 
                                ? (allMatch === false 
                                    ? <Warning fontSize="small" /> 
                                    : <CheckCircle fontSize="small" />)
                                : <RadioButtonUnchecked fontSize="small" />
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {seal.verifiedBy ? (
                            <Tooltip title={`User ID: ${seal.verifiedBy.id}`}>
                      <Typography variant="body2">
                                {seal.verifiedBy.name || (seal.verifiedById ? 'Guard' : 'Unknown')} 
                                <Typography variant="caption" component="span" color="text.secondary">
                                  {' '}({seal.verifiedBy.subrole || seal.verifiedBy.role || 'User'})
                                </Typography>
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Not verified yet
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {seal.scannedAt ? (
                            <Tooltip title={new Date(seal.scannedAt).toLocaleString()}>
                              <Typography variant="body2">
                                {formatDate(seal.scannedAt)}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              N/A
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {seal.verified && (
                            <Tooltip title="View verification details">
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  console.log("Viewing seal details:", seal);
                                  setSelectedSeal(seal);
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <InfoOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        
        {/* Operator Seal Tags Table - Removed and merged with main Seal Information section */}
        
        <Box display="flex" justifyContent="flex-end">
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={fetchSessionSeals}
            variant="outlined"
          >
            Refresh Seals
          </Button>
        </Box>
        
        {/* Seal Details Dialog */}
        <Dialog 
          open={detailsDialogOpen} 
          onClose={() => setDetailsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Seal Details
              </Typography>
              <IconButton onClick={() => setDetailsDialogOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedSeal && (
              <>
                {/* Seal Information */}
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Seal Information
                    </Typography>
                    
                    <Box 
                      sx={{ 
                        display: 'inline-block',
                        border: '2px solid',
                        borderColor: selectedSeal.verified ? 'success.main' : 'divider',
                        borderRadius: 1,
                        p: 1.5,
                        mt: 1,
                        mb: 2,
                        bgcolor: 'background.paper' 
                      }}
                    >
                      <Typography variant="h6" component="div" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                        {selectedSeal.barcode}
                      </Typography>
                    </Box>
                    
                                         <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Type</Typography>
                          <Typography variant="body1">{selectedSeal.type === 'system' ? 'System Seal' : 'Verification Seal'}</Typography>
                        </Box>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Status</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Chip 
                              label={selectedSeal.verified ? "Verified" : "Unverified"} 
                              color={selectedSeal.verified ? "success" : "default"} size="small"
                              icon={selectedSeal.verified ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                            />
                          </Box>
                    </Box>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Created At</Typography>
                          <Typography variant="body1">{new Date(selectedSeal.createdAt).toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Seal ID</Typography>
                          <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{selectedSeal.id}</Typography>
                        </Box>
                    </Box>
                  </Box>
                  
                  {selectedSeal.verified && (
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Verification Information
                      </Typography>
                                             <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                         <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                           <Typography variant="body2" color="text.secondary">Verified By</Typography>
                           <Typography variant="body1">
                             {selectedSeal.verifiedBy?.name || 'Unknown'} 
                             <Typography variant="caption" component="span" color="text.secondary">
                               {' '}({selectedSeal.verifiedBy?.subrole || selectedSeal.verifiedBy?.role || 'User'})
                             </Typography>
                           </Typography>
                         </Box>
                         <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                           <Typography variant="body2" color="text.secondary">Verified At</Typography>
                           <Typography variant="body1">
                             {selectedSeal.scannedAt ? new Date(selectedSeal.scannedAt).toLocaleString() : 'N/A'}
                           </Typography>
                         </Box>
                         {selectedSeal.verificationDetails?.allMatch !== undefined && (
                           <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                             <Typography variant="body2" color="text.secondary">Field Verification</Typography>
                             <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                               <Chip 
                                 label={selectedSeal.verificationDetails.allMatch ? "All Fields Match" : "Some Fields Mismatched"} 
                                 color={selectedSeal.verificationDetails.allMatch ? "success" : "warning"} size="small"
                                 icon={selectedSeal.verificationDetails.allMatch ? 
                                   <CheckCircle fontSize="small" /> : 
                                   <Warning fontSize="small" />
                                 }
                               />
                             </Box>
                    </Box>
                         )}
                         {selectedSeal.verificationDetails?.verificationTimestamp && (
                           <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                             <Typography variant="body2" color="text.secondary">Verification Timestamp</Typography>
                             <Typography variant="body1">
                               {new Date(selectedSeal.verificationDetails.verificationTimestamp).toLocaleString()}
                             </Typography>
                           </Box>
                         )}
            </Box>
                    </Box>
        )}
      </Paper>
                
                {/* Field Verifications */}
                {selectedSeal.verificationDetails?.fieldVerifications && Object.keys(selectedSeal.verificationDetails.fieldVerifications).length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Field Verification Details
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Field</TableCell>
                            <TableCell>Operator Value</TableCell>
                            <TableCell>Guard Value</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Comment</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(selectedSeal.verificationDetails.fieldVerifications).map(([field, data]: [string, any]) => {
                            const matches = data?.matches === true;
                            const isVerified = data.isVerified === true;
                            
                            return (
                              <TableRow key={field} sx={{ 
                                bgcolor: isVerified ? (matches ? 'rgba(46, 125, 50, 0.08)' : 'rgba(255, 152, 0, 0.08)') : 'inherit'
                              }}>
                                <TableCell>{getFieldLabel(field)}</TableCell>
                                <TableCell>{data.operatorValue !== undefined ? String(data.operatorValue) : 'N/A'}</TableCell>
                                <TableCell>{data.guardValue !== undefined ? String(data.guardValue) : 'N/A'}</TableCell>
                                <TableCell>
                                  {isVerified ? (
                                    <Chip 
                                      label={matches ? "Match" : "Mismatch"} 
                                      color={matches ? "success" : "warning"} size="small"
                                      icon={matches ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                                    />
                                  ) : (
                                    <Chip 
                                      label="Unverified" 
                                      color="default"
                                      size="small" />
                                  )}
                                </TableCell>
                                <TableCell>{data.comment || 'No comment'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}
                
                {/* Image Verification */}
                {selectedSeal.verificationDetails?.guardImages && Object.keys(selectedSeal.verificationDetails.guardImages).length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Verification Images
                    </Typography>
                                         <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                       {Object.entries(selectedSeal.verificationDetails.guardImages || {}).map(([key, url]) => {
                         if (Array.isArray(url)) {
                           return url.map((imageUrl, idx) => (
                            <Box key={`${key}-${idx}`} sx={{ width: 150, height: 150, position: 'relative' }}>
                              <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                                {getFieldLabel(key)} {idx + 1}
                              </Typography>
                              <Box
                                component="img" 
                                src={imageUrl as string} 
                                alt={`${key} ${idx + 1 || "Unknown"}`}
                                sx={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s',
                                  '&:hover': {
                                    transform: 'scale(1.05)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                  }
                                }}
                                onClick={() => {
                                  setSelectedImage(imageUrl as string);
                                  setOpenImageModal(true);
                                }}
                              />
                            </Box>
                          ));
                        }
                        
                        return (
                          <Box key={key} sx={{ width: 150, height: 150, position: 'relative' }}>
                            <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>
                              {getFieldLabel(key)}
                            </Typography>
                            <Box 
                              component="img" 
                              src={typeof url === 'string' ? url : ''} 
                              alt={key}
                              sx={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                cursor: 'pointer',
                                transition: 'transform 0.2s',
                                '&:hover': {
                                  transform: 'scale(1.05)',
                                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                }
                              }}
                              onClick={() => {
                                setSelectedImage(typeof url === 'string' ? url : '');
                                setOpenImageModal(true);
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                )}
                
                {/* JSON Debug - only show in development */}
                {process.env.NODE_ENV === 'development' && (
                <Box sx={{ mt: 3 }}>
                  <details>
                    <summary>
                      <Typography variant="caption" component="span">
                        Technical Details (Debug)
                      </Typography>
                    </summary>
                    <Box 
                      component="pre" 
                      sx={{ 
                        mt: 1, 
                        p: 2, 
                        bgcolor: 'background.paper', 
                        border: '1px solid', 
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'auto',
                        fontSize: '0.7rem',
                        maxHeight: 300
                      }}
                    >
                      {JSON.stringify(selectedSeal, null, 2)}
                    </Box>
                  </details>
                </Box>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  };

  // Handle image comment changes
  const handleImageCommentChange = (imageKey: string, comment: string) => {
    setImageComments(prev => ({
      ...prev,
      [imageKey]: comment
    }));
  };

  // Filter out system fields from trip details display
  const isSystemField = (key: string) => {
    const systemFields = ['createdById', 'id', 'companyId', 'status', 'createdAt', 'updatedAt'];
    return systemFields.includes(key);
  };

  const theme = useTheme();

  // Add print styles to head
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = printStyles;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  if (authStatus === "loading" || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="error" sx={{ mb: 3, width: "100%" }}>
            {error}
          </Alert>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="info" sx={{ mb: 3, width: "100%" }}>
            Session not found
          </Alert>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>
      </Container>
    );
  }

  // Modified Verification Box for Guards
  if (canVerify) {
    return (
      <Container maxWidth="md" sx={{ pb: { xs: 10, sm: 6 } }}> {/* Added bottom padding for better mobile scrolling */}
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                  {isGuard ? "Trip Details" : "Session Details"}
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  {canEdit && session.status !== SessionStatus.COMPLETED && (
                    <Button
                      component={Link}
                      href={`/dashboard/sessions/${sessionId}/edit`}
                      startIcon={<Edit />}
                      variant="outlined"
                      size="small"
                    >
                      Edit
                    </Button>
                  )}
                  <Chip 
                    label={session.status} 
                    color={getStatusColor(session.status)} size="medium"
                  />
                </Box>
                    </Box>
              
              {/* Basic information */}
              <Box mb={3}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <LocationOn color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body1">
                  <strong>Source:</strong> {session.tripDetails?.source || session.source || "LoadingSite"}
                      </Typography>
                    </Box>
                    </Box>
                  <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <LocationOn color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body1">
                  <strong>Destination:</strong> {session.tripDetails?.destination || session.destination || "ReceiverPartyName"}
                      </Typography>
                    </Box>
                    </Box>
                  <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <AccessTime color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body1">
                        <strong>Created:</strong> {formatDate(session.createdAt)}
                      </Typography>
                    </Box>
                    </Box>
                  <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <BusinessCenter color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body1">
                        <strong>Company:</strong> {session.company?.name || "N/A"}
                      </Typography>
                    </Box>
                    </Box>
                  <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <Person color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body1">
                        <strong>Operator Created:</strong> {session.createdBy?.name || "N/A"}
                      </Typography>
                </Box>
                    </Box>
                    <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      <DirectionsCar color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body1">
                        <strong>Vehicle Number:</strong> {session.tripDetails?.vehicleNumber || "N/A"}
                      </Typography>
                    </Box>
                    </Box>
                </Box>
                    </Box>
            </Paper>

            {/* Verification Results */}
            {renderVerificationResults()}

            {/* Comment section - moved after verification results */}
            <CommentSection sessionId={sessionId} />
          </>
        )}

        {/* Verification Form */}
        {verificationFormOpen && (
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            {/* Tab Navigation */}
            <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', mb: 3, overflowX: 'auto' }}>
              {verificationTabs.map((label, index) => (
                <Button
                  key={index}
                  variant={activeTab === index ? "contained" : "text"}
                  onClick={() => setActiveTab(index)}
                  sx={{ 
                    minWidth: 'unset',
                    px: 2,
                    py: 1,
                    borderRadius: 0,
                    borderBottom: activeTab === index ? '2px solid' : 'none',
                    backgroundColor: activeTab === index ? 'primary.main' : 'transparent',
                    color: activeTab === index ? 'primary.contrastText' : 'text.primary',
                    '&:hover': {
                      backgroundColor: activeTab === index ? 'primary.dark' : 'action.hover',
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>
            
            {/* Tab Content */}
            {activeTab === 0 && renderTripDetailsVerification()}
                {activeTab === 1 && renderSessionInfoVerification()}
                {activeTab === 2 && renderSealVerification()}
                {activeTab === 3 && renderDriverDetailsVerification()}
                {activeTab === 4 && renderImageVerification()}

            {/* Navigation and Verification Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveTab(prev => Math.max(0, prev - 1))}
                disabled={activeTab === 0}
                startIcon={<ArrowBack />}
              >
                Previous
              </Button>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={openConfirmDialog}
                  startIcon={<VerifiedUser />}
                  sx={{ ml: 2 }}
                >
                  Complete Verification
                </Button>
              </Box>
              <Button
                variant="outlined"
                onClick={() => setActiveTab(prev => Math.min(verificationTabs.length - 1, prev + 1))}
                disabled={activeTab === verificationTabs.length - 1}
                endIcon={<ArrowForward />}
              >
                Next
              </Button>
            </Box>
          </Paper>
        )}

        {/* Verification Results */}
        {verificationResults && renderVerificationResults()}

        {/* Verification Button */}
        {!verificationFormOpen && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: { xs: 4, sm: 3 } }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Lock />}
              onClick={startVerification}
              sx={{ py: { xs: 1.5, sm: 1 } }} /* Increased tap target size on mobile */
            >
              Start Trip Verification
            </Button>
          </Box>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onClose={closeConfirmDialog}>
          <DialogTitle>Confirm Verification</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to verify this seal? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirmDialog} color="primary">
              Cancel
            </Button>
            <Button onClick={handleVerifySeal} color="primary" disabled={verifying}>
              {verifying ? "Verifying..." : "Verify"}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Image Modal */}
        <Dialog 
          open={openImageModal} 
          onClose={() => setOpenImageModal(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogContent sx={{ p: 0, position: 'relative' }}>
            <IconButton 
              onClick={() => setOpenImageModal(false)}
              sx={{ 
                position: 'absolute', 
                top: 8, 
                right: 8, 
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.7)',
                }
              }}
            >
              <Close />
            </IconButton>
            <Box
              component="img"
              src={selectedImage}
              alt="Full size image"
              sx={{
                width: '100%',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          </DialogContent>
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

  return (
    <Container maxWidth="md" sx={{ pb: { xs: 10, sm: 6 } }}> {/* Added bottom padding for better mobile scrolling */}
      <Box mb={3}>
        <Link href="/dashboard/sessions" passHref style={{ textDecoration: 'none' }}>
        <Button
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
        </Link>
      </Box>

      {/* Main content */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Session Details
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            {canEdit && session.status !== SessionStatus.COMPLETED && (
              <Link href={`/dashboard/sessions/${sessionId}/edit`} passHref style={{ textDecoration: 'none' }}>
              <Button
                startIcon={<Edit />}
                variant="outlined"
                size="small"
              >
                Edit
              </Button>
              </Link>
            )}
            <Chip 
              label={session.status} 
              color={getStatusColor(session.status)} size="medium"
            />
          </Box>
                    </Box>

        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <LocationOn color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Source:</strong> {session.source || "N/A"}
                </Typography>
              </Box>
                    </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <LocationOn color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Destination:</strong> {session.destination || "N/A"}
                </Typography>
              </Box>
                    </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <AccessTime color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Created:</strong> {formatDate(session.createdAt)}
                </Typography>
              </Box>
                    </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <BusinessCenter color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Company:</strong> {session.company?.name || "N/A"}
                </Typography>
              </Box>
                    </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <Person color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Operator Created:</strong> {session.createdBy?.name || "N/A"}
                </Typography>
              </Box>
                    </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <DirectionsCar color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Vehicle Number:</strong> {session.tripDetails?.vehicleNumber || "N/A"}
                </Typography>
              </Box>
                    </Box>
          </Box>
                    </Box>

        {session.tripDetails && Object.keys(session.tripDetails).length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Trip Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* Ensure all required fields are displayed, even if some have to be taken from different sources */}
              {Object.entries(session.tripDetails).map(([key, value]) => {
                // Skip source and destination as they're already shown in Basic Information
                // Also skip system fields
                if (key === 'source' || 
                    key === 'destination' || 
                    key === 'loadingSite' || 
                    key === 'cargoType' || 
                    key === 'numberOfPackages' ||
                    isSystemField(key)) {
                  return null;
                }
                
                // Skip null/undefined values
                if (value === null || value === undefined) {
                  return null;
                }
                
                // Format specific fields
                let displayValue = String(value);
                if (key === 'freight' || key === 'grossWeight' || key === 'tareWeight' || key === 'netMaterialWeight') {
                  displayValue = `${displayValue} kg`;
                }
                
                return (
                  <Box key={key} sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Typography variant="body1">
                      <strong>{getFieldLabel(key)}:</strong> {displayValue}
                    </Typography>
                  </Box>
                );
              })}
              
              {/* Explicitly add the critical fields that need to be displayed */}
              <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                <Typography variant="body1">
                  <strong>Loading Site:</strong> {session.tripDetails.loadingSite || "N/A"}
                </Typography>
              </Box>
              
              <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                <Typography variant="body1">
                  <strong>Cargo Type:</strong> {session.tripDetails.cargoType || session.tripDetails.materialName || "N/A"}
                </Typography>
              </Box>
              
              <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                <Typography variant="body1">
                  <strong>Number of Packages:</strong> {session.tripDetails.numberOfPackages || "N/A"}
                </Typography>
              </Box>
                    </Box>
          </Box>
        )}

                {/* Show seal information only if operator-entered seal tags are available */}
        {operatorSeals && operatorSeals.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Seal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              Total Seal Tags: <strong>{operatorSeals.length}</strong>
                </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>No.</TableCell>
                    <TableCell>Tag ID</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Image</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Created By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSeals.map((seal, index) => (
                    <TableRow key={seal.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Box 
                          sx={{ 
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 0.75,
                            bgcolor: 'background.paper',
                            maxWidth: 180,
                            overflow: 'hidden'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'medium' }}>
                            {seal.id}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={seal?.method && typeof seal?.method === 'string' && 
                                 seal?.method.toLowerCase().includes('manual') ? 
                                 'Manually Entered' : 'Digitally Scanned'}
                          color={seal?.method && typeof seal?.method === 'string' && 
                                 seal?.method.toLowerCase().includes('manual') ? 
                                 'secondary' : 'primary'} 
                        />
                      </TableCell>
                      <TableCell>
                        {seal.image ? (
                          <Tooltip title="Click to view image">
                            <Box 
                              component="img" 
                              src={seal.image} 
                              alt={`Seal tag ${seal?.id || "Unknown" || "Unknown"}`}
                              sx={{ 
                                width: 60, 
                                height: 60, 
                                objectFit: 'cover',
                                borderRadius: 1,
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                // Open image in modal
                                if (seal.image) {
                                  setSelectedImage(seal.image);
                                  setOpenImageModal(true);
                                }
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption">No image</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {seal?.timestamp ? formatDate(seal.timestamp) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {session?.createdBy?.name || "OPERATOR"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Show guard seal tags if available */}
        {session.guardSealTags && session.guardSealTags.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Guard Verification Seal Tags
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              Total Guard Seal Tags: <strong>{session.guardSealTags.length}</strong>
            </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>No.</TableCell>
                    <TableCell>Tag ID</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Image</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Verified By</TableCell>
                    <TableCell>Created At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {session.guardSealTags.map((tag, index) => (
                    <TableRow key={tag.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Box 
                          sx={{ 
                            border: '1px solid',
                            borderColor: operatorSeals.some(opSeal => opSeal.id.toLowerCase() === tag.barcode.toLowerCase()) 
                              ? 'success.main' 
                              : 'error.main',
                            borderRadius: 1,
                            p: 0.75,
                            bgcolor: 'background.paper',
                            maxWidth: 180,
                            overflow: 'hidden'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'medium' }}>
                            {tag.barcode}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={tag?.method === 'manual' ? 'Manually Entered' : 'Digitally Scanned'}
                          color={tag?.method === 'manual' ? 'secondary' : 'primary'} 
                        />
                      </TableCell>
                      <TableCell>
                        {tag?.imageData ? (
                          <Tooltip title="Click to view image">
                            <Box 
                              component="img" 
                              src={tag?.imageData}
                              alt={`Guard seal tag ${tag.barcode || "Unknown"}`}
                              sx={{ 
                                width: 60, 
                                height: 60, 
                                objectFit: 'cover',
                                borderRadius: 1,
                                cursor: 'pointer',
                                border: '1px solid #eee'
                              }}
                              onClick={() => {
                                // Open image in modal
                                if (tag?.imageData) {
                                  setSelectedImage(tag?.imageData);
                                  setOpenImageModal(true);
                                }
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption">No image</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={tag.status || 'Verified'} 
                          color={tag.status === 'VERIFIED' || tag.status === 'Verified' || !tag.status ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {tag.verifiedBy ? (
                          <Typography variant="body2">
                            {tag.verifiedBy.name || 'Guard'} 
                          </Typography>
                        ) : (
                          <Typography variant="caption">Unknown</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(tag.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Add All Verification Seals section */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            All Verification Seals
                  </Typography>
          <Divider sx={{ mb: 2 }} />
          {renderAllSeals()}
                </Box>

        {/* Images section - moved before Reports section */}
        {session.images && Object.keys(session.images).some(key => {
          const value = session.images && session.images[key as keyof typeof session.images];
          return !!value;
        }) && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Images
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.driverPicture && (
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Typography variant="subtitle2" gutterBottom>Driver</Typography>
                  <Box
                    component="img" 
                    src={session.images.driverPicture} 
                    alt="Driver" 
                    sx={{ 
                      width: '100%', 
                      maxHeight: '200px', 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'scale(1.03)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }
                    }}
                    onClick={() => {
                      if (session.images?.driverPicture) {
                        setSelectedImage(session.images.driverPicture);
                        setOpenImageModal(true);
                      }
                    }}
                  />
                </Box>
              )}
              {session.images.vehicleNumberPlatePicture && (
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Typography variant="subtitle2" gutterBottom>Number Plate</Typography>
                  <Box
                    component="img" 
                    src={session.images.vehicleNumberPlatePicture} 
                    alt="Vehicle Number Plate" 
                    sx={{ 
                      width: '100%', 
                      maxHeight: '200px', 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'scale(1.03)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }
                    }}
                    onClick={() => {
                      if (session.images?.vehicleNumberPlatePicture) {
                        setSelectedImage(session.images.vehicleNumberPlatePicture);
                        setOpenImageModal(true);
                      }
                    }}
                  />
                </Box>
              )}
              {session.images.gpsImeiPicture && (
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Typography variant="subtitle2" gutterBottom>GPS/IMEI</Typography>
                  <Box
                    component="img" 
                    src={session.images.gpsImeiPicture} 
                    alt="GPS IMEI" 
                    sx={{ 
                      width: '100%', 
                      maxHeight: '200px', 
                      objectFit: 'cover', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'scale(1.03)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }
                    }}
                    onClick={() => {
                      if (session.images?.gpsImeiPicture) {
                        setSelectedImage(session.images.gpsImeiPicture);
                        setOpenImageModal(true);
                      }
                    }}
                  />
                </Box>
              )}
              
              {/* Display all sealing images */}
              {session.images.sealingImages && session.images.sealingImages.length > 0 && (
                <>
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Sealing Images</Typography>
                  </Box>
                  {session.images.sealingImages.map((image, index) => (
                    <Box key={`sealing-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Box
                        component="img" 
                        src={image} 
                        alt={`Sealing ${index + 1 || "Unknown"}`} 
                        sx={{ 
                          width: '100%', 
                          maxHeight: '200px', 
                          objectFit: 'cover', 
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          '&:hover': {
                            transform: 'scale(1.03)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                          }
                        }}
                        onClick={() => {
                          setSelectedImage(image);
                          setOpenImageModal(true);
                        }}
                      />
                    </Box>
                  ))}
                </>
              )}
              
              {/* Display all vehicle images */}
              {session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
                <>
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Vehicle Images</Typography>
                  </Box>
                  {session.images.vehicleImages.map((image, index) => (
                    <Box key={`vehicle-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Box
                        component="img" 
                        src={image} 
                        alt={`Vehicle ${index + 1 || "Unknown"}`} 
                        loading="lazy"
                        onError={(e) => {
                          console.error("Failed to load image:", image);
                          // Apply fallback image or styling on error
                          e.currentTarget.style.background = '#f0f0f0';
                          e.currentTarget.style.display = 'flex';
                          e.currentTarget.style.alignItems = 'center';
                          e.currentTarget.style.justifyContent = 'center';
                          e.currentTarget.style.color = '#666';
                          e.currentTarget.style.fontSize = '12px';
                          e.currentTarget.innerText = 'Image not available';
                        }}
                        sx={{ 
                          width: '100%', 
                          height: '200px', 
                          objectFit: 'cover', 
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          '&:hover': {
                            transform: 'scale(1.03)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                          }
                        }}
                        onClick={() => {
                          setSelectedImage(image);
                          setOpenImageModal(true);
                        }}
                      />
                    </Box>
                  ))}
                </>
              )}
              
              {/* Display all additional images */}
              {session.images.additionalImages && session.images.additionalImages.length > 0 && (
                <>
                  <Box sx={{ width: '100%', mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Additional Images</Typography>
                  </Box>
                  {session.images.additionalImages.map((image, index) => (
                    <Box key={`additional-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Box
                        component="img" 
                        src={image} 
                        alt={`Additional ${index + 1 || "Unknown"}`} 
                        sx={{ 
                          width: '100%', 
                          maxHeight: '200px', 
                          objectFit: 'cover', 
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          '&:hover': {
                            transform: 'scale(1.03)',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                          }
                        }}
                        onClick={() => {
                          setSelectedImage(image);
                          setOpenImageModal(true);
                        }}
                      />
                    </Box>
                  ))}
                </>
              )}
              
              {/* Guard Verification Images - Show if available */}
              {session.seal?.verificationData?.guardImages && 
               Object.keys(session.seal.verificationData.guardImages).length > 0 && (
                <>
                  <Box sx={{ width: '100%', mt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom sx={{ color: 'secondary.main', fontWeight: 'medium' }}>
                      Guard Verification Images
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
            </Box>
                  
                  {/* Display guard verification images by category */}
                  {Object.entries(session.seal.verificationData.guardImages).map(([key, url]) => {
                    if (Array.isArray(url)) {
                      return (
                        <React.Fragment key={key}>
                          <Box sx={{ width: '100%', mt: 2 }}>
                            <Typography variant="body2" gutterBottom sx={{ color: 'text.secondary' }}>
                              {getFieldLabel(key)}
                            </Typography>
                          </Box>
                          {url.map((imageUrl, idx) => (
                            <Box key={`${key}-${idx}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                              <Box
                                component="img" 
                                src={imageUrl as string} 
                                alt={`${getFieldLabel(key)} ${idx + 1 || "Unknown"}`}
                                sx={{ 
                                  width: '100%', 
                                  maxHeight: '200px', 
                                  objectFit: 'cover', 
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  transition: 'transform 0.2s',
                                  '&:hover': {
                                    transform: 'scale(1.03)',
                                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                                  }
                                }}
                                onClick={() => {
                                  setSelectedImage(imageUrl as string);
                                  setOpenImageModal(true);
                                }}
                              />
                            </Box>
                          ))}
                        </React.Fragment>
                      );
                    } else if (typeof url === 'string') {
                      return (
                        <Box key={key} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                            {getFieldLabel(key)}
                          </Typography>
                          <Box 
                            component="img" 
                            src={url} 
                            alt={getFieldLabel(key)}
                            sx={{ 
                              width: '100%', 
                              maxHeight: '200px', 
                              objectFit: 'cover', 
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              '&:hover': {
                                transform: 'scale(1.03)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                              }
                            }}
                            onClick={() => {
                              setSelectedImage(url);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      );
                    }
                    return null;
                  })}
                </>
              )}
            </Box>
                    </Box>
        )}

        {/* Report Download Section - Only shown to authorized users */}
        {canAccessReports && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Reports
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", width: "100%" }}>
              <Button
                variant="contained"
                startIcon={<PictureAsPdf />}
                onClick={() => handleDownloadReport("pdf")}
                disabled={reportLoading !== null}
                fullWidth
                sx={{ 
                  bgcolor: 'error.main', 
                  color: 'white', 
                  '&:hover': { bgcolor: 'error.dark' },
                  py: { xs: 1.5, sm: 1 },
                  fontSize: { xs: '0.9rem', sm: '0.875rem' },
                  maxWidth: { xs: '100%', sm: 250 }
                }}
              >
                {reportLoading === "pdf" ? "Downloading..." : "Download PDF Report"}
              </Button>
              <Button
                variant="contained"
                startIcon={<Description />}
                onClick={() => window.print()}
                fullWidth
                sx={{ 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  '&:hover': { bgcolor: 'primary.dark' },
                  py: { xs: 1.5, sm: 1 },
                  fontSize: { xs: '0.9rem', sm: '0.875rem' },
                  maxWidth: { xs: '100%', sm: 250 }
                }}
              >
                Print this page
              </Button>
            </Box>
                    </Box>
        )}

        {/* Verification Results for completed sessions */}
        {session.status === SessionStatus.COMPLETED && verificationResults && renderVerificationResults()}
      </Paper>

      {/* GUARD Verification Button - Show for GUARD users with IN_PROGRESS sessions */}
      {isGuard && session.status === SessionStatus.IN_PROGRESS && !verificationFormOpen && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: { xs: 4, sm: 3 } }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Lock />}
            onClick={startVerification}
            sx={{ py: { xs: 1.5, sm: 1 } }} /* Increased tap target size on mobile */
          >
            Start Trip Verification
          </Button>
        </Box>
      )}

      {/* Comment section - moved after verification results */}
      <CommentSection sessionId={sessionId} />

      {/* Enhanced Image Modal */}
      <Dialog
        open={openImageModal}
        onClose={() => setOpenImageModal(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogContent sx={{ p: 1, textAlign: 'center', bgcolor: '#000' }}>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage}
              alt="Image preview"
              sx={{
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 100px)',
                objectFit: 'contain'
              }}
              onError={(e) => {
                console.error("Failed to load image in modal:", selectedImage);
                const img = e.target as HTMLImageElement;
                img.src = '/images/image-placeholder.png'; // Fallback image
                img.style.maxWidth = '300px';
                img.style.border = '1px solid #ddd';
                img.style.padding = '20px';
                img.style.background = '#f8f8f8';
              }}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Click outside to close
          </Typography>
          <Button onClick={() => setOpenImageModal(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}