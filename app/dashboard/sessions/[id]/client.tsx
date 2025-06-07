"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Container from '@mui/material/Container';
import LockOpen from '@mui/icons-material/LockOpen';

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
  Person,
  Phone,
  QrCode,
  Refresh,
  BusinessCenter,
  Close,
  Inventory,
  Router,
  Money,
  Assessment,
  Scale,
  Comment as CommentIcon,
  Business,
  CardMembership,
  CameraAlt
} from "@mui/icons-material";
import Link from "next/link";
import { UserRole, EmployeeSubrole, SessionStatus } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';
// Import autoTable as a separate named import instead of side-effect import
import autoTable from 'jspdf-autotable';
import toast from "react-hot-toast";
import { formatTimestampExact } from '@/lib/date-utils';

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
    details?: {
      verification?: {
        fieldVerifications?: Record<string, any>;
        allMatch?: boolean;
      };
    };
  }[];
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

// Add a custom TabPanel component that doesn't rely on @mui/lab
interface CustomTabPanelProps {
  children?: React.ReactNode;
  value: string;
  index: string;
}

function CustomTabPanel(props: CustomTabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
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

// Add a dedicated verification view for guards with tabbed interface
function GuardVerificationTabbedView({
  session,
  sessionId,
  operatorSeals,
  guardScannedSeals,
  handleScanComplete,
  scanInput,
  setScanInput,
  scanError,
  sealComparison,
  handleBack,
  handleVerifySeal
}: {
  session: SessionType;
  sessionId: string;
  operatorSeals: Array<{id: string, method?: string, timestamp?: string}>;
  guardScannedSeals: Array<any>;
  handleScanComplete: (barcodeData: string, method: string, imageFile?: File) => Promise<void>;
  scanInput: string;
  setScanInput: React.Dispatch<React.SetStateAction<string>>;
  scanError: string;
  sealComparison: {matched: string[], mismatched: string[]};
  handleBack: () => void;
  handleVerifySeal: () => Promise<void>;
}) {
  const [tabValue, setTabValue] = useState<string>('sealTags');

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };
  
  // Local wrapper for handleVerifySeal to ensure it's defined in this component
  const onVerifySealClick = () => {
    if (handleVerifySeal) {
      handleVerifySeal();
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button 
          variant="outlined" 
          startIcon={<ArrowBack />} 
          onClick={handleBack}
          sx={{ mr: 2 }}
        >
          Back to Sessions
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

      {/* Tabbed Interface - Replace TabContext with standard Tabs */}
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
        <CustomTabPanel value={tabValue} index="loadingDetails">
          <Typography variant="h6" gutterBottom>
            Loading Details
          </Typography>
          <Grid container spacing={2}>
            {session.tripDetails?.transporterName && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Transporter Name:</Typography>
                <Typography>{session.tripDetails.transporterName}</Typography>
              </Grid>
            )}
            {session.tripDetails?.materialName && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Material Name:</Typography>
                <Typography>{session.tripDetails.materialName}</Typography>
              </Grid>
            )}
            {session.tripDetails?.loadingSite && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Loading Site:</Typography>
                <Typography>{session.tripDetails.loadingSite}</Typography>
              </Grid>
            )}
            {session.tripDetails?.netMaterialWeight && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Net Material Weight:</Typography>
                <Typography>{session.tripDetails.netMaterialWeight} kg</Typography>
              </Grid>
            )}
            {session.tripDetails?.grossWeight && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Gross Weight:</Typography>
                <Typography>{session.tripDetails.grossWeight} kg</Typography>
              </Grid>
            )}
            {session.tripDetails?.tareWeight && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Tare Weight:</Typography>
                <Typography>{session.tripDetails.tareWeight} kg</Typography>
              </Grid>
            )}
          </Grid>
        </CustomTabPanel>
        
        {/* Session Info Tab */}
        <CustomTabPanel value={tabValue} index="sessionInfo">
          <Typography variant="h6" gutterBottom>
            Session Information
          </Typography>
          <Grid container spacing={2}>
            {session.tripDetails?.doNumber && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">DO Number:</Typography>
                <Typography>{session.tripDetails.doNumber}</Typography>
              </Grid>
            )}
            {session.tripDetails?.challanRoyaltyNumber && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Challan/Royalty Number:</Typography>
                <Typography>{session.tripDetails.challanRoyaltyNumber}</Typography>
              </Grid>
            )}
            {session.tripDetails?.tpNumber && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">TP Number:</Typography>
                <Typography>{session.tripDetails.tpNumber}</Typography>
              </Grid>
            )}
            {session.tripDetails?.freight && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Freight:</Typography>
                <Typography>{session.tripDetails.freight}</Typography>
              </Grid>
            )}
            {session.tripDetails?.gpsImeiNumber && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">GPS IMEI Number:</Typography>
                <Typography>{session.tripDetails.gpsImeiNumber}</Typography>
              </Grid>
            )}
            {session.tripDetails?.receiverPartyName && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Receiver Party Name:</Typography>
                <Typography>{session.tripDetails.receiverPartyName}</Typography>
              </Grid>
            )}
          </Grid>
        </CustomTabPanel>
        
        {/* Seal Tags Tab */}
        <CustomTabPanel value={tabValue} index="sealTags">
          <Box>
            <Typography variant="h6" gutterBottom>
              Seal Tags Verification
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
            </Typography>
            
            <Box sx={{ mt: 3, mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Scan Seal Tags
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Seal Tag ID"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    error={!!scanError}
                    helperText={scanError}
                    placeholder="Enter seal tag ID"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && scanInput) {
                        handleScanComplete(scanInput, 'manual');
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={6} md={3}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => scanInput && handleScanComplete(scanInput, 'manual')}
                  >
                    Add Manually
                  </Button>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={() => handleScanComplete(scanInput, 'digital')}
                  >
                    Scan QR/Barcode
                  </Button>
                </Grid>
              </Grid>
            </Box>
            
            <Box sx={{ mt: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mr: 2 }}>
                  Verification Progress:
                </Typography>
                <Chip 
                  label={`${sealComparison.matched.length}/${operatorSeals.length} Verified`} 
                  color="primary" 
                  size="medium"
                />
                {operatorSeals.length - sealComparison.matched.length > 0 && (
                  <Chip 
                    label={`${operatorSeals.length - sealComparison.matched.length} Not Scanned`} 
                    color="warning" 
                    size="medium"
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Seal Tag ID</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {operatorSeals.map((seal, index) => {
                      const isVerified = sealComparison.matched.includes(seal.id);
                      const guardSeal = guardScannedSeals.find(gs => gs.id === seal.id);
                      
                      return (
                        <TableRow key={seal.id}>
                          <TableCell>{seal.id}</TableCell>
                          <TableCell>
                            <Chip 
                              label={guardSeal ? getMethodDisplay(guardSeal.method) : 'Operator'} 
                              color={guardSeal ? "primary" : "default"} 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label="Operator" 
                              color="info" 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={isVerified ? "Scanned" : "Not Scanned"} 
                              color={isVerified ? "success" : "error"} 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {!isVerified && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => handleScanComplete(seal.id, 'manual')}
                              >
                                Mark as Scanned
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {guardScannedSeals.filter(gs => !operatorSeals.some(os => os.id === gs.id)).map((seal) => (
                      <TableRow key={seal.id}>
                        <TableCell>{seal.id}</TableCell>
                        <TableCell>
                          <Chip 
                            label={getMethodDisplay(seal.method)} 
                            color="primary" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label="Guard" 
                            color="secondary" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label="Not Matched" 
                            color="error" 
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="error">
                            Tag not found in operator seals
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        </CustomTabPanel>
        
        {/* Driver Details Tab */}
        <CustomTabPanel value={tabValue} index="driverDetails">
          <Typography variant="h6" gutterBottom>
            Driver Details
          </Typography>
          <Grid container spacing={2}>
            {session.tripDetails?.driverName && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Driver Name:</Typography>
                <Typography>{session.tripDetails.driverName}</Typography>
              </Grid>
            )}
            {session.tripDetails?.driverContactNumber && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Contact Number:</Typography>
                <Typography>{session.tripDetails.driverContactNumber}</Typography>
              </Grid>
            )}
            {session.tripDetails?.driverLicense && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">License:</Typography>
                <Typography>{session.tripDetails.driverLicense}</Typography>
              </Grid>
            )}
            {session.tripDetails?.loaderName && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Loader Name:</Typography>
                <Typography>{session.tripDetails.loaderName}</Typography>
              </Grid>
            )}
            {session.tripDetails?.loaderMobileNumber && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" fontWeight="bold">Loader Mobile Number:</Typography>
                <Typography>{session.tripDetails.loaderMobileNumber}</Typography>
              </Grid>
            )}
            {session.images?.driverPicture && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  Driver Photo:
                </Typography>
                <Box 
                  component="img" 
                  src={session.images.driverPicture}
                  alt="Driver Photo"
                  sx={{ 
                    maxWidth: '200px', 
                    maxHeight: '200px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    p: 1
                  }}
                />
              </Grid>
            )}
          </Grid>
        </CustomTabPanel>
        
        {/* Images Tab */}
        <CustomTabPanel value={tabValue} index="images">
          <Typography variant="h6" gutterBottom>
            Vehicle & Document Images
          </Typography>
          <Grid container spacing={2}>
            {session.images?.vehicleNumberPlatePicture && (
              <Grid item xs={12} sm={6} md={4}>
                <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
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
              </Grid>
            )}
            
            {session.images?.gpsImeiPicture && (
              <Grid item xs={12} sm={6} md={4}>
                <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
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
              </Grid>
            )}
            
            {session.images?.vehicleImages && session.images.vehicleImages.length > 0 && (
              session.images.vehicleImages.map((imageUrl, index) => (
                <Grid item xs={12} sm={6} md={4} key={`vehicle-${index}`}>
                  <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
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
                </Grid>
              ))
            )}
            
            {(!session.images?.vehicleNumberPlatePicture && 
              !session.images?.gpsImeiPicture && 
              (!session.images?.vehicleImages || session.images.vehicleImages.length === 0)) && (
              <Grid item xs={12}>
                <Alert severity="info">No images available</Alert>
              </Grid>
            )}
          </Grid>
        </CustomTabPanel>
      </Paper>
      
      {/* Comments Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CommentIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6">
            Comments
          </Typography>
        </Box>
        <CommentSection sessionId={sessionId} />
      </Paper>
      
      {/* Complete Verification Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<CheckCircle />}
          onClick={onVerifySealClick}
          disabled={sealComparison.matched.length !== operatorSeals.length}
        >
          Complete Verification
        </Button>
      </Box>
    </Container>
  );
}

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { data: authSession } = useSession();
  
  // Core state
  const [session, setSession] = useState<SessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabValue, setTabValue] = useState('details');
  const [confirmStartVerification, setConfirmStartVerification] = useState(false);
  const [comment, setComment] = useState('');
  const [commentUrgency, setCommentUrgency] = useState('NA');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [openImageModal, setOpenImageModal] = useState(false);
  
  // Load session data on mount
  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails();
      fetchComments();
    }
  }, [sessionId]);

  // Fetch session details
  const fetchSessionDetails = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.status}`);
      }
      
      const data = await response.json();
      setSession(data);
    } catch (err: any) {
      console.error('Error fetching session details:', err);
      setError(err.message || 'Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch comments
  const fetchComments = async () => {
    setLoadingComments(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  // Handle submitting a comment
  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    
    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content: comment,
          urgency: commentUrgency
        }),
      });
      
      if (response.ok) {
        setComment('');
        setCommentUrgency('NA');
        fetchComments();
      } else {
        toast.error('Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Handle start verification
  const handleStartVerification = () => {
    if (session && authSession) {
      // If user is a guard, go to guard verification
      if (authSession.user.subrole === EmployeeSubrole.GUARD) {
        router.push(`/dashboard/sessions/${sessionId}/verify`);
      } else {
        // Otherwise confirm starting verification
        setConfirmStartVerification(true);
      }
    }
  };

  // Handle confirmation of start verification
  const confirmVerification = () => {
    setConfirmStartVerification(false);
    router.push(`/dashboard/sessions/${sessionId}/verify`);
  };

  // Handle back button click
  const handleBack = () => {
    router.push('/dashboard/sessions');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          <AlertTitle>Error</AlertTitle>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          <AlertTitle>No Data</AlertTitle>
          Session not found
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: '1200px', margin: '0 auto' }}>
      {/* Back button */}
      <Button
        variant="text"
        startIcon={<ArrowBack />}
        onClick={handleBack}
        sx={{ mb: 2 }}
      >
        Back to Sessions
      </Button>

      {/* Trip Details */}
      <Paper elevation={1} sx={{ mb: 3, overflow: 'hidden' }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          p: 2,
          borderBottom: '1px solid rgba(0,0,0,0.1)' 
        }}>
          <Typography variant="h5" component="h1">Trip Details</Typography>
          <Chip 
            label={session.status === SessionStatus.ACTIVE ? "IN PROGRESS" : session.status} 
            color={
              session.status === SessionStatus.ACTIVE ? "primary" : 
              session.status === SessionStatus.COMPLETED ? "success" : 
              session.status === SessionStatus.CANCELLED ? "error" : 
              "default"
            }
          />
        </Box>

        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>Basic Information</Typography>
          
          <Grid container spacing={3}>
            {/* Left Column: Source, Destination, Created At */}
            <Grid item xs={12} md={6}>
              {/* Source */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Source:</Typography>
                  <Typography variant="body1">{session.source || 'SourceData'}</Typography>
                </Box>
              </Box>

              {/* Destination */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <LocationOn color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Destination:</Typography>
                  <Typography variant="body1">{session.destination || 'DestinationData'}</Typography>
                </Box>
              </Box>

              {/* Created Timestamp */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <AccessTime color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Created:</Typography>
                  <Typography variant="body1">
                    {new Date(session.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'numeric',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: 'numeric',
                      hour12: true
                    })}
                  </Typography>
                </Box>
              </Box>
            </Grid>

            {/* Right Column: Vehicle Number, Company, Created By */}
            <Grid item xs={12} md={6}>
              {/* Vehicle Number */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <DirectionsCar color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Vehicle Number:</Typography>
                  <Typography variant="body1">{session.tripDetails?.vehicleNumber || 'MH02AB1234'}</Typography>
                </Box>
              </Box>

              {/* Company */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <Business color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Company:</Typography>
                  <Typography variant="body1">{session.company?.name || 'roshanzpatra'}</Typography>
                </Box>
              </Box>

              {/* Operator Created */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                <Person color="primary" sx={{ mr: 1, mt: 0.5 }} />
                <Box>
                  <Typography variant="body2" color="text.secondary">Operator Created:</Typography>
                  <Typography variant="body1">{session.createdBy?.name || 'kashi'}</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Show loading details section for completed sessions or non-guard users */}
      {(session.status === SessionStatus.COMPLETED || 
        (session.status === SessionStatus.IN_PROGRESS && authSession?.user?.subrole !== EmployeeSubrole.GUARD)) && (
        <>
                    {/* Loading Details Section */}
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Loading Details</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Entered At</TableCell>
                    <TableCell>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {session.tripDetails && Object.entries(session.tripDetails)
                    .filter(([key]) => !isSystemField(key))
                    .map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell>{getFieldLabel(key)}</TableCell>
                        <TableCell>
                          {session.timestamps?.loadingDetails?.[key] 
                            ? formatTimestampExact(session.timestamps.loadingDetails[key])
                            : 'Jan 15, 2024 14:30:22'}
                        </TableCell>
                        <TableCell>{value || 'N/A'}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          
          {/* Seal Tags Section */}
          {session.sealTags && session.sealTags.length > 0 && (
            <Paper elevation={1} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6">Seal Tags</Typography>
              </Box>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>No.</TableCell>
                      <TableCell>Seal Tag ID</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>Created At</TableCell>
                      <TableCell>Created By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {session.sealTags.map((tag, index) => (
                      <TableRow key={tag.id || index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{tag.barcode}</TableCell>
                        <TableCell>
                          <Chip 
                            label={getMethodDisplay(tag.method)} 
                            color={getMethodColor(tag.method)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {tag.imageData ? (
                            <Box
                              component="img"
                              src={tag.imageData}
                              alt={`Seal ${tag.barcode}`}
                              sx={{ 
                                width: 50, 
                                height: 50, 
                                borderRadius: 1,
                                cursor: 'pointer',
                                objectFit: 'cover'
                              }}
                              onClick={() => {
                                setSelectedImage(tag.imageData || '');
                                setOpenImageModal(true);
                              }}
                            />
                          ) : (
                            'N/A'
                          )}
                        </TableCell>
                        <TableCell>{new Date(tag.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{tag.scannedByName || session.createdBy?.name || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
          
          {/* Driver Details Section */}
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Driver Details</Typography>
            </Box>
            
            <Box sx={{ p: 3 }}>
              <Grid container spacing={2}>
                {session.tripDetails?.driverName && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="bold">Driver Name:</Typography>
                    <Typography>{session.tripDetails.driverName}</Typography>
                  </Grid>
                )}
                {session.tripDetails?.driverContactNumber && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="bold">Contact Number:</Typography>
                    <Typography>{session.tripDetails.driverContactNumber}</Typography>
                  </Grid>
                )}
                {session.tripDetails?.driverLicense && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="bold">License:</Typography>
                    <Typography>{session.tripDetails.driverLicense}</Typography>
                  </Grid>
                )}
                
                {session.images?.driverPicture && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" fontWeight="bold">Driver Photo:</Typography>
                    <Box
                      component="img"
                      src={session.images.driverPicture}
                      alt="Driver"
                      sx={{ 
                        width: 150, 
                        height: 150, 
                        objectFit: 'cover',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        border: '1px solid #ddd'
                      }}
                      onClick={() => {
                        setSelectedImage(session.images?.driverPicture || '');
                        setOpenImageModal(true);
                      }}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>
          </Paper>
          
          {/* Images Section */}
          {session.images && (
            <Paper elevation={1} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6">Images</Typography>
              </Box>
              
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {session.images?.vehicleNumberPlatePicture && (
                    <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Typography variant="subtitle2" gutterBottom>Number Plate</Typography>
                      <img 
                        src={session.images.vehicleNumberPlatePicture} 
                        alt="Vehicle Number Plate" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                        onClick={() => {
                          setSelectedImage(session.images?.vehicleNumberPlatePicture || '');
                          setOpenImageModal(true);
                        }}
                      />
                    </Box>
                  )}
                  
                  {session.images?.gpsImeiPicture && (
                    <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Typography variant="subtitle2" gutterBottom>GPS/IMEI</Typography>
                      <img 
                        src={session.images.gpsImeiPicture} 
                        alt="GPS IMEI" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                        onClick={() => {
                          setSelectedImage(session.images?.gpsImeiPicture || '');
                          setOpenImageModal(true);
                        }}
                      />
                    </Box>
                  )}
                  
                  {/* Display sealing images */}
                  {session.images?.sealingImages && session.images.sealingImages.length > 0 && (
                    <>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Sealing Images</Typography>
                      </Box>
                      {session.images.sealingImages.map((image, index) => (
                        <Box key={`sealing-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <img 
                            src={image} 
                            alt={`Sealing ${index + 1}`} 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                            onClick={() => {
                              setSelectedImage(image);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      ))}
                    </>
                  )}
                  
                  {/* Display vehicle images */}
                  {session.images?.vehicleImages && session.images.vehicleImages.length > 0 && (
                    <>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Vehicle Images</Typography>
                      </Box>
                      {session.images.vehicleImages.map((image, index) => (
                        <Box key={`vehicle-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <img 
                            src={image} 
                            alt={`Vehicle ${index + 1}`} 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                            onClick={() => {
                              setSelectedImage(image);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      ))}
                    </>
                  )}
                  
                  {/* Display additional images */}
                  {session.images?.additionalImages && session.images.additionalImages.length > 0 && (
                    <>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Additional Images</Typography>
                      </Box>
                      {session.images.additionalImages.map((image, index) => (
                        <Box key={`additional-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <img 
                            src={image} 
                            alt={`Additional ${index + 1}`} 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                            onClick={() => {
                              setSelectedImage(image);
                              setOpenImageModal(true);
                            }}
                          />
                        </Box>
                      ))}
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* Comments Section */}
      <Paper elevation={1} sx={{ mb: 3 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <Typography variant="h6">Comments</Typography>
        </Box>
        <Box sx={{ p: 2 }}>
          <CommentSection sessionId={sessionId} />
        </Box>
      </Paper>

      {/* Start Trip Verification Button - Only for Guards and only for IN_PROGRESS sessions */}
      {session.status === SessionStatus.IN_PROGRESS && authSession?.user?.subrole === EmployeeSubrole.GUARD && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, mb: 3 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Lock />}
            onClick={handleStartVerification}
          >
            Start Trip Verification
          </Button>
        </Box>
      )}

      {/* Confirmation Dialog - Only show for non-guards */}
      <Dialog
        open={confirmStartVerification}
        onClose={() => setConfirmStartVerification(false)}
      >
        <DialogTitle>Confirm Verification</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you authorized to verify this trip? Only Guards should perform verification.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmStartVerification(false)}>Cancel</Button>
          <Button onClick={confirmVerification} color="primary">
            Yes, Proceed
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Image Modal */}
      <Dialog
        open={openImageModal}
        onClose={() => setOpenImageModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent>
          {selectedImage && (
            <Box
              component="img"
              src={selectedImage}
              alt="Full size"
              sx={{ 
                width: '100%',
                maxHeight: '80vh',
                objectFit: 'contain'
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImageModal(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}