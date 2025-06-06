"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  Box, Button, Container, Paper, Typography, Tab, Tabs, 
  Grid, TextField, Chip, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  FormControlLabel, Radio, Table, TableHead, TableBody, TableRow, TableCell
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Lock, QrCodeScanner, Camera, 
  AddAPhoto, FileUpload, Close, LocationOn, AccessTime,
  Business, Person, DirectionsCar, Info, PhotoCamera
} from '@mui/icons-material';
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
        verified: true
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
    // Handle verifying a driver detail field
    const verifyField = (field: string) => {
      setVerificationFields(prev => ({
        ...prev,
        [field]: { verified: true, timestamp: new Date().toISOString() }
      }));
    };

    // Check if all driver detail fields are verified
    useEffect(() => {
      if (!session.tripDetails) return;
      
      const driverDetailFields = [
        'driverName', 'driverContactNumber', 'driverLicense'
      ];
      
      const allVerified = driverDetailFields.every(field => 
        !session.tripDetails?.[field as keyof typeof session.tripDetails] || 
        verificationFields[field]?.verified
      );
      
      setDriverDetailsVerified(allVerified);
    }, [session, verificationFields, setDriverDetailsVerified]);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Driver Details Verification
        </Typography>
        <Grid container spacing={2}>
          {session.tripDetails?.driverName && (
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">{getFieldLabel('driverName')}:</Typography>
                <Typography>{session.tripDetails.driverName}</Typography>
                {verificationFields['driverName']?.verified ? (
                  <Chip 
                    icon={<CheckCircle fontSize="small" />}
                    label="Verified" 
                    color="success" 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => verifyField('driverName')}
                    sx={{ mt: 1 }}
                  >
                    Verify
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
          
          {session.tripDetails?.driverContactNumber && (
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">{getFieldLabel('driverContactNumber')}:</Typography>
                <Typography>{session.tripDetails.driverContactNumber}</Typography>
                {verificationFields['driverContactNumber']?.verified ? (
                  <Chip 
                    icon={<CheckCircle fontSize="small" />}
                    label="Verified" 
                    color="success" 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => verifyField('driverContactNumber')}
                    sx={{ mt: 1 }}
                  >
                    Verify
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
          
          {session.tripDetails?.driverLicense && (
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">{getFieldLabel('driverLicense')}:</Typography>
                <Typography>{session.tripDetails.driverLicense}</Typography>
                {verificationFields['driverLicense']?.verified ? (
                  <Chip 
                    icon={<CheckCircle fontSize="small" />}
                    label="Verified" 
                    color="success" 
                    size="small"
                    sx={{ mt: 1 }}
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => verifyField('driverLicense')}
                    sx={{ mt: 1 }}
                  >
                    Verify
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
          
          {/* Driver image if available */}
          {session.images?.driverPicture && (
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Driver Picture:</Typography>
                <Box sx={{ mt: 1, mb: 1 }}>
                  <img 
                    src={session.images.driverPicture} 
                    alt="Driver" 
                    style={{ maxWidth: '100%', maxHeight: '200px', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedImage(session.images?.driverPicture || '');
                      setOpenImageModal(true);
                    }}
                  />
                </Box>
                {verificationFields['driverPicture']?.verified ? (
                  <Chip 
                    icon={<CheckCircle fontSize="small" />}
                    label="Verified" 
                    color="success" 
                    size="small"
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => verifyField('driverPicture')}
                  >
                    Verify
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
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
    // Check if all seals are verified
    useEffect(() => {
      const allSealsVerified = operatorSeals.length > 0 && 
        sealComparison.matched.length === operatorSeals.length;
      
      setSealTagsVerified(allSealsVerified);
    }, [operatorSeals, sealComparison, setSealTagsVerified]);

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Tag Verification
        </Typography>
        
        {/* Scanning Form */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Scan or Enter Seal Tags
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
            <TextField
              label="Seal Tag Barcode"
              variant="outlined"
              fullWidth
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              error={!!scanError}
              helperText={scanError}
              sx={{ mr: 2 }}
            />
            <Button
              variant="contained"
              onClick={() => handleScanComplete(scanInput, 'manual')}
              startIcon={<AddAPhoto />}
            >
              Add Manually
            </Button>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Use QR scanner or enter seal tag barcode manually
          </Typography>
        </Paper>
        
        {/* Seal Comparison */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Seal Verification Status
          </Typography>
          <Grid container spacing={2}>
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
              <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                <Typography variant="h6">Operator Seals</Typography>
                <Typography variant="h4">{operatorSeals.length}</Typography>
              </Paper>
            </Grid>
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
              <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                <Typography variant="h6">Matched Seals</Typography>
                <Typography variant="h4">{sealComparison.matched.length}</Typography>
              </Paper>
            </Grid>
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 4' } }}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Typography variant="h6">Mismatched Seals</Typography>
                <Typography variant="h4">{sealComparison.mismatched.length}</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
        
        {/* Seal Lists */}
        <Grid container spacing={3}>
          {/* Operator Seals */}
          <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                Operator Seals
              </Typography>
              {operatorSeals.length > 0 ? (
                operatorSeals.map((seal, index) => (
                  <Chip 
                    key={`op-${index}`}
                    label={seal.id}
                    color={sealComparison.matched.includes(seal.id) ? "success" : "default"}
                    sx={{ m: 0.5 }}
                    icon={sealComparison.matched.includes(seal.id) ? <CheckCircle /> : undefined}
                  />
                ))
              ) : (
                <Typography color="text.secondary">No operator seals found</Typography>
              )}
            </Paper>
          </Grid>
          
          {/* Guard Scanned Seals */}
          <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>
                Guard Scanned Seals
              </Typography>
              {guardScannedSeals.length > 0 ? (
                guardScannedSeals.map((seal, index) => (
                  <Chip 
                    key={`guard-${index}`}
                    label={seal.id}
                    color={seal.verified ? "success" : "error"}
                    sx={{ m: 0.5 }}
                    icon={seal.verified ? <CheckCircle /> : <Info />}
                  />
                ))
              ) : (
                <Typography color="text.secondary">No seals scanned yet</Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
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
        [imageKey]: { verified: true, timestamp: new Date().toISOString() }
      }));
    };

    // Handle image comment change
    const handleImageCommentChange = (imageKey: string, comment: string) => {
      setImageComments(prev => ({
        ...prev,
        [imageKey]: comment
      }));
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

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Images Verification
        </Typography>
        <Grid container spacing={2}>
          {/* Vehicle Number Plate Image */}
          {session.images?.vehicleNumberPlatePicture && (
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">Vehicle Number Plate:</Typography>
                <Box sx={{ mt: 1, mb: 1 }}>
                  <img 
                    src={session.images.vehicleNumberPlatePicture} 
                    alt="Vehicle Number Plate" 
                    style={{ maxWidth: '100%', maxHeight: '200px', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedImage(session.images?.vehicleNumberPlatePicture || '');
                      setOpenImageModal(true);
                    }}
                  />
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  variant="outlined"
                  placeholder="Add verification notes..."
                  value={imageComments['vehicleNumberPlatePicture'] || ''}
                  onChange={(e) => handleImageCommentChange('vehicleNumberPlatePicture', e.target.value)}
                  sx={{ mb: 1 }}
                />
                {verificationFields['vehicleNumberPlatePicture']?.verified ? (
                  <Chip 
                    icon={<CheckCircle fontSize="small" />}
                    label="Verified" 
                    color="success" 
                    size="small"
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => verifyImage('vehicleNumberPlatePicture')}
                  >
                    Verify
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
          
          {/* GPS IMEI Image */}
          {session.images?.gpsImeiPicture && (
            <Grid sx={{ gridColumn: { xs: 'span 12', md: 'span 6' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">GPS IMEI Picture:</Typography>
                <Box sx={{ mt: 1, mb: 1 }}>
                  <img 
                    src={session.images.gpsImeiPicture} 
                    alt="GPS IMEI" 
                    style={{ maxWidth: '100%', maxHeight: '200px', cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedImage(session.images?.gpsImeiPicture || '');
                      setOpenImageModal(true);
                    }}
                  />
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  variant="outlined"
                  placeholder="Add verification notes..."
                  value={imageComments['gpsImeiPicture'] || ''}
                  onChange={(e) => handleImageCommentChange('gpsImeiPicture', e.target.value)}
                  sx={{ mb: 1 }}
                />
                {verificationFields['gpsImeiPicture']?.verified ? (
                  <Chip 
                    icon={<CheckCircle fontSize="small" />}
                    label="Verified" 
                    color="success" 
                    size="small"
                  />
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => verifyImage('gpsImeiPicture')}
                  >
                    Verify
                  </Button>
                )}
              </Paper>
            </Grid>
          )}
          
          {/* Vehicle Images Gallery */}
          {session.images?.vehicleImages && session.images.vehicleImages.length > 0 && (
            <Grid sx={{ gridColumn: { xs: 'span 12' } }}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Vehicle Images:
                </Typography>
                <Grid container spacing={1}>
                  {session.images.vehicleImages.map((imageUrl, index) => (
                    <Grid sx={{ gridColumn: { xs: 'span 6', sm: 'span 4', md: 'span 3' } }} key={`vehicle-${index}`}>
                      <Box 
                        sx={{ 
                          border: '1px solid #eee', 
                          borderRadius: 1, 
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        <img 
                          src={imageUrl} 
                          alt={`Vehicle ${index + 1}`} 
                          style={{ 
                            width: '100%', 
                            height: '150px', 
                            objectFit: 'cover',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setSelectedImage(imageUrl);
                            setOpenImageModal(true);
                          }}
                        />
                        {verificationFields[`vehicleImage_${index}`]?.verified ? (
                          <Chip 
                            icon={<CheckCircle fontSize="small" />}
                            label="Verified" 
                            color="success" 
                            size="small"
                            sx={{ 
                              position: 'absolute', 
                              bottom: 4, 
                              right: 4,
                              fontSize: '0.7rem'
                            }}
                          />
                        ) : (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => verifyImage(`vehicleImage_${index}`)}
                            sx={{ 
                              position: 'absolute', 
                              bottom: 4, 
                              right: 4,
                              minWidth: 0,
                              p: 0.5
                            }}
                          >
                            <CheckCircle fontSize="small" />
                          </Button>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Grid>
          )}
        </Grid>
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