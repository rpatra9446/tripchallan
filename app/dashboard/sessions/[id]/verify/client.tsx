"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  Box, Button, Container, Paper, Typography, Tab, Tabs, 
  Grid, TextField, Chip, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControlLabel, Radio, Table, TableHead, TableBody, TableRow, TableCell,
  InputAdornment, TableContainer, Collapse, Card, CardContent
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Lock, QrCodeScanner, Camera, 
  AddAPhoto, FileUpload, Close, LocationOn, AccessTime,
  Business, Person, DirectionsCar, Info, PhotoCamera,
  Delete, CloudUpload, ExpandLess, ExpandMore, Warning, Done, Create, Cameraswitch
} from '@mui/icons-material';
import ClientSideQrScanner from '@/app/components/ClientSideQrScanner';
import { toast } from 'react-hot-toast';
import { EmployeeSubrole, SessionStatus } from '@/prisma/enums';

// Define types
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
    cargoType?: string;
    numberOfPackages?: number;
    source?: string;
    destination?: string;
  };
  images?: {
    gpsImeiPicture?: string;
    vehicleNumberPlatePicture?: string;
    driverPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
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
};

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

function isSystemField(key: string) {
  const systemFields = ['id', 'createdAt', 'updatedAt', 'sessionId', 'companyId'];
  return systemFields.includes(key);
}

interface TabPanelProps {
  children?: React.ReactNode;
  value: string;
  index: string;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
      style={{ padding: '16px' }}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

// Add this new camera capture component above the SealTagsTab component
const CameraCapture = ({ onCapture, onClose }: { onCapture: (file: File) => void, onClose: () => void }) => {
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const initCamera = useCallback(async () => {
    try {
      setError(null);
      console.log('Initializing camera...');
      
      // Request camera access with environment facing camera preferred
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      
      // Save stream reference for cleanup
      streamRef.current = stream;
      
      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        console.log('Camera initialized successfully');
      } else {
        console.error('Video element not available');
        setError('Camera initialization failed. Please try again.');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Could not access camera. Please ensure camera permissions are granted.');
    }
  }, []);
  
  // Start camera when component mounts
  useEffect(() => {
    initCamera();
    
    // Cleanup function to stop camera when component unmounts
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        console.log('Camera stream stopped');
      }
    };
  }, [initCamera]);
  
  const captureImage = useCallback(() => {
    setCapturing(true);
    
    try {
      if (!videoRef.current || !canvasRef.current) {
        console.error('Video or canvas element not available');
        setError('Could not capture image. Please try again.');
        setCapturing(false);
        return;
      }
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Make sure video is playing and has dimensions
      if (video.readyState !== video.HAVE_ENOUGH_DATA || !video.videoWidth) {
        console.log('Video not ready yet, retrying in 100ms');
        setTimeout(captureImage, 100);
        return;
      }
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw current video frame to canvas
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not initialize canvas context');
        setCapturing(false);
        return;
      }
      
      // Draw the video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to blob/file
      canvas.toBlob((blob) => {
        if (blob) {
          // Create file from blob
          const file = new File(
            [blob], 
            `seal-tag-photo-${Date.now()}.jpg`, 
            { type: 'image/jpeg' }
          );
          
          console.log(`Captured image: ${file.size} bytes`);
          
          // Call the callback with the captured image
          onCapture(file);
          
          // Close camera
          onClose();
        } else {
          setError('Failed to create image. Please try again.');
        }
        setCapturing(false);
      }, 'image/jpeg', 0.85); // Use 85% JPEG quality for good balance
    } catch (error) {
      console.error('Error capturing image:', error);
      setError('An error occurred while capturing the image');
      setCapturing(false);
    }
  }, [onCapture, onClose]);
  
  const handleRetry = () => {
    setError(null);
    initCamera();
  };
  
  return (
    <>
      <DialogTitle>
        Take Photo of Seal Tag
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Try again
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        
        <Box sx={{ position: 'relative', width: '100%' }}>
          <Box
            component="video"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            sx={{
              width: '100%',
              maxHeight: '70vh',
              borderRadius: 1,
              bgcolor: 'black'
            }}
          />
          
          <Box
            component="canvas"
            ref={canvasRef}
            sx={{ display: 'none' }}
          />
        </Box>
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Position the seal tag in the center of the frame
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={captureImage}
          disabled={capturing || !!error}
          startIcon={<PhotoCamera />}
        >
          {capturing ? 'Capturing...' : 'Capture Photo'}
        </Button>
      </DialogActions>
    </>
  );
};

export default function VerifyClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data: authSession } = useSession();
  
  // Core state
  const [session, setSession] = useState<SessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Verification state
  const [verificationFields, setVerificationFields] = useState<Record<string, any>>({});
  const [guardScannedSeals, setGuardScannedSeals] = useState<Array<any>>([]);
  const [operatorSeals, setOperatorSeals] = useState<Array<{id: string, method?: string, timestamp?: string, imageUrl?: string | null, imageData?: string | null}>>([]);
  const [sealComparison, setSealComparison] = useState<{matched: string[], mismatched: string[]}>({
    matched: [], mismatched: []
  });
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  // Updated to support 4 tabs matching OPERATOR's structure
  const [tabValue, setTabValue] = useState<string>('loadingDetails');
  
  const [guardImages, setGuardImages] = useState<Record<string, any>>({});
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  const [openImageModal, setOpenImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  
  // Track verification status for each tab section
  const [loadingDetailsVerified, setLoadingDetailsVerified] = useState(false);
  const [driverDetailsVerified, setDriverDetailsVerified] = useState(false);
  const [sealTagsVerified, setSealTagsVerified] = useState(false);
  const [imagesVerified, setImagesVerified] = useState(false);
  
  // 2FA dialog state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [guardPassword, setGuardPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Load session data on mount
  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails();
    }
  }, [sessionId]);

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
          timestamp: tag.createdAt,
          imageUrl: tag.imageUrl || null,
          imageData: tag.imageData || null
        })));
      }
      
      // Initialize verification fields
      initializeVerificationFields(data);
      
      // Fetch guard seal tags
      fetchGuardSealTags();
      
    } catch (err) {
      console.error("Error fetching session:", err);
      setError(`Failed to load session: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Initialize verification fields
  const initializeVerificationFields = (sessionData: SessionType) => {
    if (!sessionData) return;
    
    const fields: Record<string, any> = {};
    
    // Add trip details fields for verification
    if (sessionData.tripDetails) {
      Object.entries(sessionData.tripDetails).forEach(([key, value]) => {
        if (value !== undefined && value !== null && !isSystemField(key)) {
          fields[key] = {
            value,
            verified: false
          };
        }
      });
    }
    
    // Add image verification fields
    if (sessionData.images) {
      if (sessionData.images.vehicleNumberPlatePicture) {
        fields['vehicleNumberPlatePicture'] = {
          value: sessionData.images.vehicleNumberPlatePicture,
          verified: false
        };
      }
      
      if (sessionData.images.driverPicture) {
        fields['driverPicture'] = {
          value: sessionData.images.driverPicture,
          verified: false
        };
      }
      
      if (sessionData.images.gpsImeiPicture) {
        fields['gpsImeiPicture'] = {
          value: sessionData.images.gpsImeiPicture,
          verified: false
        };
      }
      
      // Vehicle images
      if (sessionData.images.vehicleImages) {
        sessionData.images.vehicleImages.forEach((url, index) => {
          fields[`vehicleImages-${index}`] = {
            value: url,
            verified: false
          };
        });
      }
    }
    
    setVerificationFields(fields);
  };

  // Fetch guard seal tags
  const fetchGuardSealTags = async () => {
    if (!sessionId) return;
    
    try {
      console.log("Fetching guard verification sessions");
      const response = await fetch(`/api/sessions/${sessionId}/guardSealTags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch guard seal tags: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Guard seal tags received:", data);
      
      // Fetch operator seal tag images from activity logs
      console.log("Fetching operator seal tag images from activity logs");
      const activityResponse = await fetch(`/api/sessions/${sessionId}/seals`);
      
      if (!activityResponse.ok) {
        throw new Error(`Failed to fetch operator seal tag images: ${activityResponse.status}`);
      }
      
      const activityData = await activityResponse.json();
      console.log("Operator seal data received:", activityData);
      
      // Create a map of operator seal tags with their methods and images
      const operatorSealMap = new Map();
      activityData.forEach((seal: any) => {
        if (seal.type === 'tag') {
          operatorSealMap.set(seal.barcode, {
            method: seal.method,
            imageData: seal.imageData
          });
        }
      });
      
      // Process and set guard scanned seals
      if (data && Array.isArray(data)) {
        const processedSeals = data.map((tag: any) => {
          const operatorData = operatorSealMap.get(tag.barcode);
          return {
            id: tag.barcode,
            method: tag.method,
            image: tag.imageData || null,
            imagePreview: tag.imageData || null,
            timestamp: tag.createdAt,
            verified: false, // Will be updated during comparison
            operatorMethod: operatorData?.method || null,
            operatorImage: operatorData?.imageData || null
          };
        });
        
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
    if (!sessionId || !barcodeData.trim()) {
      setScanError("Please enter a valid seal tag barcode");
      return;
    }
    
    setScanError("");
    
    try {
      // Check if already scanned
      if (guardScannedSeals.some(seal => seal.id === barcodeData)) {
        toast.error("This seal has already been scanned");
        return;
      }

      // Check if image is provided for both methods
      if (!imageFile) {
        toast.error("Image is required for seal tag verification");
        return;
      }

      // Prepare image data if provided
      let imageData = null;
      if (imageFile) {
        imageData = await processImageForUpload(imageFile);
      }
      
      // Send to API
      const response = await fetch(`/api/sessions/${sessionId}/guardSealTags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: barcodeData,
          method,
          imageData,
          timestamp: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to register seal tag: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add to scanned seals
      const newSeal = {
        id: barcodeData,
        method,
        image: imageData,
        imagePreview: imageData,
        timestamp: new Date().toISOString(),
        verified: operatorSeals.some(seal => seal.id === barcodeData)
      };
      
      setGuardScannedSeals(prev => [...prev, newSeal]);
      updateSealComparison([...guardScannedSeals, newSeal]);
      
      // Clear input
      setScanInput("");
      
      toast.success("Seal tag scanned successfully!");
    } catch (error) {
      console.error("Error registering seal tag:", error);
      toast.error(`Failed to register seal tag: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Verify a field
  const verifyField = (field: string) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        verified: !prev[field]?.verified // Make radio button toggleable
      }
    }));
  };

  // Verify an image
  const verifyImage = (imageKey: string) => {
    verifyField(imageKey);
  };

  // Verify all fields
  const verifyAllFields = () => {
    const updated = { ...verificationFields };
    Object.keys(updated).forEach(field => {
      updated[field] = {
        ...updated[field],
        verified: true
      };
    });
    setVerificationFields(updated);
  };

  // Calculate verification stats
  const getVerificationStats = () => {
    const totalFields = Object.keys(verificationFields).length;
    const verifiedFields = Object.values(verificationFields).filter(field => field.verified).length;
    const percentage = totalFields > 0 ? Math.floor((verifiedFields / totalFields) * 100) : 0;
    
    return {
      total: totalFields,
      verified: verifiedFields,
      percentage
    };
  };

  // Complete verification process (now called after password check)
  const handleVerifySeal = async () => {
    if (!sessionId || !session) return;
    if (!authSession?.user || authSession?.user?.subrole !== EmployeeSubrole.GUARD) {
      toast.error('Only Guards can complete verification');
      return;
    }
    setPasswordDialogOpen(true);
  };

  // Called after password is entered and confirmed
  const handlePasswordConfirm = async () => {
    setPasswordError('');
    setVerifying(true);
    // Use API to verify password for current user
    try {
      const resp = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: guardPassword })
      });
      const data = await resp.json();
      if (!resp.ok || !data.verified) {
        setPasswordError('Incorrect password. Please try again.');
        setVerifying(false);
        return;
      }
      // Password verified, proceed with verification
      const verificationData = {
        sessionId,
        fieldVerifications: verificationFields,
        guardImages,
        imageComments,
        sealTags: {
          matched: sealComparison.matched,
          mismatched: sealComparison.mismatched,
          operator: operatorSeals.map(seal => seal.id),
          guard: guardScannedSeals.map(seal => seal.id),
          guardSealData: guardScannedSeals
        },
        allMatch: sealComparison.mismatched.length === 0 && sealComparison.matched.length > 0
      };
      const response = await fetch(`/api/sessions/${sessionId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationData),
      });
      if (!response.ok) throw new Error(`Failed to complete verification: ${response.status}`);
      toast.success('Verification completed successfully!');
      setPasswordDialogOpen(false);
      setGuardPassword('');
      setTimeout(() => { router.push('/dashboard/sessions'); }, 2000);
    } catch (error) {
      toast.error('Failed to complete verification. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  // Handle going back
  const handleBack = () => {
    router.push(`/dashboard/sessions/${sessionId}`);
  };

  // Component for Loading Details Tab
  const LoadingDetailsTab = ({
    session,
    verificationFields,
    setVerificationFields,
    setLoadingDetailsVerified
  }: {
    session: SessionType;
    verificationFields: Record<string, any>;
    setVerificationFields: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setLoadingDetailsVerified: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    // Add state for comments
    const [fieldComments, setFieldComments] = useState<Record<string, string>>({});

    // Handle verifying a loading detail field
    const verifyField = (field: string) => {
      setVerificationFields(prev => ({
        ...prev,
        [field]: { 
          verified: !prev[field]?.verified, 
          timestamp: new Date().toISOString(),
          comment: fieldComments[field] || ''
        }
      }));
    };

    // Handle comment changes
    const handleCommentChange = (field: string, comment: string) => {
      setFieldComments(prev => ({
        ...prev,
        [field]: comment
      }));
      
      // Update the verification field if already verified
      if (verificationFields[field]?.verified) {
        setVerificationFields(prev => ({
          ...prev,
          [field]: {
            ...prev[field],
            comment
          }
        }));
      }
    };

    // Check if all loading detail fields are verified
    useEffect(() => {
      if (!session.tripDetails) return;
      
      const loadingDetailFields = [
        'transporterName', 'materialName', 'receiverPartyName', 'vehicleNumber',
        'registrationCertificate', 'gpsImeiNumber', 'cargoType', 'loadingSite', 
        'source', 'destination', 'loaderName', 'challanRoyaltyNumber', 'doNumber', 
        'freight', 'qualityOfMaterials', 'numberOfPackages', 'tpNumber', 
        'grossWeight', 'tareWeight', 'netMaterialWeight', 'loaderMobileNumber'
      ];
      
      const allVerified = loadingDetailFields.every(field => 
        !session.tripDetails?.[field as keyof typeof session.tripDetails] || 
        verificationFields[field]?.verified
      );
      
      setLoadingDetailsVerified(allVerified);
    }, [session, verificationFields, setLoadingDetailsVerified]);

    // Define the field display data
    const fieldDisplayData = [
      { field: 'transporterName', label: 'Transporter Name' },
      { field: 'materialName', label: 'Material Name' },
      { field: 'receiverPartyName', label: 'Receiver Party Name' },
      { field: 'vehicleNumber', label: 'Vehicle Number' },
      { field: 'registrationCertificate', label: 'Registration Certificate' },
      { field: 'gpsImeiNumber', label: 'GPS IMEI Number' },
      { field: 'cargoType', label: 'Cargo Type' },
      { field: 'qualityOfMaterials', label: 'Quality of Materials' },
      { field: 'numberOfPackages', label: 'Number of Packages' },
      { field: 'loadingSite', label: 'Loading Site' },
      { field: 'source', label: 'Source' },
      { field: 'destination', label: 'Destination' },
      { field: 'loaderName', label: 'Loader Name' },
      { field: 'loaderMobileNumber', label: 'Loader Mobile Number' },
      { field: 'challanRoyaltyNumber', label: 'Challan Royalty Number' },
      { field: 'doNumber', label: 'DO Number' },
      { field: 'freight', label: 'Freight' },
      { field: 'tpNumber', label: 'TP Number' },
      { field: 'grossWeight', label: 'Gross Weight (kg)' },
      { field: 'tareWeight', label: 'Tare Weight (kg)' },
      { field: 'netMaterialWeight', label: 'Net Material Weight (kg)' }
    ];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Loading Details Verification
        </Typography>
        
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold' } }}>
                <TableCell>Field Name</TableCell>
                <TableCell>Field Value</TableCell>
                <TableCell align="center">Verification</TableCell>
                <TableCell>Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fieldDisplayData.map(({ field, label }) => {
              const value = session.tripDetails?.[field as keyof typeof session.tripDetails];
              if (value === undefined || value === null) return null;
              
              return (
                <TableRow key={field} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                    <TableCell sx={{ 
                      fontWeight: 'medium',
                      whiteSpace: { xs: 'normal', sm: 'nowrap' },
                      minWidth: { xs: '100px', sm: '120px' }
                    }}>
                      {label}
                    </TableCell>
                    <TableCell sx={{ 
                      whiteSpace: { xs: 'normal', sm: 'nowrap' },
                      minWidth: { xs: '80px', sm: '100px' }
                    }}>
                      {field === 'freight' ? `₹${value}` : value.toString()}
                    </TableCell>
                    <TableCell align="center" sx={{ 
                      minWidth: { xs: '80px', sm: '110px' }
                    }}>
                    <FormControlLabel
                      control={
                        <Radio
                          checked={!!verificationFields[field]?.verified}
                          onChange={() => verifyField(field)}
                          color="success"
                            size="small"
                        />
                      }
                        label={<Typography variant="body2">Verified</Typography>}
                      sx={{ m: 0 }}
                    />
                  </TableCell>
                    <TableCell sx={{
                      minWidth: { xs: '120px', sm: '160px' }
                    }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add verification"
                      value={fieldComments[field] || ''}
                      onChange={(e) => handleCommentChange(field, e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              );
            }).filter(Boolean)}
          </TableBody>
        </Table>
        </TableContainer>
      </Box>
    );
  };

  // Component for Driver Details Tab
  const DriverDetailsTab = ({
    session,
    verificationFields,
    setVerificationFields,
    setDriverDetailsVerified
  }: {
    session: SessionType;
    verificationFields: Record<string, any>;
    setVerificationFields: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    setDriverDetailsVerified: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    // Add state for comments
    const [fieldComments, setFieldComments] = useState<Record<string, string>>({});

    // Handle verifying a driver detail field
    const verifyField = (field: string) => {
      setVerificationFields(prev => ({
        ...prev,
        [field]: { 
          verified: !prev[field]?.verified, 
          timestamp: new Date().toISOString(),
          comment: fieldComments[field] || ''
        }
      }));
    };

    // Handle comment changes
    const handleCommentChange = (field: string, comment: string) => {
      setFieldComments(prev => ({
        ...prev,
        [field]: comment
      }));
      
      // Update the verification field if already verified
      if (verificationFields[field]?.verified) {
        setVerificationFields(prev => ({
          ...prev,
          [field]: {
            ...prev[field],
            comment
          }
        }));
      }
    };

    // Check if all driver detail fields are verified
    useEffect(() => {
      if (!session.tripDetails) return;
      
      const driverDetailFields = [
        'driverName', 'driverContactNumber', 'driverLicense', 'driverPicture'
      ];
      
      const allVerified = driverDetailFields.every(field => {
        if (field === 'driverPicture') {
          return !session.images?.driverPicture || verificationFields[field]?.verified;
        }
        return !session.tripDetails?.[field as keyof typeof session.tripDetails] || 
          verificationFields[field]?.verified;
      });
      
      setDriverDetailsVerified(allVerified);
    }, [session, verificationFields, setDriverDetailsVerified]);

    // Define the field display data
    const fieldDisplayData = [
      { field: 'driverName', label: 'Driver Name' },
      { field: 'driverContactNumber', label: 'Driver Contact Number' },
      { field: 'driverLicense', label: 'Driver License' },
    ];

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Driver Details Verification
        </Typography>
        
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table size="small">
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold' } }}>
                <TableCell>Field Name</TableCell>
                <TableCell>Field Value</TableCell>
                <TableCell align="center">Verification</TableCell>
                <TableCell>Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
              {/* Driver Name */}
              {session.tripDetails?.driverName && (
                <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                  <TableCell sx={{ 
                    fontWeight: 'medium',
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    minWidth: { xs: '100px', sm: '120px' }
                  }}>
                    Driver Name
                  </TableCell>
                  <TableCell sx={{ 
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    minWidth: { xs: '80px', sm: '100px' }
                  }}>
                    {session.tripDetails.driverName}
                  </TableCell>
                  <TableCell align="center" sx={{ 
                    minWidth: { xs: '80px', sm: '110px' }
                  }}>
                    <FormControlLabel
                      control={
                        <Radio
                          checked={!!verificationFields['driverName']?.verified}
                          onChange={() => verifyField('driverName')}
                          color="success"
                          size="small"
                        />
                      }
                      label={<Typography variant="body2">Verified</Typography>}
                      sx={{ m: 0 }}
                    />
                  </TableCell>
                  <TableCell sx={{
                    minWidth: { xs: '120px', sm: '160px' }
                  }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add verification"
                      value={fieldComments['driverName'] || ''}
                      onChange={(e) => handleCommentChange('driverName', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              )}
              
              {/* Driver Contact Number */}
              {session.tripDetails?.driverContactNumber && (
                <TableRow>
                  <TableCell sx={{ 
                    fontWeight: 'medium',
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    minWidth: { xs: '100px', sm: '120px' }
                  }}>
                    Driver Contact Number
                  </TableCell>
                  <TableCell sx={{ 
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    minWidth: { xs: '80px', sm: '100px' }
                  }}>
                    {session.tripDetails.driverContactNumber}
                  </TableCell>
                  <TableCell align="center" sx={{ 
                    minWidth: { xs: '80px', sm: '110px' }
                  }}>
                    <FormControlLabel
                      control={
                        <Radio
                          checked={!!verificationFields['driverContactNumber']?.verified}
                          onChange={() => verifyField('driverContactNumber')}
                          color="success"
                          size="small"
                        />
                      }
                      label={<Typography variant="body2">Verified</Typography>}
                      sx={{ m: 0 }}
                    />
                  </TableCell>
                  <TableCell sx={{
                    minWidth: { xs: '120px', sm: '160px' }
                  }}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Add verification"
                      value={fieldComments['driverContactNumber'] || ''}
                      onChange={(e) => handleCommentChange('driverContactNumber', e.target.value)}
                    />
                  </TableCell>
                </TableRow>
              )}
            
              {/* Driver License */}
              {session.tripDetails?.driverLicense && (
              <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                  <TableCell sx={{ 
                    fontWeight: 'medium',
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    minWidth: { xs: '100px', sm: '120px' }
                  }}>
                    Driver License
                </TableCell>
                  <TableCell sx={{ 
                    whiteSpace: { xs: 'normal', sm: 'nowrap' },
                    minWidth: { xs: '80px', sm: '100px' }
                  }}>
                    {session.tripDetails.driverLicense}
                  </TableCell>
                  <TableCell align="center" sx={{ 
                    minWidth: { xs: '80px', sm: '110px' }
                  }}>
                  <FormControlLabel
                    control={
                      <Radio
                          checked={!!verificationFields['driverLicense']?.verified}
                          onChange={() => verifyField('driverLicense')}
                        color="success"
                          size="small"
                      />
                    }
                      label={<Typography variant="body2">Verified</Typography>}
                    sx={{ m: 0 }}
                  />
                </TableCell>
                  <TableCell sx={{
                    minWidth: { xs: '120px', sm: '160px' }
                  }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add verification"
                      value={fieldComments['driverLicense'] || ''}
                      onChange={(e) => handleCommentChange('driverLicense', e.target.value)}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </TableContainer>
      </Box>
    );
  };

  // Component for Seal Tags Tab
  const SealTagsTab = ({
    session,
    operatorSeals,
    guardScannedSeals,
    sealComparison,
    scanInput,
    setScanInput,
    scanError,
    handleScanComplete,
    setSealTagsVerified
  }: {
    session: SessionType;
    operatorSeals: Array<{id: string, method?: string, timestamp?: string, imageUrl?: string | null, imageData?: string | null}>;
    guardScannedSeals: Array<any>;
    sealComparison: {matched: string[], mismatched: string[]};
    scanInput: string;
    setScanInput: React.Dispatch<React.SetStateAction<string>>;
    scanError: string;
    handleScanComplete: (barcodeData: string, method: string, imageFile?: File) => Promise<void>;
    setSealTagsVerified: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    const [sealTagImage, setSealTagImage] = useState<File | null>(null);
    const [expandedSeals, setExpandedSeals] = useState<Record<string, boolean>>({});
    const [openQrScanner, setOpenQrScanner] = useState(false);
    const [error, setError] = useState("");
    // Create a ref for the text input to manage focus
    const inputRef = useRef<HTMLInputElement>(null);
    // Add state for camera dialog
    const [cameraDialogOpen, setCameraDialogOpen] = useState(false);

    // Add useEffect to help maintain focus on the input field
    useEffect(() => {
      // Focus input on component mount
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, []); // Empty dependency array means this runs once on mount

    // Toggle expanded seal details
    const toggleSealDetails = (sealId: string) => {
      if (expandedSeals[sealId]) {
        setExpandedSeals({ ...expandedSeals, [sealId]: false });
      } else {
        setExpandedSeals({ ...expandedSeals, [sealId]: true });
      }
    };

    // Handle input change without losing focus
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setScanInput(newValue);
      if (error) setError("");
      // No need to explicitly refocus here, as React should maintain focus on the input
    };

    // Render image preview
    const renderImagePreview = (file: File | null) => {
      if (!file) return null;
      
      return (
        <Box sx={{ mt: 1, mb: 2 }}>
          <Typography variant="subtitle2">Image Preview:</Typography>
          <Box
            component="img"
            src={URL.createObjectURL(file)}
            alt="Seal Tag Preview"
            sx={{ 
              maxWidth: '100%', 
              maxHeight: '150px',
              borderRadius: 1,
              border: '1px solid #ccc'
            }}
          />
        </Box>
      );
    };

    // Get all seal IDs from both operator and guard
    const getAllSeals = () => {
      const guardIds = guardScannedSeals.map(seal => seal.id);
      const operatorIds = operatorSeals.map(seal => seal.id);
      return [...new Set([...operatorIds, ...guardIds])];
    };

    // Delete a guard seal
    const deleteGuardSeal = async (sealId: string) => {
      if (!confirm("Are you sure you want to delete this seal tag?")) {
        return;
      }
      
      const updatedSeals = guardScannedSeals.filter(seal => seal.id !== sealId);
      setGuardScannedSeals(updatedSeals);
      updateSealComparison(updatedSeals);
    };

    // Update verification status based on matched seals
    useEffect(() => {
      const operatorIds = operatorSeals.map(seal => seal.id);
      const guardIds = guardScannedSeals.map(seal => seal.id);
      
      // Check if all operator seals have been scanned by guard
      const allSealsVerified = operatorIds.every(id => guardIds.includes(id));
      setSealTagsVerified(allSealsVerified);
    }, [operatorSeals, guardScannedSeals, setSealTagsVerified]);

    // Handler for camera capture
    const handleImageCapture = useCallback((file: File) => {
      console.log('Image captured:', file.name, file.size, 'bytes');
      
      // Set the captured image to state
      setSealTagImage(file);
      
      // Show feedback to user
      toast.success('Image captured successfully');
    }, []);

    return (
      <Box>
        <Typography variant="h6" component="h2">
          Seal Tags Verification
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>
        
        {/* Scan or Enter Seal Tag Section - Updated to match Operator UI */}
        <Box sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ width: { xs: '100%', md: '47%' } }}>
            <Typography variant="subtitle1" gutterBottom>
              Scan QR/Barcode
            </Typography>
            <Box sx={{ height: '56px' }}>
              <ClientSideQrScanner
                onScanWithImage={(data, imageFile) => {
                  handleScanComplete(data, 'digital', imageFile);
                }}
                buttonText="Scan QR Code"
                scannerTitle="Scan Seal Tag"
                buttonVariant="outlined"
              />
            </Box>
          </Box>
          
          <Box sx={{ width: { xs: '100%', md: '47%' } }}>
            <Typography variant="subtitle1" gutterBottom>
              Manual Entry
            </Typography>
            <TextField
              fullWidth
              label="Seal Tag ID"
              value={scanInput}
              onChange={handleInputChange}
              error={!!scanError || !!error}
              helperText={scanError || error}
              inputRef={inputRef}
              inputProps={{
                autoCapitalize: "off",
                autoCorrect: "off",
                spellCheck: "false",
                autoComplete: "off"
              }}
              // Add onFocus to ensure input gets and stays focused
              onFocus={(e) => {
                // Prevent default behavior that might cause focus loss
                e.preventDefault();
              }}
              // Add onBlur to bring focus back to the input unless user explicitly clicks elsewhere
              onBlur={(e) => {
                // Check if related target is not a button or another interactive element
                const relatedTarget = e.relatedTarget as HTMLElement;
                if (!relatedTarget || 
                    (relatedTarget.tagName !== 'BUTTON' && 
                     !relatedTarget.classList.contains('MuiButton-root'))) {
                  // Small delay to allow other click handlers to execute first
                  setTimeout(() => {
                    if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }, 10);
                }
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button 
                      onClick={() => {
                        if (sealTagImage) {
                          handleScanComplete(scanInput, 'manual', sealTagImage);
                          setSealTagImage(null);
                          setTimeout(() => {
                            if (inputRef.current) {
                              inputRef.current.focus();
                            }
                          }, 0);
                        } else {
                          setError("Please attach an image of the seal tag");
                          // Ensure focus returns to input field even when showing error
                          setTimeout(() => {
                            if (inputRef.current) {
                              inputRef.current.focus();
                            }
                          }, 0);
                        }
                      }}
                      disabled={!scanInput}
                    >
                      Add
                    </Button>
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (scanInput && sealTagImage) {
                    handleScanComplete(scanInput, 'manual', sealTagImage);
                    setSealTagImage(null);
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 0);
                  } else if (!sealTagImage) {
                    setError("Please attach an image of the seal tag");
                    // Ensure focus returns to input field even when showing error
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 0);
                  }
                }
              }}
            />
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCamera />}
                onClick={() => setCameraDialogOpen(true)}
                sx={{ 
                  bgcolor: sealTagImage ? 'rgba(76, 175, 80, 0.08)' : 'inherit',
                  borderColor: sealTagImage ? 'success.main' : 'inherit',
                  '&:hover': {
                    bgcolor: sealTagImage ? 'rgba(76, 175, 80, 0.12)' : 'rgba(0, 0, 0, 0.04)',
                  }
                }}
              >
                {sealTagImage ? 'Image Captured' : 'Take Photo'}
              </Button>

              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
              >
                Upload
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onClick={(e) => {
                    // Reset the input value to ensure onChange is always triggered
                    e.currentTarget.value = '';
                    console.log('Upload input clicked');
                  }}
                  onChange={(e) => {
                    console.log('Upload input onChange triggered');
                    if (e.target.files && e.target.files[0]) {
                      try {
                        const file = e.target.files[0];
                        console.log(`File uploaded: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
                        
                        // Create a new FileReader to properly read the file data
                        const reader = new FileReader();
                        
                        // Set up onload handler that will run when file is successfully read
                        reader.onload = function(fileEvent) {
                          console.log('File successfully loaded');
                          
                          // Create a new "stable" File object that won't be affected by browser garbage collection
                          const stableFile = new File(
                            [file], 
                            file.name, 
                            { type: file.type, lastModified: file.lastModified }
                          );
                          
                          // Set the stable file to state
                          setSealTagImage(stableFile);
                          
                          // Show feedback to user
                          toast.success(`Image uploaded successfully`);
                        };
                        
                        // Set up error handler
                        reader.onerror = function(error) {
                          console.error('Error reading file:', error);
                          toast.error('Failed to process image. Please try again.');
                        };
                        
                        // Start reading the file as data URL to load it into memory
                        reader.readAsDataURL(file);
                      } catch (error) {
                        console.error('Error uploading image:', error);
                        toast.error('Failed to upload image. Please try again.');
                      }
                    } else {
                      console.log('No file selected for upload');
                    }
                  }}
                />
              </Button>
            </Box>
            
            {sealTagImage && (
              <Box sx={{ mt: 2, mb: 2 }}>
                {renderImagePreview(sealTagImage)}
              </Box>
            )}
          </Box>
        </Box>
        
        {/* Camera Dialog */}
        <Dialog
          open={cameraDialogOpen}
          onClose={() => setCameraDialogOpen(false)}
          fullWidth
          maxWidth="sm"
        >
          <CameraCapture
            onCapture={handleImageCapture}
            onClose={() => setCameraDialogOpen(false)}
          />
        </Dialog>
        
        {/* Verification Progress */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Verification Progress:
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip 
                label={`${sealComparison.matched.length} Matched`} 
                color="success" 
                variant="outlined"
                icon={<CheckCircle />}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Chip 
                label={`${operatorSeals.length - sealComparison.matched.length} Remaining`} 
                color="warning" 
                variant="outlined"
                icon={<Warning />}
              />
            </Box>
          </Box>
        </Box>
        
        {/* Seal Tags Table */}
        <TableContainer component={Paper} sx={{ mb: 3, overflowX: 'auto' }}>
          <Table aria-label="seal tags table" size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: { xs: '120px', sm: '150px' } }}>Seal Tag ID</TableCell>
                <TableCell sx={{ minWidth: { xs: '100px', sm: '120px' } }}>Guard Method</TableCell>
                <TableCell sx={{ minWidth: { xs: '100px', sm: '120px' } }}>Operator Method</TableCell>
                <TableCell sx={{ minWidth: '80px' }}>Status</TableCell>
                <TableCell align="center" sx={{ minWidth: '80px' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Show all seals - both from operator and guard */}
              {getAllSeals().map(sealId => {
                const guardSeal = guardScannedSeals.find(seal => seal.id === sealId);
                const operatorSeal = operatorSeals.find(seal => seal.id === sealId);
                const isMatched = guardSeal && operatorSeal;
                
                return (
                  <React.Fragment key={sealId}>
                    <TableRow 
                      sx={{ 
                        backgroundColor: isMatched ? 'rgba(46, 125, 50, 0.08)' : 'inherit'
                      }}
                    >
                      <TableCell>{sealId}</TableCell>
                      <TableCell>
                        {guardSeal ? (
                          guardSeal.method
                        ) : (
                          <Chip size="small" label="Not Scanned" color="error" />
                        )}
                      </TableCell>
                      <TableCell>
                        {operatorSeal ? (
                          operatorSeal.method
                        ) : (
                          <Chip size="small" label="Not Applied" color="warning" />
                        )}
                      </TableCell>
                      <TableCell>
                        {isMatched ? (
                          <Chip size="small" label="Matched" color="success" />
                        ) : (
                          <Chip size="small" label="Unmatched" color="error" />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {guardSeal && (
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => deleteGuardSeal(sealId)}
                          >
                              <Delete fontSize="small" />
                          </IconButton>
                        )}
                          <IconButton 
                            size="small" 
                            onClick={() => toggleSealDetails(sealId)}
                          >
                            {expandedSeals[sealId] ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded details row */}
                    {expandedSeals[sealId] && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ p: 0 }}>
                          <Collapse in={expandedSeals[sealId]} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, bgcolor: 'rgba(0, 0, 0, 0.02)' }}>
                              <Typography variant="subtitle2" gutterBottom>Seal Tag Details</Typography>
                              
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                                {/* Guard details */}
                              <Box sx={{ flex: 1 }}>
                                  <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" color="primary">Guard Data</Typography>
                                  {guardSeal ? (
                                    <>
                                        <Typography variant="body2">Method: {guardSeal.method}</Typography>
                                        <Typography variant="body2">Timestamp: {new Date(guardSeal.timestamp).toLocaleString()}</Typography>
                                        {guardSeal.imageData && (
                                          <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2">Image:</Typography>
                                            <img 
                                              src={guardSeal.imageData} 
                                              alt="Seal tag" 
                                              style={{ maxWidth: '100%', maxHeight: '100px', marginTop: '8px', cursor: 'pointer' }}
                                              onClick={() => {
                                                setSelectedImage(guardSeal.imageData);
                                                setOpenImageModal(true);
                                              }}
                                            />
                                          </Box>
                                        )}
                                    </>
                                  ) : (
                                      <Typography variant="body2" color="error">Not scanned by guard</Typography>
                                  )}
                                  </Paper>
                                </Box>
                                
                                {/* Operator details */}
                                <Box sx={{ flex: 1 }}>
                                  <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle2" color="secondary">Operator Data</Typography>
                                  {operatorSeal ? (
                                    <>
                                        <Typography variant="body2">Method: {operatorSeal.method}</Typography>
                                        <Typography variant="body2">Timestamp: {operatorSeal.timestamp ? new Date(operatorSeal.timestamp).toLocaleString() : 'N/A'}</Typography>
                                        {(operatorSeal.imageUrl || operatorSeal.imageData) && (
                                          <Box sx={{ mt: 1 }}>
                                            <Typography variant="body2">Image:</Typography>
                                            <img 
                                              src={(operatorSeal.imageUrl || operatorSeal.imageData || '')} 
                                              alt="Seal tag" 
                                              style={{ maxWidth: '100%', maxHeight: '100px', marginTop: '8px', cursor: 'pointer' }}
                                              onClick={() => {
                                                setSelectedImage((operatorSeal.imageUrl || operatorSeal.imageData || ''));
                                                setOpenImageModal(true);
                                              }}
                                            />
                                          </Box>
                                        )}
                                    </>
                                  ) : (
                                      <Typography variant="body2" color="warning.main">Not applied by operator</Typography>
                                  )}
                                  </Paper>
                                </Box>
                                </Box>
                              </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        
        {/* Display Operator Seals */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Operator Seals:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {operatorSeals.map(seal => (
              <Chip 
                key={seal.id}
                label={seal.id}
                color={sealComparison.matched.includes(seal.id) ? "success" : "default"}
                icon={sealComparison.matched.includes(seal.id) ? <CheckCircle /> : undefined}
                variant="outlined"
              />
            ))}
            {operatorSeals.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No operator seals found for this session.
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  // Component for Images Tab
  const ImagesTab = ({
    session,
    guardImages,
    setGuardImages,
    imageComments,
    setImageComments,
    setImagesVerified
  }: {
    session: SessionType;
    guardImages: Record<string, any>;
    setGuardImages: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    imageComments: Record<string, string>;
    setImageComments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    setImagesVerified: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    // Handle verifying an image
    const verifyImage = (imageKey: string) => {
      setVerificationFields(prev => ({
        ...prev,
        [imageKey]: { 
          verified: !prev[imageKey]?.verified, 
          timestamp: new Date().toISOString(),
          comment: imageComments[imageKey] || ''
        }
      }));
    };

    // Handle image comment change
    const handleImageCommentChange = (imageKey: string, comment: string) => {
      setImageComments(prev => ({
        ...prev,
        [imageKey]: comment
      }));
      
      // Update the verification field if already verified
      if (verificationFields[imageKey]?.verified) {
        setVerificationFields(prev => ({
          ...prev,
          [imageKey]: {
            ...prev[imageKey],
            comment
          }
        }));
      }
    };

    // Check if all required images are verified
    useEffect(() => {
      if (!session.images) return;
      
      // Build a list of all required image keys
      const requiredImages = [];
      
      // Add primary images
      if (session.images.driverPicture) requiredImages.push('driverPicture');
      if (session.images.vehicleNumberPlatePicture) requiredImages.push('vehicleNumberPlatePicture');
      if (session.images.gpsImeiPicture) requiredImages.push('gpsImeiPicture');
      
      // Add vehicle images
      if (session.images.vehicleImages) {
        session.images.vehicleImages.forEach((_, index) => {
          requiredImages.push(`vehicleImage-${index}`);
        });
      }
      
      // Add sealing images
      if (session.images.sealingImages) {
        session.images.sealingImages.forEach((_, index) => {
          requiredImages.push(`sealingImage-${index}`);
        });
      }
      
      // Check if all images are verified
      const allVerified = requiredImages.every(imageKey => 
        verificationFields[imageKey]?.verified
      );
      
      setImagesVerified(allVerified);
    }, [session, verificationFields, setImagesVerified]);

    // Define the image display data
    const getImageItems = () => {
      const items = [];
      
      // Driver Image
      if (session.images?.driverPicture) {
        items.push({
          key: 'driverPicture',
          label: 'Driver Picture',
          src: session.images.driverPicture
        });
      }
      
      // Vehicle Number Plate Image
      if (session.images?.vehicleNumberPlatePicture) {
        items.push({
          key: 'vehicleNumberPlatePicture',
          label: 'Vehicle Number Plate',
          src: session.images.vehicleNumberPlatePicture
        });
      }
      
      // GPS IMEI Image
      if (session.images?.gpsImeiPicture) {
        items.push({
          key: 'gpsImeiPicture',
          label: 'GPS IMEI Picture',
          src: session.images.gpsImeiPicture
        });
      }
      
      return items;
    };

    // Get all vehicle images
    const vehicleImages = session.images?.vehicleImages || [];
    // Get all sealing images
    const sealingImages = session.images?.sealingImages || [];

    return (
      <Box>
        <Typography variant="h6" component="h2" gutterBottom>
          Images Verification
        </Typography>
        
        {/* Main images (Driver, GPS, Number Plate) */}
        {getImageItems().map((item) => (
          <React.Fragment key={item.key}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              {item.label}
            </Typography>
            
            <TableContainer component={Paper} sx={{ overflowX: 'auto', mb: 3 }}>
              <Table size="small">
          <TableHead>
                  <TableRow>
                    <TableCell>Image Type</TableCell>
                    <TableCell>Image</TableCell>
                    <TableCell align="center">Verification</TableCell>
                    <TableCell>Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
                  <TableRow>
                    <TableCell sx={{ 
                      fontWeight: 'medium',
                      whiteSpace: { xs: 'normal', sm: 'nowrap' },
                      minWidth: { xs: '100px', sm: '120px' }
                    }}>
                      {item.label}
                    </TableCell>
                    <TableCell sx={{ minWidth: { xs: '100px', sm: '150px' } }}>
                      <Box sx={{ mt: 1, mb: 1 }}>
                    <img 
                          src={item.src} 
                          alt={item.label} 
                          style={{ 
                            width: '100%', 
                            maxWidth: '150px',
                            maxHeight: '100px', 
                            objectFit: 'cover',
                            cursor: 'pointer' 
                          }}
                      onClick={() => {
                            setSelectedImage(item.src);
                        setOpenImageModal(true);
                      }}
                    />
                  </Box>
                </TableCell>
                    <TableCell align="center" sx={{ minWidth: { xs: '80px', sm: '110px' } }}>
                  <FormControlLabel
                    control={
                      <Radio
                            checked={!!verificationFields[item.key]?.verified}
                            onChange={() => verifyImage(item.key)}
                        color="success"
                            size="small"
                      />
                    }
                        label={<Typography variant="body2">Verified</Typography>}
                    sx={{ m: 0 }}
                  />
                </TableCell>
                    <TableCell sx={{ minWidth: { xs: '120px', sm: '160px' } }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add verification"
                        value={imageComments[item.key] || ''}
                        onChange={(e) => handleImageCommentChange(item.key, e.target.value)}
                  />
                </TableCell>
              </TableRow>
          </TableBody>
        </Table>
            </TableContainer>
          </React.Fragment>
        ))}
        
        {/* Vehicle Images Section */}
        {vehicleImages.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Vehicle Images ({vehicleImages.length})
            </Typography>
            
            <TableContainer component={Paper} sx={{ overflowX: 'auto', mb: 3 }}>
              <Table size="small">
              <TableHead>
                  <TableRow>
                    <TableCell>Image Type</TableCell>
                    <TableCell>Image</TableCell>
                    <TableCell align="center">Verification</TableCell>
                    <TableCell>Comment</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicleImages.map((imageUrl, index) => (
                    <TableRow key={`vehicle-${index}`}>
                      <TableCell sx={{ 
                        fontWeight: 'medium',
                        whiteSpace: { xs: 'normal', sm: 'nowrap' },
                        minWidth: { xs: '100px', sm: '120px' }
                      }}>
                        Vehicle Image {index + 1}
                      </TableCell>
                      <TableCell sx={{ minWidth: { xs: '100px', sm: '150px' } }}>
                        <Box sx={{ mt: 1, mb: 1 }}>
                        <img 
                          src={imageUrl} 
                            alt={`Vehicle Image ${index + 1}`} 
                            style={{ 
                              width: '100%', 
                              maxWidth: '150px',
                              maxHeight: '100px', 
                              objectFit: 'cover',
                              cursor: 'pointer' 
                            }}
                          onClick={() => {
                            setSelectedImage(imageUrl);
                            setOpenImageModal(true);
                          }}
                        />
                      </Box>
                    </TableCell>
                      <TableCell align="center" sx={{ minWidth: { xs: '80px', sm: '110px' } }}>
                      <FormControlLabel
                        control={
                          <Radio
                              checked={!!verificationFields[`vehicleImage-${index}`]?.verified}
                              onChange={() => verifyImage(`vehicleImage-${index}`)}
                            color="success"
                              size="small"
                        />
                      }
                          label={<Typography variant="body2">Verified</Typography>}
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                      <TableCell sx={{ minWidth: { xs: '120px', sm: '160px' } }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add verification"
                          value={imageComments[`vehicleImage-${index}`] || ''}
                          onChange={(e) => handleImageCommentChange(`vehicleImage-${index}`, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TableContainer>
          </>
        )}
        
        {/* Sealing Images Section */}
        {sealingImages.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
              Sealing Images ({sealingImages.length})
            </Typography>
            
            <TableContainer component={Paper} sx={{ overflowX: 'auto', mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Image Type</TableCell>
                    <TableCell>Image</TableCell>
                    <TableCell align="center">Verification</TableCell>
                    <TableCell>Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sealingImages.map((imageUrl, index) => (
                    <TableRow key={`sealing-${index}`}>
                      <TableCell sx={{ 
                        fontWeight: 'medium',
                        whiteSpace: { xs: 'normal', sm: 'nowrap' },
                        minWidth: { xs: '100px', sm: '120px' }
                      }}>
                        Sealing Image {index + 1}
                      </TableCell>
                      <TableCell sx={{ minWidth: { xs: '100px', sm: '150px' } }}>
                        <Box sx={{ mt: 1, mb: 1 }}>
                          <img 
                            src={imageUrl} 
                            alt={`Sealing Image ${index + 1}`} 
                            style={{ 
                              width: '100%', 
                              maxWidth: '150px',
                              maxHeight: '100px', 
                              objectFit: 'cover',
                              cursor: 'pointer' 
                            }}
                            onClick={() => {
                              setSelectedImage(imageUrl);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ minWidth: { xs: '80px', sm: '110px' } }}>
                        <FormControlLabel
                          control={
                            <Radio
                              checked={!!verificationFields[`sealingImage-${index}`]?.verified}
                              onChange={() => verifyImage(`sealingImage-${index}`)}
                              color="success"
                              size="small"
                            />
                          }
                          label={<Typography variant="body2">Verified</Typography>}
                          sx={{ m: 0 }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: { xs: '120px', sm: '160px' } }}>
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Add verification"
                          value={imageComments[`sealingImage-${index}`] || ''}
                          onChange={(e) => handleImageCommentChange(`sealingImage-${index}`, e.target.value)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>
    );
  };

  // Return the UI
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Back button and title */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handleBack}
        >
          Back
        </Button>
        
        <Typography variant="h5" component="h1">
          Verify Trip Session
        </Typography>
      </Box>
      
      {/* Error or Loading states */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : session ? (
        <>
          {/* Session info card */}
          <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2}>
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocationOn color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Source</Typography>
                    <Typography variant="body1">{session.source}</Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocationOn color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Destination</Typography>
                    <Typography variant="body1">{session.destination}</Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <DirectionsCar color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Vehicle</Typography>
                    <Typography variant="body1">{session.tripDetails?.vehicleNumber || 'N/A'}</Typography>
                  </Box>
                </Box>
              </Grid>
              
              <Grid sx={{ gridColumn: { xs: 'span 12', sm: 'span 6', md: 'span 3' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTime color="primary" sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Created</Typography>
                    <Typography variant="body1">
                      {new Date(session.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Tabs for verification sections */}
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                value="loadingDetails" 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography>Loading Details</Typography>
                    {loadingDetailsVerified && <CheckCircle color="success" sx={{ ml: 1, fontSize: 16 }} />}
                  </Box>
                } 
              />
              <Tab 
                value="driverDetails" 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography>Driver Details</Typography>
                    {driverDetailsVerified && <CheckCircle color="success" sx={{ ml: 1, fontSize: 16 }} />}
                  </Box>
                } 
              />
              <Tab 
                value="sealTags" 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography>Seal Tags</Typography>
                    {sealTagsVerified && <CheckCircle color="success" sx={{ ml: 1, fontSize: 16 }} />}
                  </Box>
                } 
              />
              <Tab 
                value="images" 
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography>Images</Typography>
                    {imagesVerified && <CheckCircle color="success" sx={{ ml: 1, fontSize: 16 }} />}
                  </Box>
                } 
              />
            </Tabs>
            
            {/* Tab panels */}
            <TabPanel value={tabValue} index="loadingDetails">
              <LoadingDetailsTab 
                session={session}
                verificationFields={verificationFields}
                setVerificationFields={setVerificationFields}
                setLoadingDetailsVerified={setLoadingDetailsVerified}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index="driverDetails">
              <DriverDetailsTab 
                session={session}
                verificationFields={verificationFields}
                setVerificationFields={setVerificationFields}
                setDriverDetailsVerified={setDriverDetailsVerified}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index="sealTags">
              <SealTagsTab 
                session={session}
                operatorSeals={operatorSeals}
                guardScannedSeals={guardScannedSeals}
                sealComparison={sealComparison}
                scanInput={scanInput}
                setScanInput={setScanInput}
                scanError={scanError}
                handleScanComplete={handleScanComplete}
                setSealTagsVerified={setSealTagsVerified}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index="images">
              <ImagesTab 
                session={session}
                guardImages={guardImages}
                setGuardImages={setGuardImages}
                imageComments={imageComments}
                setImageComments={setImageComments}
                setImagesVerified={setImagesVerified}
              />
            </TabPanel>
          </Paper>
          
          {/* Verification actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              variant="outlined"
              onClick={handleBack}
            >
              Cancel
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              onClick={handleVerifySeal}
              disabled={verifying}
              startIcon={verifying ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {verifying ? 'Verifying...' : 'Complete Verification'}
            </Button>
          </Box>
          
          {/* Image preview modal */}
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
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <img 
                    src={selectedImage} 
                    alt="Preview" 
                    style={{ maxWidth: '100%', maxHeight: '70vh' }} 
                  />
                </Box>
              )}
            </DialogContent>
          </Dialog>
          
          {/* Password Dialog for 2FA */}
          <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
            <DialogTitle>Guard Password Required</DialogTitle>
            <DialogContent>
              <Typography gutterBottom>Enter your password to complete verification.</Typography>
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={guardPassword}
                onChange={e => setGuardPassword(e.target.value)}
                error={!!passwordError}
                helperText={passwordError}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handlePasswordConfirm(); }}
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPasswordDialogOpen(false)} disabled={verifying}>Cancel</Button>
              <Button onClick={handlePasswordConfirm} disabled={verifying || !guardPassword} variant="contained" color="primary">
                {verifying ? 'Verifying...' : 'Confirm'}
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <Alert severity="warning">
          Session not found or access denied
        </Alert>
      )}
    </Container>
  );
} 