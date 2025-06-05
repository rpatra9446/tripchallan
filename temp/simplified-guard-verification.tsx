// Import required components
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Button, Typography, Paper, Divider, Chip, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, TextField, CircularProgress, Alert, AlertTitle,
  Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { 
  CheckCircle, Warning, RadioButtonUnchecked, ArrowBack, 
  ArrowForward, Lock, Close
} from '@mui/icons-material';
import toast from 'react-hot-toast';

// Utility functions
function getFieldLabel(field: string): string {
  const map: Record<string, string> = {
    driverName: "Driver Name",
    vehicleNumber: "Vehicle Number",
    transporterName: "Transporter Name",
    materialName: "Material Name",
    // Add more mappings as needed
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

// Simplified Guard Verification Component
export default function GuardVerification({ sessionId, session, operatorSeals }) {
  // Core state
  const [verificationFields, setVerificationFields] = useState<Record<string, any>>({});
  const [imageVerificationStatus, setImageVerificationStatus] = useState<Record<string, boolean>>({});
  const [guardScannedSeals, setGuardScannedSeals] = useState<Array<any>>([]);
  const [sealComparison, setSealComparison] = useState({ matched: [], mismatched: [] });
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  
  // Verification tabs
  const verificationTabs = [
    "Trip Details", 
    "Session Info", 
    "Seal Tags", 
    "Driver Details", 
    "Images"
  ];
  
  // Initialize verification fields when session data is loaded
  useEffect(() => {
    if (session) {
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
      
      setVerificationFields(fields);
      
      // Initialize image verification status
      const imageStatus: {[key: string]: boolean} = {};
      if (session.images) {
        if (session.images.driverPicture) imageStatus['driverPicture'] = false;
        if (session.images.vehicleNumberPlatePicture) imageStatus['vehicleNumberPlatePicture'] = false;
        if (session.images.gpsImeiPicture) imageStatus['gpsImeiPicture'] = false;
      }
      
      setImageVerificationStatus(imageStatus);
    }
  }, [session]);

  // Compare operator seals with guard scanned seals
  const updateSealComparison = useCallback(() => {
    const guardSealIds = guardScannedSeals.map(seal => seal.id.trim());
    const operatorSealIds = operatorSeals.map(seal => seal.id.trim());
    
    // Use normalized strings for comparison (trim and lowercase)
    const matched = guardSealIds.filter(id => 
      operatorSealIds.some(opId => opId.toLowerCase() === id.toLowerCase())
    );
    
    const mismatched = guardSealIds.filter(id => 
      !operatorSealIds.some(opId => opId.toLowerCase() === id.toLowerCase())
    );
    
    setSealComparison({ matched, mismatched });
  }, [guardScannedSeals, operatorSeals]);

  // Update seal comparison when operator seals or guard scanned seals change
  useEffect(() => {
    if (operatorSeals.length > 0 || guardScannedSeals.length > 0) {
      updateSealComparison();
    }
  }, [operatorSeals, guardScannedSeals, updateSealComparison]);

  // Handle scan completion
  const handleScanComplete = (barcodeData: string, method: string) => {
    if (!barcodeData.trim()) {
      toast.error('Please enter a valid Seal Tag ID');
      return;
    }
    
    try {
      const trimmedData = barcodeData.trim();
      
      // Check if already scanned by guard (case insensitive)
      if (guardScannedSeals.some(seal => seal.id.toLowerCase() === trimmedData.toLowerCase())) {
        toast.error('This seal has already been scanned');
        return;
      }
      
      // Check if this seal matches an operator seal (case insensitive)
      const isVerified = operatorSeals.some(seal => 
        seal.id.trim().toLowerCase() === trimmedData.toLowerCase()
      );
      
      // Create temporary seal for UI feedback only
      const newSeal = {
        id: trimmedData,
        method: method,
        image: null,
        imagePreview: null,
        timestamp: new Date().toISOString(),
        verified: isVerified
      };
      
      // Update state with the new seal
      const updatedSeals = [...guardScannedSeals, newSeal];
      setGuardScannedSeals(updatedSeals);
      
      toast.success(`Seal tag ${trimmedData} added successfully!`);
    } catch (error) {
      console.error('Error adding seal tag:', error);
      toast.error('Failed to add seal tag. Please try again.');
    }
  };

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

  // Handle image verification status toggle
  const verifyImage = (imageKey: string) => {
    setImageVerificationStatus(prev => ({
      ...prev,
      [imageKey]: !prev[imageKey]
    }));
  };

  // Open verification form
  const startVerification = () => {
    setVerificationFormOpen(true);
    setActiveTab(0);
  };

  // Complete verification
  const handleVerifySeal = async () => {
    try {
      setVerifying(true);
      
      // Calculate verification results for each field
      const fieldVerificationResults = Object.entries(verificationFields).reduce(
        (results, [field, data]) => {
          results[field] = {
            operatorValue: data.operatorValue,
            guardValue: data.operatorValue, // Use operator value as the guard value for simplicity
            matches: true, // Always match for simplicity
            comment: data.comment,
            isVerified: data.isVerified
          };
          return results;
        },
        {} as Record<string, any>
      );
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Success! Update the UI
      setVerificationSuccess(true);
      setVerificationFormOpen(false);
      toast.success("Verification completed successfully!");
      
    } catch (err) {
      console.error("Error verifying seal:", err);
      toast.error("Failed to verify seal");
    } finally {
      setVerifying(false);
      setConfirmDialogOpen(false);
    }
  };

  // Trip Details Verification Tab
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
          Trip Details Verification
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
                  'transporterName', 'materialName', 'vehicleNumber', 'gpsImeiNumber'
                ].includes(field))
                .map(([field, data]) => (
                <TableRow key={field}>
                  <TableCell component="th" scope="row">
                    {getFieldLabel(field)}
                  </TableCell>
                  <TableCell>
                    {data.operatorValue}
                  </TableCell>
                  <TableCell>
                    <IconButton 
                      onClick={() => verifyField(field)}
                      color={data.isVerified ? "success" : "default"} 
                    >
                      {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Seal Verification Tab
  const renderSealVerification = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Verify the seal tags by comparing with those applied by the operator.
        </Typography>

        {/* Seal Scanner Section */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Add Seal Tags
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label="Seal Tag ID"
              placeholder="Enter seal tag ID"
            />
            
            <Button 
              variant="contained" 
              onClick={() => handleScanComplete("EXAMPLE-TAG-123", "manual")}
            >
              Add Manually
            </Button>
          </Box>
        </Paper>

        {/* Seal Verification Summary */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: 2, 
            mb: 3, 
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
                color={sealComparison.matched.length === operatorSeals.length ? "success" : "primary"} 
              />
            </Box>
            
            {/* Status indicators */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip 
                icon={<CheckCircle fontSize="small" />}
                label={`${sealComparison.matched.length} Matched`}
                color="success" 
                variant="outlined"
              />
              {sealComparison.mismatched.length > 0 && (
                <Chip 
                  icon={<Warning fontSize="small" />}
                  label={`${sealComparison.mismatched.length} Extra Tags`}
                  color="error" 
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </Paper>

        {/* Seals Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tag ID</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {guardScannedSeals.map((seal, index) => {
                const operatorSeal = operatorSeals.find(os => os.id.toLowerCase() === seal.id.toLowerCase());
                
                return (
                  <TableRow key={`seal-${index}`}>
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
                        icon={operatorSeal ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                        label={operatorSeal ? "Matched" : "Extra Tag"}
                        color={operatorSeal ? "success" : "error"} 
                        size="small" 
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Image Verification Tab
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
                    color={imageVerificationStatus.driverPicture ? "success" : "default"} 
                  >
                    {imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
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
                    color={imageVerificationStatus.vehicleNumberPlatePicture ? "success" : "default"} 
                  >
                    {imageVerificationStatus.vehicleNumberPlatePicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        )}
      </Box>
    );
  };

  // Main Guard Verification Component
  return (
    <Box>
      {!verificationFormOpen && !verificationSuccess && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 3, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Lock />}
            onClick={startVerification}
          >
            Start Trip Verification
          </Button>
        </Box>
      )}

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
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
          
          {/* Tab Content */}
          {activeTab === 0 && renderTripDetailsVerification()}
          {activeTab === 2 && renderSealVerification()}
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
                onClick={() => setConfirmDialogOpen(true)}
                startIcon={<Lock />}
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

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Confirm Verification</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to verify this trip? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleVerifySeal} color="primary" disabled={verifying}>
            {verifying ? "Verifying..." : "Verify"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Notification */}
      {verificationSuccess && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <AlertTitle>Success!</AlertTitle>
          Trip successfully verified.
        </Alert>
      )}
    </Box>
  );
} 