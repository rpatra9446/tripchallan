"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Box, Button, Container, Paper, Typography, Tab, Tabs, 
  Grid, TextField, Chip, IconButton, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions
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
  const [tabValue, setTabValue] = useState<string>('sealTags');
  const [guardImages, setGuardImages] = useState<Record<string, any>>({});
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  const [openImageModal, setOpenImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  
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

  // Tab change handler
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  // Handle going back
  const handleBack = () => {
    router.push(`/dashboard/sessions/${sessionId}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error" variant="h6">{error}</Typography>
        <Button variant="outlined" onClick={handleBack} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">Session not found</Typography>
        <Button variant="outlined" onClick={handleBack} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />} 
          onClick={handleBack}
          sx={{ mr: 2 }}
        >
          Back to Session
        </Button>
        <Typography variant="h5" component="h1">
          Trip Verification
        </Typography>
        <Chip 
          label="IN PROGRESS" 
          color="primary" 
          sx={{ ml: 2, fontWeight: 'bold' }}
        />
      </Box>

      {/* Session Details Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Session Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Source</Typography>
                <Typography variant="body1">{session.source}</Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Destination</Typography>
                <Typography variant="body1">{session.destination}</Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <AccessTime color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Created At</Typography>
                <Typography variant="body1">{new Date(session.createdAt).toLocaleString()}</Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <Business color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Company</Typography>
                <Typography variant="body1">{session.company?.name || 'N/A'}</Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <Person color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Created By</Typography>
                <Typography variant="body1">{session.createdBy?.name || 'N/A'}</Typography>
              </Box>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <DirectionsCar color="primary" sx={{ mr: 1, mt: 0.5 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Vehicle Number</Typography>
                <Typography variant="body1">{session.tripDetails?.vehicleNumber || 'N/A'}</Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabbed Interface */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="verification tabs" 
            variant="scrollable" 
            scrollButtons="auto"
          >
            <Tab label="Loading Details" value="loadingDetails" />
            <Tab label="Session Info" value="sessionInfo" />
            <Tab label="Seal Tags" value="sealTags" />
            <Tab label="Driver Details" value="driverDetails" />
            <Tab label="Images" value="images" />
          </Tabs>
        </Box>
        
        {/* Loading Details Tab */}
        <TabPanel value={tabValue} index="loadingDetails">
          <Typography variant="h6" gutterBottom>
            Loading Details
          </Typography>
          <Grid container spacing={2}>
            {session.tripDetails?.transporterName && (
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">{getFieldLabel('transporterName')}:</Typography>
                  <Typography>{session.tripDetails.transporterName}</Typography>
                  {verificationFields['transporterName']?.verified ? (
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
                      onClick={() => verifyField('transporterName')}
                      sx={{ mt: 1 }}
                    >
                      Verify
                    </Button>
                  )}
                </Paper>
              </Grid>
            )}
            
            {session.tripDetails?.materialName && (
              <Grid item xs={12} md={6}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">{getFieldLabel('materialName')}:</Typography>
                  <Typography>{session.tripDetails.materialName}</Typography>
                  {verificationFields['materialName']?.verified ? (
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
                      onClick={() => verifyField('materialName')}
                      sx={{ mt: 1 }}
                    >
                      Verify
                    </Button>
                  )}
                </Paper>
              </Grid>
            )}
            
            {/* Add more fields as needed */}
          </Grid>
        </TabPanel>
        
        {/* Seal Tags Tab */}
        <TabPanel value={tabValue} index="sealTags">
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
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
                  <Typography variant="h6">Operator Seals</Typography>
                  <Typography variant="h4">{operatorSeals.length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                  <Typography variant="h6">Matched Seals</Typography>
                  <Typography variant="h4">{sealComparison.matched.length}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={6}>
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
            <Grid item xs={12} md={6}>
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
        </TabPanel>
        
        {/* Complete Verification Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<CheckCircle />}
            onClick={handleVerifySeal}
            disabled={verifying || sealComparison.matched.length !== operatorSeals.length}
          >
            {verifying ? (
              <>
                <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                Verifying...
              </>
            ) : (
              'Complete Verification'
            )}
          </Button>
        </Box>
      </Paper>
      
      {/* Image Modal */}
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
              sx={{
                width: '100%',
                maxHeight: '70vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
} 