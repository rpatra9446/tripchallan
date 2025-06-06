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
  Delete, CloudUpload, ExpandLess, ExpandMore, Warning
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
      
      // Process and set guard scanned seals
      if (data && Array.isArray(data)) {
        const processedSeals = data.map((tag: any) => ({
          id: tag.barcode,
          method: tag.method,
          image: tag.imageUrl || null,
          imagePreview: null,
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
          imageData
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
    // Add state for manual entry image
    const [manualEntryImage, setManualEntryImage] = useState<File | null>(null);
    // Create a ref for the text field to maintain focus
    const textFieldRef = useRef<HTMLInputElement>(null);
    // Add state for expanded seal tag details
    const [expandedSeal, setExpandedSeal] = useState<string | null>(null);
    // Add state for error message
    const [error, setError] = useState<string>("");
    
    // Handle image upload for manual seal tag entries
    const handleManualSealTagImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return;
      
      try {
        const file = e.target.files[0];
        // Process the image (resize/compress) before setting it
        const processedFile = await processImageForUpload(file);
        setManualEntryImage(file);
        
        // Refocus the text field after image selection
        setTimeout(() => {
          if (textFieldRef.current) {
            textFieldRef.current.focus();
          }
        }, 0);
      } catch (error) {
        console.error("Error processing seal tag image:", error);
        setError("Failed to process image. Please try with a smaller image.");
        setTimeout(() => setError(""), 3000);
      }
    };
    
    // Handle adding seal tag with manual entry
    const handleAddManualSealTag = async () => {
      if (!scanInput.trim()) {
        setError("Please enter a seal tag ID");
        return;
      }
      
      if (!manualEntryImage) {
        setError("Please attach an image of the seal tag");
        return;
      }
      
      // Call the existing handleScanComplete with the manual method and image
      await handleScanComplete(scanInput.trim(), 'manual', manualEntryImage);
      
      // Clear the manual entry image after successful addition
      setManualEntryImage(null);
      
      // Refocus the text field
      setTimeout(() => {
        if (textFieldRef.current) {
          textFieldRef.current.focus();
        }
      }, 0);
    };
    
    // Toggle expanded seal details
    const toggleSealDetails = (sealId: string) => {
      if (expandedSeal === sealId) {
        setExpandedSeal(null);
      } else {
        setExpandedSeal(sealId);
      }
    };
    
    // Check if all seals are verified
    useEffect(() => {
      const allSealsVerified = operatorSeals.length > 0 && 
        sealComparison.matched.length === operatorSeals.length;
      
      setSealTagsVerified(allSealsVerified);
    }, [operatorSeals, sealComparison, setSealTagsVerified]);

    // Function to render image preview
    const renderImagePreview = (file: File | null) => {
      if (!file) return null;
      
      return (
        <img 
          src={URL.createObjectURL(file)}
          alt="Seal Tag Preview"
          style={{ 
            maxWidth: '100%', 
            maxHeight: '150px', 
            borderRadius: '4px',
            objectFit: 'contain'
          }}
        />
      );
    };

    // Determine the source of a seal (Operator, Guard, or Both)
    const getSealSource = (sealId: string) => {
      const isOperator = operatorSeals.some(seal => seal.id === sealId);
      const isGuard = guardScannedSeals.some(seal => seal.id === sealId);
      
      if (isOperator && isGuard) return "Both";
      if (isOperator) return "Operator";
      if (isGuard) return "Guard";
      return "Unknown";
    };

    // Determine the status of a seal (Matched, Not Scanned)
    const getSealStatus = (sealId: string) => {
      if (sealComparison.matched.includes(sealId)) return "Matched";
      return "Not Scanned";
    };

    // Get seal by ID from either operator or guard seals
    const getSealById = (sealId: string) => {
      const guardSeal = guardScannedSeals.find(seal => seal.id === sealId);
      const operatorSeal = operatorSeals.find(seal => seal.id === sealId);
      return { guardSeal, operatorSeal };
    };

    // Get combined list of all seals
    const getAllSeals = () => {
      const allSealIds = new Set([
        ...operatorSeals.map(seal => seal.id),
        ...guardScannedSeals.map(seal => seal.id)
      ]);
      return Array.from(allSealIds);
    };

    // Get the method display for a seal
    const getSealMethod = (sealId: string) => {
      const { guardSeal, operatorSeal } = getSealById(sealId);
      const method = guardSeal?.method || operatorSeal?.method || "Unknown";
      return method === 'digital' ? "Digitally Scanned" : "Manually Entered";
    };

    // Delete a guard seal
    const deleteGuardSeal = async (sealId: string) => {
      // TODO: Implement delete functionality if needed
      console.log("Delete seal", sealId);
    };

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>
        
        {/* Scanning and Manual Entry Section */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
            Scan Seal Tags
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'center' }}>
            <TextField
              label="Seal Tag ID"
              variant="outlined"
              size="small"
              value={scanInput}
              onChange={(e) => {
                setScanInput(e.target.value);
                // Keep focus on the text field
                if (textFieldRef.current) {
                  textFieldRef.current.focus();
                }
              }}
              inputRef={textFieldRef}
              error={!!scanError || !!error}
              helperText={scanError || error}
              sx={{ flexGrow: 1, maxWidth: '300px' }}
            />
            
            <Button 
              variant="contained"
              color="primary"
              size="small"
              onClick={handleAddManualSealTag} 
              disabled={!scanInput || !manualEntryImage}
              sx={{ height: '40px' }}
            >
              Add Manually
            </Button>
            
            <Button
              variant="contained"
              color="primary"
              fullWidth={false}
              size="medium"
              sx={{ 
                height: '40px', 
                ml: 'auto',
                width: { xs: '100%', sm: 'auto' },
                minWidth: '180px',
                display: 'flex',
                justifyContent: 'center'
              }}
              component="label"
            >
              Scan QR/Barcode
              <input
                type="file"
                hidden
                accept="image/*"
                capture="environment"
                onChange={async (e) => {
                  if (!e.target.files?.length) return;
                  
                  try {
                    const file = e.target.files[0];
                    // In a real QR scanner, this would process the image and extract a code
                    // For now, we'll just use the manual entry
                    setManualEntryImage(file);
                    
                    // TODO: Implement actual QR scanning
                    // For now, just prompt the user to enter the code manually
                    setError("QR code scanning not implemented. Please enter the code manually.");
                    
                    // Focus the text input
                    if (textFieldRef.current) {
                      textFieldRef.current.focus();
                    }
                  } catch (error) {
                    console.error("Error processing QR code:", error);
                    setError("Failed to process QR code.");
                  }
                }}
              />
            </Button>
          </Box>
          
          {/* Manual entry image preview */}
          {manualEntryImage && (
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ maxWidth: '150px', maxHeight: '150px', overflow: 'hidden', borderRadius: '4px' }}>
                {renderImagePreview(manualEntryImage)}
              </Box>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => setManualEntryImage(null)}
              >
                Remove Image
              </Button>
            </Box>
          )}
        </Paper>
        
        {/* Verification Progress */}
        <Box sx={{ mb: 3, position: 'relative' }}>
          <Box sx={{ 
            borderRadius: '4px', 
            border: '1px solid rgba(0, 0, 0, 0.12)',
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              width: `${(sealComparison.matched.length / Math.max(operatorSeals.length, 1)) * 100}%`, 
              height: '6px',
              bgcolor: 'success.main'
            }} />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="body2">
              Verification Progress: <strong>{sealComparison.matched.length}/{operatorSeals.length} Verified</strong>
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CheckCircle color="success" fontSize="small" />
                <Typography variant="body2">{sealComparison.matched.length} Matched</Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Warning color="warning" fontSize="small" />
                <Typography variant="body2">{operatorSeals.length - sealComparison.matched.length} Not Scanned</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
        
        {/* Seals Table */}
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Seal Tag ID</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {getAllSeals().map(sealId => {
                const isExpanded = expandedSeal === sealId;
                const status = getSealStatus(sealId);
                const source = getSealSource(sealId);
                const method = getSealMethod(sealId);
                const isMatched = status === "Matched";
                
                return (
                  <React.Fragment key={sealId}>
                    <TableRow 
                      sx={{ 
                        ...(isMatched && { backgroundColor: 'rgba(46, 125, 50, 0.08)' })
                      }}
                    >
                      <TableCell>
                        {isMatched && <CheckCircle color="success" fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />}
                        {sealId}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={method} 
                          size="small" 
                          color={method === "Digitally Scanned" ? "primary" : "secondary"}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={source} 
                          size="small" 
                          color={source === "Both" ? "success" : "primary"}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={status} 
                          size="small" 
                          color={status === "Matched" ? "success" : "warning"}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton size="small" onClick={() => toggleSealDetails(sealId)}>
                          {isExpanded ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                        
                        {source === "Guard" && (
                          <IconButton size="small" color="error" onClick={() => deleteGuardSeal(sealId)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={5} sx={{ py: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2, display: 'flex', gap: 2 }}>
                              {/* Operator Information */}
                              <Box sx={{ flex: 1, border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: '4px', p: 2 }}>
                                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                  Operator Information
                                </Typography>
                                
                                {source === "Operator" || source === "Both" ? (
                                  <>
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" color="text.secondary">Seal ID:</Typography>
                                      <Typography variant="body1">{sealId}</Typography>
                                    </Box>
                                    
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" color="text.secondary">Method:</Typography>
                                      <Chip 
                                        label={getSealMethod(sealId)} 
                                        size="small" 
                                        color={method === "Digitally Scanned" ? "primary" : "secondary"}
                                      />
                                    </Box>
                                    
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" color="text.secondary">Timestamp:</Typography>
                                      <Typography variant="body1">
                                        {new Date(operatorSeals.find(seal => seal.id === sealId)?.timestamp || Date.now()).toLocaleString()}
                                      </Typography>
                                    </Box>
                                    
                                    <Box>
                                      <Typography variant="body2" color="text.secondary">Image:</Typography>
                                      <Box sx={{ mt: 1, maxWidth: '200px', maxHeight: '200px' }}>
                                        <img 
                                          src="/placeholder-image.jpg" 
                                          alt="Seal Tag" 
                                          style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                                        />
                                      </Box>
                                    </Box>
                                  </>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    No operator information available
                                  </Typography>
                                )}
                              </Box>
                              
                              {/* Guard Information */}
                              <Box sx={{ flex: 1, border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: '4px', p: 2 }}>
                                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                                  Guard Information
                                </Typography>
                                
                                {source === "Guard" || source === "Both" ? (
                                  <>
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" color="text.secondary">Seal ID:</Typography>
                                      <Typography variant="body1">{sealId}</Typography>
                                    </Box>
                                    
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" color="text.secondary">Method:</Typography>
                                      <Chip 
                                        label={getSealMethod(sealId)} 
                                        size="small" 
                                        color={method === "Digitally Scanned" ? "primary" : "secondary"}
                                      />
                                    </Box>
                                    
                                    <Box sx={{ mb: 1 }}>
                                      <Typography variant="body2" color="text.secondary">Timestamp:</Typography>
                                      <Typography variant="body1">
                                        {new Date(guardScannedSeals.find(seal => seal.id === sealId)?.timestamp || Date.now()).toLocaleString()}
                                      </Typography>
                                    </Box>
                                    
                                    <Box>
                                      <Typography variant="body2" color="text.secondary">Image:</Typography>
                                      {guardScannedSeals.find(seal => seal.id === sealId)?.image ? (
                                        <Box sx={{ mt: 1, maxWidth: '200px', maxHeight: '200px' }}>
                                          <img 
                                            src={guardScannedSeals.find(seal => seal.id === sealId)?.image} 
                                            alt="Seal Tag" 
                                            style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                                          />
                                        </Box>
                                      ) : (
                                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<CloudUpload />}
                                            component="label"
                                          >
                                            Upload Image
                                            <input
                                              type="file"
                                              hidden
                                              accept="image/*"
                                              onChange={(e) => {
                                                // Handle image upload logic
                                              }}
                                            />
                                          </Button>
                                          
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<PhotoCamera />}
                                            component="label"
                                          >
                                            Capture Image
                                            <input
                                              type="file"
                                              hidden
                                              accept="image/*"
                                              capture="environment"
                                              onChange={(e) => {
                                                // Handle image capture logic
                                              }}
                                            />
                                          </Button>
                                        </Box>
                                      )}
                                    </Box>
                                  </>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    Not scanned by guard
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                            
                            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Typography variant="body2" sx={{ mr: 1 }}>Verification Status:</Typography>
                                <Chip 
                                  label={status === "Matched" ? "Verified Match" : "Not Scanned"} 
                                  size="small" 
                                  color={status === "Matched" ? "success" : "warning"}
                                />
                              </Box>
                              
                              <Button size="small" onClick={() => toggleSealDetails(sealId)}>
                                Close Details
                              </Button>
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