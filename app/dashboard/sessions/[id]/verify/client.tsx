"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  Box, Button, Container, Paper, Typography, Tab, Tabs, 
  Grid, TextField, Chip, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControlLabel, Radio, Table, TableHead, TableBody, TableRow, TableCell,
  InputAdornment, TableContainer, Collapse
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Lock, QrCodeScanner, Camera, 
  AddAPhoto, FileUpload, Close, LocationOn, AccessTime,
  Business, Person, DirectionsCar, Info, PhotoCamera,
  Delete, CloudUpload, ExpandLess, ExpandMore, Warning, Create
} from '@mui/icons-material';
import { EmployeeSubrole, SessionStatus } from '@/prisma/enums';
import ClientSideQrScanner from '@/app/components/ClientSideQrScanner';

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
  const [operatorSeals, setOperatorSeals] = useState<Array<{id: string, method?: string, timestamp?: string}>>([]);
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
          timestamp: tag.createdAt
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
      
      toast.success('Verification completed successfully!');
      
      // Navigate back to sessions
      setTimeout(() => {
        router.push('/dashboard/sessions');
      }, 2000);
    } catch (error) {
      console.error('Error completing verification:', error);
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
        
        <Table>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableCell width="25%">Field Name</TableCell>
              <TableCell width="25%">Field Value</TableCell>
              <TableCell width="15%" align="center">Verification</TableCell>
              <TableCell width="35%">Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fieldDisplayData.map(({ field, label }) => {
              const value = session.tripDetails?.[field as keyof typeof session.tripDetails];
              if (value === undefined || value === null) return null;
              
              return (
                <TableRow key={field} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{label}</TableCell>
                  <TableCell>{field === 'freight' ? `₹${value}` : value.toString()}</TableCell>
                  <TableCell align="center">
                    <FormControlLabel
                      control={
                        <Radio
                          checked={!!verificationFields[field]?.verified}
                          onChange={() => verifyField(field)}
                          color="success"
                        />
                      }
                      label="Verified"
                      sx={{ m: 0 }}
                    />
                  </TableCell>
                  <TableCell>
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
        
        <Table>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableCell width="25%">Field Name</TableCell>
              <TableCell width="25%">Field Value</TableCell>
              <TableCell width="15%" align="center">Verification</TableCell>
              <TableCell width="35%">Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fieldDisplayData.map(({ field, label }) => {
              const value = session.tripDetails?.[field as keyof typeof session.tripDetails];
              if (value === undefined || value === null) return null;
              
              return (
                <TableRow key={field} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                  <TableCell sx={{ fontWeight: 'medium' }}>{label}</TableCell>
                  <TableCell>{value.toString()}</TableCell>
                  <TableCell align="center">
                    <FormControlLabel
                      control={
                        <Radio
                          checked={!!verificationFields[field]?.verified}
                          onChange={() => verifyField(field)}
                          color="success"
                        />
                      }
                      label="Verified"
                      sx={{ m: 0 }}
                    />
                  </TableCell>
                  <TableCell>
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
            
            {/* Driver image if available */}
            {session.images?.driverPicture && (
              <TableRow sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                <TableCell sx={{ fontWeight: 'medium' }}>Driver Picture</TableCell>
                <TableCell>
                  <Box sx={{ mt: 1, mb: 1 }}>
                    <img 
                      src={session.images.driverPicture} 
                      alt="Driver" 
                      style={{ maxWidth: '100%', maxHeight: '120px', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedImage(session.images?.driverPicture || '');
                        setOpenImageModal(true);
                      }}
                    />
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <FormControlLabel
                    control={
                      <Radio
                        checked={!!verificationFields['driverPicture']?.verified}
                        onChange={() => verifyField('driverPicture')}
                        color="success"
                      />
                    }
                    label="Verified"
                    sx={{ m: 0 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add verification"
                    value={fieldComments['driverPicture'] || ''}
                    onChange={(e) => handleCommentChange('driverPicture', e.target.value)}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
    operatorSeals: Array<{id: string, method?: string, timestamp?: string}>;
    guardScannedSeals: Array<any>;
    sealComparison: {matched: string[], mismatched: string[]};
    scanInput: string;
    setScanInput: React.Dispatch<React.SetStateAction<string>>;
    scanError: string;
    handleScanComplete: (barcodeData: string, method: string, imageFile?: File) => Promise<void>;
    setSealTagsVerified: React.Dispatch<React.SetStateAction<boolean>>;
  }) => {
    const [showScanner, setShowScanner] = useState(false);
    const [manualEntry, setManualEntry] = useState(false);
    const [sealTagImage, setSealTagImage] = useState<File | null>(null);
    const [expandedSealId, setExpandedSealId] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const textFieldRef = useRef<HTMLInputElement>(null);

    // Handle scanned barcode with image
    const handleScannedBarcode = (data: string, imageFile: File) => {
      setShowScanner(false);
      handleScanComplete(data, "digital", imageFile);
    };

    // Handle manual seal tag image change
    const handleManualSealTagImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        try {
          setSealTagImage(files[0]);
        } catch (error) {
          console.error("Error processing seal tag image:", error);
          setSealTagImage(null);
        }
      }
    };

    // Handle adding manual seal tag
    const handleAddManualSealTag = async () => {
      if (!scanInput.trim()) {
        setError("Please enter a seal tag ID");
        return;
      }

      if (!sealTagImage) {
        setError("Please attach an image of the seal tag");
        return;
      }

      setError("");
      handleScanComplete(scanInput.trim(), "manual", sealTagImage);
      setSealTagImage(null);
    };

    // Toggle expanded seal details
    const toggleSealDetails = (sealId: string) => {
      if (expandedSealId === sealId) {
        setExpandedSealId(null);
      } else {
        setExpandedSealId(sealId);
      }
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

    return (
      <Box>
        <Typography variant="h6" component="h2">
          Seal Tags Verification
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>
        
        {/* Scan or Enter Seal Tag Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Scan Seal Tags
          </Typography>
          
          {showScanner ? (
            <Box sx={{ mb: 2 }}>
              <ClientSideQrScanner
                onScanWithImage={handleScannedBarcode}
                buttonText="Close Scanner"
                buttonVariant="outlined"
              />
            </Box>
          ) : (
            <Box>
              {manualEntry ? (
                <>
                  <TextField
                    fullWidth
                    label="Seal Tag ID"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Enter seal tag ID"
                    inputRef={textFieldRef}
                    error={!!scanError || !!error}
                    helperText={scanError || error}
                    sx={{ mb: 2 }}
                    inputProps={{
                      maxLength: 50, // Set a reasonable max length
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton 
                            onClick={() => setScanInput('')}
                            edge="end"
                          >
                            <Close />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCamera />}
                      sx={{ mr: 1 }}
                    >
                      Take Photo
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        capture="environment"
                        onChange={handleManualSealTagImageChange}
                      />
                    </Button>
                    
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<AddAPhoto />}
                    >
                      Upload Image
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleManualSealTagImageChange}
                      />
                    </Button>
                  </Box>
                  
                  {renderImagePreview(sealTagImage)}
                  
                  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button 
                      variant="outlined"
                      onClick={() => {
                        setManualEntry(false);
                        setScanInput('');
                        setSealTagImage(null);
                        setError('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="contained"
                      onClick={handleAddManualSealTag}
                      disabled={!scanInput.trim() || !sealTagImage}
                    >
                      Add Seal Tag
                    </Button>
                  </Box>
                </>
              ) : (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={() => setShowScanner(true)}
                  >
                    Scan QR/Barcode
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Create />}
                    onClick={() => setManualEntry(true)}
                  >
                    Manual Entry
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Paper>
        
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
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table aria-label="seal tags table">
            <TableHead>
              <TableRow>
                <TableCell>Seal Tag ID</TableCell>
                <TableCell>Guard Method</TableCell>
                <TableCell>Operator Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Action</TableCell>
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
                          operatorSeal.method || 
                          (guardSeal?.operatorMethod || "Digitally Scanned")
                        ) : (
                          "Unknown"
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={isMatched ? "success" : "error"}
                          label={isMatched ? "Matched" : "No Match"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => toggleSealDetails(sealId)}>
                          {expandedSealId === sealId ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                        {guardSeal && !operatorSeal && (
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => deleteGuardSeal(sealId)}
                            sx={{ ml: 1 }}
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {expandedSealId === sealId && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Box sx={{ py: 2, px: 3, bgcolor: 'background.paper', borderRadius: 1 }}>
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                              {/* Left column - information */}
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2">Seal ID: {sealId}</Typography>
                                
                                {/* Guard Information */}
                                <Box sx={{ mt: 2, mb: 2 }}>
                                  <Typography variant="subtitle2" color="primary">Guard Information:</Typography>
                                  {guardSeal ? (
                                    <>
                                      <Typography variant="body2">
                                        Method: {guardSeal.method}
                                      </Typography>
                                      <Typography variant="body2">
                                        Timestamp: {new Date(guardSeal.timestamp).toLocaleString()}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      Not scanned by guard
                                    </Typography>
                                  )}
                                </Box>
                                
                                {/* Operator Information */}
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="subtitle2" color="primary">Operator Information:</Typography>
                                  {operatorSeal ? (
                                    <>
                                      <Typography variant="body2">
                                        Method: {operatorSeal.method || (guardSeal?.operatorMethod || "Digitally Scanned")}
                                      </Typography>
                                      <Typography variant="body2">
                                        Timestamp: {operatorSeal.timestamp ? new Date(operatorSeal.timestamp).toLocaleString() : "Unknown"}
                                      </Typography>
                                    </>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      No operator information
                                    </Typography>
                                  )}
                                </Box>
                                
                                {/* Status */}
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="subtitle2">Status:</Typography>
                                  <Chip
                                    size="small"
                                    color={isMatched ? "success" : "error"}
                                    label={isMatched ? "Matched" : "No Match"}
                                    sx={{ mt: 0.5 }}
                                  />
                                </Box>
                              </Box>
                              
                              {/* Right column - images */}
                              <Box sx={{ flex: 1 }}>
                                {/* Guard Image */}
                                {guardSeal?.image && (
                                  <Box sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2">Guard Scan Image:</Typography>
                                    <Box
                                      component="img"
                                      src={guardSeal.image}
                                      alt={`Seal ${sealId} image`}
                                      sx={{
                                        maxWidth: '100%',
                                        maxHeight: '150px',
                                        objectFit: 'contain',
                                        mt: 1,
                                        border: '1px solid #ccc',
                                        borderRadius: 1
                                      }}
                                    />
                                  </Box>
                                )}
                                
                                {/* Operator Image */}
                                {(guardSeal?.operatorImage || 
                                 (operatorSeal && session.sealTags?.find(t => t.barcode === sealId)?.imageData)) && (
                                  <Box>
                                    <Typography variant="subtitle2">Operator Scan Image:</Typography>
                                    <Box
                                      component="img"
                                      src={guardSeal?.operatorImage || 
                                            session.sealTags?.find(t => t.barcode === sealId)?.imageData}
                                      alt={`Seal ${sealId} operator image`}
                                      sx={{
                                        maxWidth: '100%',
                                        maxHeight: '150px',
                                        objectFit: 'contain',
                                        mt: 1,
                                        border: '1px solid #ccc',
                                        borderRadius: 1
                                      }}
                                    />
                                  </Box>
                                )}
                              </Box>
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
      
      const requiredImages = [
        'vehicleNumberPlatePicture', 'gpsImeiPicture'
      ];
      
      const allVerified = requiredImages.every(imageKey => 
        !session.images?.[imageKey as keyof typeof session.images] || 
        verificationFields[imageKey]?.verified
      );
      
      setImagesVerified(allVerified);
    }, [session, verificationFields, setImagesVerified]);

    // Define the image display data
    const getImageItems = () => {
      const items = [];
      
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

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Images Verification
        </Typography>
        
        {/* Main images table */}
        <Table sx={{ mb: 4 }}>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 'bold' } }}>
              <TableCell width="20%">Image Type</TableCell>
              <TableCell width="35%">Image</TableCell>
              <TableCell width="15%" align="center">Verification</TableCell>
              <TableCell width="30%">Comment</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {getImageItems().map(({ key, label, src }) => (
              <TableRow key={key} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                <TableCell sx={{ fontWeight: 'medium' }}>{label}</TableCell>
                <TableCell>
                  <Box sx={{ maxWidth: '100%' }}>
                    <img 
                      src={src} 
                      alt={label} 
                      style={{ maxWidth: '100%', maxHeight: '150px', cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedImage(src);
                        setOpenImageModal(true);
                      }}
                    />
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <FormControlLabel
                    control={
                      <Radio
                        checked={!!verificationFields[key]?.verified}
                        onChange={() => verifyImage(key)}
                        color="success"
                      />
                    }
                    label="Verified"
                    sx={{ m: 0 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add verification"
                    value={imageComments[key] || ''}
                    onChange={(e) => handleImageCommentChange(key, e.target.value)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {/* Vehicle Images Gallery */}
        {vehicleImages.length > 0 && (
          <>
            <Typography variant="h6" gutterBottom>
              Vehicle Images Verification
            </Typography>
            <Table>
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 'bold' } }}>
                  <TableCell width="20%">Image</TableCell>
                  <TableCell width="35%">Preview</TableCell>
                  <TableCell width="15%" align="center">Verification</TableCell>
                  <TableCell width="30%">Comment</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicleImages.map((imageUrl, index) => (
                  <TableRow key={`vehicle-${index}`} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}>
                    <TableCell sx={{ fontWeight: 'medium' }}>Vehicle Image {index + 1}</TableCell>
                    <TableCell>
                      <Box>
                        <img 
                          src={imageUrl} 
                          alt={`Vehicle ${index + 1}`} 
                          style={{ maxWidth: '100%', maxHeight: '150px', cursor: 'pointer' }}
                          onClick={() => {
                            setSelectedImage(imageUrl);
                            setOpenImageModal(true);
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <FormControlLabel
                        control={
                          <Radio
                            checked={!!verificationFields[`vehicleImage_${index}`]?.verified}
                            onChange={() => verifyImage(`vehicleImage_${index}`)}
                            color="success"
                          />
                        }
                        label="Verified"
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Add verification"
                        value={imageComments[`vehicleImage_${index}`] || ''}
                        onChange={(e) => handleImageCommentChange(`vehicleImage_${index}`, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
              disabled={verifying || !(loadingDetailsVerified && driverDetailsVerified && sealTagsVerified && imagesVerified)}
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
        </>
      ) : (
        <Alert severity="warning">
          Session not found or access denied
        </Alert>
      )}
    </Container>
  );
} 