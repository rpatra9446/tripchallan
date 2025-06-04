"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  AlertTitle,
  CircularProgress,
  Grid,
  IconButton
} from "@mui/material";
import { 
  QrCodeScanner as QrCodeScannerIcon,
  CheckCircle,
  Close,
  Warning,
  CloudUpload,
  Done as DoneIcon
} from "@mui/icons-material";
import { SealStatus } from "@/prisma/enums";
import ClientSideQrScanner from "../ClientSideQrScanner";
import { processMultipleImages } from "@/lib/imageUtils";

interface SealVerificationProps {
  sessionId: string;
  sessionSeals: any[];
  refreshSeals: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isGuard: boolean;
  isCompleted: boolean;
}

export interface SealStatusUpdate {
  sealId: string;
  status: string;
  comment?: string;
  evidence?: SealStatusEvidence;
}

export interface SealStatusEvidence {
  photos?: string[];
  description?: string;
}

export default function SealVerification({
  sessionId,
  sessionSeals,
  refreshSeals,
  refreshSession,
  isGuard,
  isCompleted
}: SealVerificationProps) {
  // State for seal verification
  const [scannedSealIds, setScannedSealIds] = useState<Set<string>>(new Set());
  const [unscannedSealIds, setUnscannedSealIds] = useState<string[]>([]);
  const [sealStatusUpdates, setSealStatusUpdates] = useState<Record<string, SealStatusUpdate>>({});
  const [selectedSealForStatus, setSelectedSealForStatus] = useState<any>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusComment, setStatusComment] = useState('');
  const [statusEvidence, setStatusEvidence] = useState<SealStatusEvidence>({ photos: [] });
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [completingVerification, setCompletingVerification] = useState(false);
  const [verificationSummaryOpen, setVerificationSummaryOpen] = useState(false);
  const [verificationSummary, setVerificationSummary] = useState<any>(null);
  const [sealInput, setSealInput] = useState("");
  
  // Add ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add state for image modal
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [openImageModal, setOpenImageModal] = useState(false);
  
  // Load initial state
  useEffect(() => {
    if (sessionSeals) {
      // Get all verified seals
      const verifiedSeals = sessionSeals
        .filter(seal => seal.status === SealStatus.VERIFIED)
        .map(seal => seal.barcode);
      
      setScannedSealIds(new Set(verifiedSeals));
    }
  }, [sessionSeals]);
  
  // Function to handle seal scanning
  const handleScanSeal = async (sealId: string) => {
    try {
      if (!sealId) return;
      
      // Check if this seal is already scanned
      if (scannedSealIds.has(sealId)) {
        toast(`Seal ${sealId} has already been scanned.`, { 
          icon: '🔵',
          duration: 3000
        });
        return;
      }
      
      // Mark as scanned
      const newScannedSealIds = new Set(scannedSealIds);
      newScannedSealIds.add(sealId);
      setScannedSealIds(newScannedSealIds);
      
      // Update status to VERIFIED
      const statusUpdate: SealStatusUpdate = {
        sealId,
        status: SealStatus.VERIFIED
      };
      
      setSealStatusUpdates({
        ...sealStatusUpdates,
        [sealId]: statusUpdate
      });
      
      // Find the seal in our existing data
      const existingSeal = sessionSeals?.find(seal => seal.barcode === sealId);
      
      if (existingSeal) {
        // Update API
        await updateSealStatus(existingSeal.id, SealStatus.VERIFIED);
        
        // Refresh seals data
        await refreshSeals();
        
        toast.success(`Seal ${sealId} verified successfully!`);
      } else {
        toast.error(`Seal ${sealId} not found in this session.`);
      }
    } catch (error) {
      console.error("Error scanning seal:", error);
      toast.error("Failed to scan seal. Please try again.");
    }
  };
  
  // Function to open status dialog for a seal
  const openStatusDialog = (seal: any) => {
    setSelectedSealForStatus(seal);
    setStatusComment('');
    setStatusEvidence({ photos: [] });
    setStatusDialogOpen(true);
  };
  
  // Function to update seal status
  const updateSealStatus = async (sealId: string, status: string, comment?: string, evidence?: SealStatusEvidence) => {
    try {
      setIsSubmittingStatus(true);
      
      const response = await fetch(`/api/sessions/${sessionId}/seals/${sealId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          comment,
          evidence
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update seal status');
      }
      
      const data = await response.json();
      
      // Update our state
      const newStatusUpdates = { ...sealStatusUpdates };
      newStatusUpdates[sealId] = {
        sealId,
        status,
        comment,
        evidence
      };
      setSealStatusUpdates(newStatusUpdates);
      
      return data.seal;
    } catch (error) {
      console.error("Error updating seal status:", error);
      throw error;
    } finally {
      setIsSubmittingStatus(false);
    }
  };
  
  // Function to handle photo upload for status evidence
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setStatusEvidence({
        ...statusEvidence,
        photos: [...(statusEvidence.photos || []), base64String]
      });
    };
    
    reader.readAsDataURL(file);
  };
  
  // Function to handle status update submission
  const handleStatusUpdateSubmit = async () => {
    if (!selectedSealForStatus) return;
    
    try {
      // Validate evidence for BROKEN and TAMPERED statuses
      if (
        (selectedSealForStatus.status === SealStatus.BROKEN || 
         selectedSealForStatus.status === SealStatus.TAMPERED) && 
        (!statusEvidence.photos || statusEvidence.photos.length === 0)
      ) {
        toast.error(`Evidence photos are required for ${selectedSealForStatus.status} status.`);
        return;
      }
      
      await updateSealStatus(
        selectedSealForStatus.id,
        selectedSealForStatus.status,
        statusComment,
        statusEvidence
      );
      
      toast.success(`Seal status updated to ${selectedSealForStatus.status}.`);
      setStatusDialogOpen(false);
      
      // Refresh seals data
      await refreshSeals();
    } catch (error) {
      toast.error(`Failed to update seal status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Function to complete verification
  const completeVerification = async () => {
    try {
      setCompletingVerification(true);
      
      // Get all unscanned seal IDs
      const allSealTagIds = (sessionSeals || [])
        .filter(seal => seal.type === 'tag')
        .map(seal => seal.barcode);
      
      const unscannedSealTagIds = allSealTagIds.filter(id => !scannedSealIds.has(id));
      setUnscannedSealIds(unscannedSealTagIds);
      
      // Show verification summary first
      setVerificationSummary({
        totalSeals: allSealTagIds.length,
        scannedSeals: scannedSealIds.size,
        unscannedSeals: unscannedSealTagIds.length,
        statusBreakdown: {
          [SealStatus.VERIFIED]: (sessionSeals || []).filter(seal => seal.status === SealStatus.VERIFIED).length,
          [SealStatus.BROKEN]: (sessionSeals || []).filter(seal => seal.status === SealStatus.BROKEN).length,
          [SealStatus.TAMPERED]: (sessionSeals || []).filter(seal => seal.status === SealStatus.TAMPERED).length,
          [SealStatus.MISSING]: unscannedSealTagIds.length // These will be marked as MISSING
        }
      });
      setVerificationSummaryOpen(true);
    } catch (error) {
      console.error("Error preparing verification summary:", error);
      toast.error("Failed to prepare verification summary. Please try again.");
      setCompletingVerification(false);
    }
  };
  
  // Function to confirm and complete verification
  const confirmAndCompleteVerification = async () => {
    try {
      // Close the summary dialog
      setVerificationSummaryOpen(false);
      
      // Complete verification via API
      const response = await fetch(`/api/sessions/${sessionId}/complete-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationData: {
            scannedSealIds: Array.from(scannedSealIds),
            statusUpdates: sealStatusUpdates
          },
          unscannedSealTagIds: unscannedSealIds
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete verification');
      }
      
      const data = await response.json();
      
      toast.success("Verification completed successfully!");
      
      // Check if email was sent successfully
      if (data.emailSent) {
        toast.success("Verification report email sent to company", {
          duration: 5000,
          icon: '📧'
        });
      } else if (data.emailError) {
        toast.error(`Email notification failed: ${data.emailError}`, {
          duration: 5000
        });
      }
      
      // Refresh session data
      await refreshSession();
      await refreshSeals();
    } catch (error) {
      console.error("Error completing verification:", error);
      toast.error(`Failed to complete verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCompletingVerification(false);
    }
  };
  
  // Function to render the seal status badge
  const renderSealStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    
    switch (status) {
      case SealStatus.VERIFIED:
        return (
          <Chip 
            icon={<CheckCircle fontSize="small" />} 
            label="Verified" 
            color="success" 
            size="small" 
            variant="outlined"
          />
        );
      case SealStatus.MISSING:
        return (
          <Chip 
            icon={<Close fontSize="small" />} 
            label="Missing" 
            color="error" 
            size="small" 
            variant="outlined"
          />
        );
      case SealStatus.BROKEN:
        return (
          <Chip 
            icon={<Warning fontSize="small" />} 
            label="Broken" 
            color="warning" 
            size="small" 
            variant="outlined"
          />
        );
      case SealStatus.TAMPERED:
        return (
          <Chip 
            icon={<Warning fontSize="small" />} 
            label="Tampered" 
            color="error" 
            size="small" 
            variant="outlined"
          />
        );
      default:
        return (
          <Chip 
            label={status} 
            size="small" 
            variant="outlined"
          />
        );
    }
  };
  
  // Filter seals by type
  const tagSeals = sessionSeals?.filter(seal => seal.type === 'tag') || [];
  const systemSeals = sessionSeals?.filter(seal => seal.type === 'system' || seal.type === 'verification') || [];
  
  return (
    <Box sx={{ mb: 3 }}>
      {/* Add scan seal section if user is a guard and session is not completed */}
      {isGuard && !isCompleted && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Scan Seal
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3 }}>
            <TextField
              label="Seal ID"
              variant="outlined"
              value={sealInput}
              onChange={e => setSealInput(e.target.value)}
              size="small"
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<QrCodeScannerIcon />}
              onClick={() => handleScanSeal(sealInput)}
              disabled={!sealInput}
            >
              Scan
            </Button>
          </Box>
          
          {/* Progress indicators */}
          {sessionSeals && (
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Total Seal Tags:
                </Typography>
                <Typography variant="h6">
                  {tagSeals.length}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Scanned:
                </Typography>
                <Typography variant="h6" color="success.main">
                  {scannedSealIds.size}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Remaining:
                </Typography>
                <Typography variant="h6" color="warning.main">
                  {tagSeals.length - scannedSealIds.size}
                </Typography>
              </Box>
            </Box>
          )}
          
          {/* Complete verification button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<DoneIcon />}
              onClick={completeVerification}
              disabled={completingVerification || !sessionSeals || sessionSeals.length === 0}
              sx={{ minWidth: 200 }}
            >
              {completingVerification ? (
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
      
      {/* Operator Seal Tags Table */}
      {tagSeals.length > 0 && (
        <>
          <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
            Operator Seal Tags
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
                  <TableCell>Created At</TableCell>
                  <TableCell>Created By</TableCell>
                  {isGuard && !isCompleted && (
                    <TableCell>Actions</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {tagSeals.map((seal, index) => (
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
                          {seal.barcode}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        size="small" 
                        label={seal.method === 'digital' ? 'Scanned' : 'Manual'} 
                        color={seal.method === 'digital' ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {seal.imageData ? (
                        <Box 
                          component="img" 
                          src={seal.imageData} 
                          alt={`Seal tag ${seal.barcode}`}
                          sx={{ 
                            width: 60, 
                            height: 60, 
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            // Open image in modal
                            setSelectedImage(seal.imageData);
                            setOpenImageModal(true);
                          }}
                        />
                      ) : (
                        <Typography variant="caption">No image</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {renderSealStatusBadge(seal.status)}
                    </TableCell>
                    <TableCell>
                      {new Date(seal.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {seal.createdBy ? (
                        <Typography variant="body2">
                          {seal.createdBy.name || 'Unknown'} 
                          <Typography variant="caption" component="span" color="text.secondary">
                            {' '}({seal.createdBy.subrole || seal.createdBy.role || 'User'})
                          </Typography>
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Unknown
                        </Typography>
                      )}
                    </TableCell>
                    {isGuard && !isCompleted && (
                      <TableCell>
                        {seal.status === SealStatus.VERIFIED ? (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              variant="outlined"
                              color="warning"
                              size="small"
                              startIcon={<Warning fontSize="small" />}
                              onClick={() => {
                                setSelectedSealForStatus({
                                  ...seal,
                                  status: SealStatus.BROKEN
                                });
                                setStatusDialogOpen(true);
                              }}
                            >
                              Broken
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<Warning fontSize="small" />}
                              onClick={() => {
                                setSelectedSealForStatus({
                                  ...seal,
                                  status: SealStatus.TAMPERED
                                });
                                setStatusDialogOpen(true);
                              }}
                            >
                              Tampered
                            </Button>
                          </Box>
                        ) : (
                          <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<QrCodeScannerIcon />}
                            onClick={() => handleScanSeal(seal.barcode)}
                            disabled={seal.status === SealStatus.MISSING || 
                                     seal.status === SealStatus.BROKEN || 
                                     seal.status === SealStatus.TAMPERED || 
                                     scannedSealIds.has(seal.barcode)}
                          >
                            {scannedSealIds.has(seal.barcode) ? 'Scanned' : 'Scan'}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      
      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Update Seal Status
          {selectedSealForStatus && (
            <Typography variant="subtitle1" color="text.secondary">
              Seal ID: {selectedSealForStatus.barcode}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedSealForStatus && (
            <>
              <Alert 
                severity={selectedSealForStatus.status === SealStatus.BROKEN ? 'warning' : 'error'}
                sx={{ mb: 3 }}
              >
                <AlertTitle>
                  {selectedSealForStatus.status === SealStatus.BROKEN 
                    ? 'Marking Seal as Broken' 
                    : 'Marking Seal as Tampered'}
                </AlertTitle>
                <Typography variant="body2">
                  {selectedSealForStatus.status === SealStatus.BROKEN 
                    ? 'Use this option if the seal is physically damaged but appears to be an accident or normal wear.'
                    : 'Use this option if the seal shows signs of intentional tampering or unauthorized access.'}
                </Typography>
              </Alert>
              
              <TextField
                fullWidth
                label="Comments (Required)"
                multiline
                rows={3}
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                placeholder={selectedSealForStatus.status === SealStatus.BROKEN 
                  ? "Describe the damage to the seal..."
                  : "Describe the signs of tampering..."}
                required
                sx={{ mb: 3 }}
              />
              
              <Typography variant="subtitle1" gutterBottom>
                Evidence Photos (Required)
              </Typography>
              
              {statusEvidence.photos && statusEvidence.photos.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {statusEvidence.photos.map((photo, index) => (
                    <Box
                      key={index}
                      component="img"
                      src={photo}
                      sx={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No photos added yet. Please add at least one photo.
                </Typography>
              )}
              
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ mt: 1 }}
              >
                Add Photo
              </Button>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handlePhotoUpload}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} disabled={isSubmittingStatus}>
            Cancel
          </Button>
          <Button 
            onClick={handleStatusUpdateSubmit} 
            variant="contained" 
            color={selectedSealForStatus?.status === SealStatus.BROKEN ? 'warning' : 'error'}
            disabled={isSubmittingStatus || !statusComment || !statusEvidence.photos || statusEvidence.photos.length === 0}
          >
            {isSubmittingStatus ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Updating...
              </>
            ) : (
              `Confirm ${selectedSealForStatus?.status}`
            )}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Verification Summary Dialog */}
      <Dialog open={verificationSummaryOpen} onClose={() => setVerificationSummaryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Verification Summary</DialogTitle>
        <DialogContent>
          {verificationSummary && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Completing Verification</AlertTitle>
                <Typography variant="body2">
                  You are about to complete the verification process. Any unscanned seals will be marked as MISSING.
                  Please review the summary below and confirm.
                </Typography>
              </Alert>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Total Seals
                    </Typography>
                    <Typography variant="h3" align="center">
                      {verificationSummary.totalSeals}
                    </Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Scanned Seals
                    </Typography>
                    <Typography variant="h3" align="center" color="success.main">
                      {verificationSummary.scannedSeals}
                    </Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Unscanned Seals (Will be marked as MISSING)
                    </Typography>
                    <Typography variant="h3" align="center" color="error.main">
                      {verificationSummary.unscannedSeals}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>
                Status Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CheckCircle color="success" sx={{ mr: 1 }} />
                          Verified
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.VERIFIED] || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Close color="error" sx={{ mr: 1 }} />
                          Missing
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.MISSING] || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Warning color="warning" sx={{ mr: 1 }} />
                          Broken
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.BROKEN] || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Warning color="error" sx={{ mr: 1 }} />
                          Tampered
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.TAMPERED] || 0}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Typography variant="body2" color="text.secondary">
                After completion, this session will be marked as COMPLETED and the verification details will be saved.
                This action cannot be undone.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationSummaryOpen(false)} disabled={completingVerification}>
            Cancel
          </Button>
          <Button 
            onClick={confirmAndCompleteVerification} 
            variant="contained" 
            color="success"
            disabled={completingVerification}
          >
            {completingVerification ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Completing...
              </>
            ) : (
              "Complete Verification"
            )}
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
    </Box>
  );
} 