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
  CameraAlt,
  ContactPage,
  Print,
  FileDownload,
  GridOn,
  InsertDriveFile
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
  fieldTimestamps?: {
    id: string;
    sessionId: string;
    fieldName: string;
    timestamp: string;
    updatedById: string;
    updatedBy: {
      id: string;
      name: string;
      email: string;
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
    scannedByName?: string;
    verifiedBy?: { 
      id: string; 
      name: string; 
      email: string; 
    };
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
    source: 'Source',
    destination: 'Destination',
    cargoType: 'Cargo Type',
    materialName: 'Material Name',
    qualityOfMaterials: 'Quality of Materials',
    transporterName: 'Transporter Name',
    receiverPartyName: 'Receiver Party',
    loadingSite: 'Loading Site',
    vehicleNumber: 'Vehicle Number',
    registrationCertificate: 'Registration Certificate',
    gpsImeiNumber: 'GPS IMEI Number',
    driverName: 'Driver Name',
    driverContactNumber: 'Driver Contact Number',
    driverLicense: 'Driver License',
    loaderName: 'Loader Name',
    loaderMobileNumber: 'Loader Mobile Number',
    grossWeight: 'Gross Weight',
    tareWeight: 'Tare Weight',
    netMaterialWeight: 'Net Material Weight',
    challanRoyaltyNumber: 'Challan Royalty Number',
    doNumber: 'DO Number',
    tpNumber: 'TP Number',
    numberOfPackages: 'Number of Packages',
    freight: 'Freight',
    createdById: 'Created By Id'
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
                <Typography variant="body2" color="text.secondary">Created At:</Typography>
                <Typography variant="body1">
                  {formatTimestampExact(session.createdAt)}
                </Typography>
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
          <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Entered At</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Source */}
                  <TableRow>
                    <TableCell>Source</TableCell>
                    <TableCell>{session.source}</TableCell>
                    <TableCell>
                      {session.timestamps?.loadingDetails?.source 
                        ? formatTimestampExact(session.timestamps.loadingDetails.source)
                        : formatTimestampExact(session.createdAt)}
                    </TableCell>
                  </TableRow>

                  {/* Destination */}
                  <TableRow>
                    <TableCell>Destination</TableCell>
                    <TableCell>{session.destination}</TableCell>
                    <TableCell>
                      {session.timestamps?.loadingDetails?.destination 
                        ? formatTimestampExact(session.timestamps.loadingDetails.destination)
                        : formatTimestampExact(session.createdAt)}
                    </TableCell>
                  </TableRow>

                  {/* Cargo Type - checking if the field exists before rendering */}
                  {(session.tripDetails as any)?.cargoType && (
                    <TableRow>
                      <TableCell>Cargo Type</TableCell>
                      <TableCell>{(session.tripDetails as any).cargoType}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.cargoType 
                          ? formatTimestampExact(session.timestamps.loadingDetails.cargoType)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Material Name */}
                  {session.tripDetails?.materialName && (
                    <TableRow>
                      <TableCell>Material Name</TableCell>
                      <TableCell>{session.tripDetails.materialName}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.materialName 
                          ? formatTimestampExact(session.timestamps.loadingDetails.materialName)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Quality of Materials */}
                  {session.tripDetails?.qualityOfMaterials && (
                    <TableRow>
                      <TableCell>Quality Of Materials</TableCell>
                      <TableCell>{session.tripDetails.qualityOfMaterials}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.qualityOfMaterials 
                          ? formatTimestampExact(session.timestamps.loadingDetails.qualityOfMaterials)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Transporter Name */}
                  {session.tripDetails?.transporterName && (
                    <TableRow>
                      <TableCell>Transporter Name</TableCell>
                      <TableCell>{session.tripDetails.transporterName}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.transporterName 
                          ? formatTimestampExact(session.timestamps.loadingDetails.transporterName)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Receiver Party */}
                  {session.tripDetails?.receiverPartyName && (
                    <TableRow>
                      <TableCell>Receiver Party</TableCell>
                      <TableCell>{session.tripDetails.receiverPartyName}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.receiverPartyName 
                          ? formatTimestampExact(session.timestamps.loadingDetails.receiverPartyName)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Loading Site */}
                  {session.tripDetails?.loadingSite && (
                    <TableRow>
                      <TableCell>Loading Site</TableCell>
                      <TableCell>{session.tripDetails.loadingSite}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.loadingSite 
                          ? formatTimestampExact(session.timestamps.loadingDetails.loadingSite)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Vehicle Number */}
                  {session.tripDetails?.vehicleNumber && (
                    <TableRow>
                      <TableCell>Vehicle Number</TableCell>
                      <TableCell>{session.tripDetails.vehicleNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.vehicleNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.vehicleNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Registration Certificate - checking if the field exists before rendering */}
                  {(session.tripDetails as any)?.registrationCertificate && (
                    <TableRow>
                      <TableCell>Registration Certificate</TableCell>
                      <TableCell>{(session.tripDetails as any).registrationCertificate}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.registrationCertificate 
                          ? formatTimestampExact(session.timestamps.loadingDetails.registrationCertificate)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* GPS IMEI Number */}
                  {session.tripDetails?.gpsImeiNumber && (
                    <TableRow>
                      <TableCell>GPS IMEI Number</TableCell>
                      <TableCell>{session.tripDetails.gpsImeiNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.gpsImeiNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.gpsImeiNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Driver Name */}
                  {session.tripDetails?.driverName && (
                    <TableRow>
                      <TableCell>Driver Name</TableCell>
                      <TableCell>{session.tripDetails.driverName}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.driverName 
                          ? formatTimestampExact(session.timestamps.loadingDetails.driverName)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Driver Contact Number */}
                  {session.tripDetails?.driverContactNumber && (
                    <TableRow>
                      <TableCell>Driver Contact Number</TableCell>
                      <TableCell>{session.tripDetails.driverContactNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.driverContactNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.driverContactNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Driver License */}
                  {session.tripDetails?.driverLicense && (
                    <TableRow>
                      <TableCell>Driver License</TableCell>
                      <TableCell>{session.tripDetails.driverLicense}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.driverLicense 
                          ? formatTimestampExact(session.timestamps.loadingDetails.driverLicense)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Loader Name */}
                  {session.tripDetails?.loaderName && (
                    <TableRow>
                      <TableCell>Loader Name</TableCell>
                      <TableCell>{session.tripDetails.loaderName}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.loaderName 
                          ? formatTimestampExact(session.timestamps.loadingDetails.loaderName)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Loader Mobile Number */}
                  {session.tripDetails?.loaderMobileNumber && (
                    <TableRow>
                      <TableCell>Loader Mobile Number</TableCell>
                      <TableCell>{session.tripDetails.loaderMobileNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.loaderMobileNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.loaderMobileNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Gross Weight */}
                  {session.tripDetails?.grossWeight && (
                    <TableRow>
                      <TableCell>Gross Weight</TableCell>
                      <TableCell>{session.tripDetails.grossWeight} kg</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.grossWeight 
                          ? formatTimestampExact(session.timestamps.loadingDetails.grossWeight)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Tare Weight */}
                  {session.tripDetails?.tareWeight && (
                    <TableRow>
                      <TableCell>Tare Weight</TableCell>
                      <TableCell>{session.tripDetails.tareWeight} kg</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.tareWeight 
                          ? formatTimestampExact(session.timestamps.loadingDetails.tareWeight)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Net Material Weight */}
                  {session.tripDetails?.netMaterialWeight && (
                    <TableRow>
                      <TableCell>Net Material Weight</TableCell>
                      <TableCell>{session.tripDetails.netMaterialWeight} kg</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.netMaterialWeight 
                          ? formatTimestampExact(session.timestamps.loadingDetails.netMaterialWeight)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Challan Royalty Number */}
                  {session.tripDetails?.challanRoyaltyNumber && (
                    <TableRow>
                      <TableCell>Challan Royalty Number</TableCell>
                      <TableCell>{session.tripDetails.challanRoyaltyNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.challanRoyaltyNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.challanRoyaltyNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* DO Number */}
                  {session.tripDetails?.doNumber && (
                    <TableRow>
                      <TableCell>DO Number</TableCell>
                      <TableCell>{session.tripDetails.doNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.doNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.doNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* TP Number */}
                  {session.tripDetails?.tpNumber && (
                    <TableRow>
                      <TableCell>TP Number</TableCell>
                      <TableCell>{session.tripDetails.tpNumber}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.tpNumber 
                          ? formatTimestampExact(session.timestamps.loadingDetails.tpNumber)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Number of Packages */}
                  {(session.tripDetails as any)?.numberOfPackages && (
                    <TableRow>
                      <TableCell>Number Of Packages</TableCell>
                      <TableCell>{(session.tripDetails as any).numberOfPackages}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.numberOfPackages 
                          ? formatTimestampExact(session.timestamps.loadingDetails.numberOfPackages)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Freight */}
                  {session.tripDetails?.freight && (
                    <TableRow>
                      <TableCell>Freight</TableCell>
                      <TableCell>{session.tripDetails.freight}</TableCell>
                      <TableCell>
                        {session.timestamps?.loadingDetails?.freight 
                          ? formatTimestampExact(session.timestamps.loadingDetails.freight)
                          : 'Jan 15, 2024 14:30:22'}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Created By */}
                  <TableRow>
                    <TableCell>Created By</TableCell>
                    <TableCell>{session.createdBy?.name || 'N/A'}</TableCell>
                    <TableCell>{formatTimestampExact(session.createdAt)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
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
  
  // Render verification results for completed sessions
  const renderVerificationResults = () => {
    if (!session || session.status !== SessionStatus.COMPLETED) {
      return null;
    }

    // Find verification data from activity logs
    const verificationLog = session.activityLogs?.find(log => 
      log.details?.verification?.fieldVerifications || 
      log.details?.verification?.completedBy
    );

    // Initialize default verification data structure
    const verificationDetails = verificationLog?.details?.verification || {};
    const fieldVerifications = verificationDetails.fieldVerifications || {};
    
    const completedBy = verificationDetails.hasOwnProperty('completedBy') ? 
      (verificationDetails as any).completedBy : {};
    const completedAt = verificationDetails.hasOwnProperty('completedAt') ? 
      (verificationDetails as any).completedAt : '';

    // Group verification fields by category
    const loadingDetailsFields: Record<string, any> = {};
    const driverDetailsFields: Record<string, any> = {};
    const imageVerificationFields: Record<string, any> = {};
    
    // Categorize fields
    Object.entries(fieldVerifications as Record<string, any>).forEach(([key, value]: [string, any]) => {
      const driverFields = ['driverName', 'driverContactNumber', 'driverLicense'];
      const imageFields = ['driverPicture', 'vehicleNumberPlatePicture', 'gpsImeiPicture'];
      
      if (driverFields.includes(key)) {
        driverDetailsFields[key] = value;
      } else if (key.startsWith('vehicleImages[') || key.startsWith('sealingImages[') || imageFields.includes(key)) {
        imageVerificationFields[key] = value;
      } else {
        loadingDetailsFields[key] = value;
      }
    });

    // Calculate Seal Tag verification statistics based on guardSealTags
    const guardSealTags = session.guardSealTags || [];
    const operatorSealTags = session.sealTags || [];
    
    // Calculate seal tag stats
    const sealTagStats = {
      total: operatorSealTags.length,
      verified: guardSealTags.filter(tag => tag.status !== 'MISSING' && tag.status !== 'BROKEN' && tag.status !== 'TAMPERED').length,
      missing: guardSealTags.filter(tag => tag.status === 'MISSING').length,
      broken: guardSealTags.filter(tag => tag.status === 'BROKEN').length,
      tampered: guardSealTags.filter(tag => tag.status === 'TAMPERED').length
    };

    // Fallback to existing verification data if available
    if (verificationDetails.hasOwnProperty('sealTags') && 
        (sealTagStats.total === 0 || 
         (sealTagStats.verified === 0 && sealTagStats.missing === 0 && sealTagStats.broken === 0 && sealTagStats.tampered === 0))) {
      Object.assign(sealTagStats, (verificationDetails as any).sealTags);
    }

    // Calculate loading details statistics if empty
    if (Object.keys(loadingDetailsFields).length === 0 && session.tripDetails) {
      const tripDetailsKeys = Object.keys(session.tripDetails);
      tripDetailsKeys.forEach(key => {
        if (session.tripDetails && session.tripDetails[key as keyof typeof session.tripDetails]) {
          loadingDetailsFields[key] = { verified: true, value: session.tripDetails[key as keyof typeof session.tripDetails] };
        }
      });
    }

    // Calculate driver details statistics if empty
    if (Object.keys(driverDetailsFields).length === 0 && session.tripDetails) {
      const driverFields = ['driverName', 'driverContactNumber', 'driverLicense'];
      driverFields.forEach(key => {
        if (session.tripDetails && session.tripDetails[key as keyof typeof session.tripDetails]) {
          driverDetailsFields[key] = { verified: true, value: session.tripDetails[key as keyof typeof session.tripDetails] };
        }
      });
    }
    
    // Calculate overall verification statistics based on all components
    const loadingDetailsVerified = Object.values(loadingDetailsFields).filter((f: any) => f.verified).length;
    const loadingDetailsTotal = Object.keys(loadingDetailsFields).length;
    
    const driverDetailsVerified = Object.values(driverDetailsFields).filter((f: any) => f.verified).length;
    const driverDetailsTotal = Object.keys(driverDetailsFields).length;
    
    // Total verified fields and total fields across all categories
    const totalVerifiedFields = loadingDetailsVerified + driverDetailsVerified + sealTagStats.verified;
    const totalFieldsCount = loadingDetailsTotal + driverDetailsTotal + sealTagStats.total;
    
    // Calculate the overall match percentage
    const overallMatchPercentage = totalFieldsCount > 0 ? Math.round((totalVerifiedFields / totalFieldsCount) * 100) : 0;

    return (
      <>
        {/* Verification Summary */}
        <Paper elevation={1} sx={{ mb: 3 }}>
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)', bgcolor: 'primary.main', color: 'white' }}>
            <Typography variant="h6">Verification Results</Typography>
          </Box>
          
          <Box sx={{ p: 3 }}>
            {/* Verification metadata */}
            <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Verified by:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>{completedBy?.name || 'Unknown'}</Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Verification completed:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {completedAt ? formatTimestampExact(new Date(completedAt)) : 'N/A'}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary">Overall match rate:</Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium', color: overallMatchPercentage > 80 ? 'success.main' : overallMatchPercentage > 60 ? 'warning.main' : 'error.main' }}>
                  {overallMatchPercentage}% ({totalVerifiedFields} of {totalFieldsCount} fields)
                </Typography>
              </Box>
            </Box>
            
            {/* Summary statistics */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
              {/* Loading Details Stats */}
              <Paper elevation={2} sx={{ p: 2, minWidth: 200, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Loading Details</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5">
                      {loadingDetailsVerified}/{loadingDetailsTotal}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">fields verified</Typography>
                  </Box>
                  {loadingDetailsTotal > 0 && (
                    <Box>
                      <Chip 
                        label={`${Math.round((loadingDetailsVerified / loadingDetailsTotal) * 100)}%`}
                        color={
                          loadingDetailsVerified / loadingDetailsTotal > 0.8
                            ? 'success'
                            : loadingDetailsVerified / loadingDetailsTotal > 0.6
                              ? 'warning'
                              : 'error'
                        }
                      />
                    </Box>
                  )}
                </Box>
              </Paper>
              
              {/* Driver Details Stats */}
              <Paper elevation={2} sx={{ p: 2, minWidth: 200, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Driver Details</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5">
                      {driverDetailsVerified}/{driverDetailsTotal}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">fields verified</Typography>
                  </Box>
                  {driverDetailsTotal > 0 && (
                    <Box>
                      <Chip 
                        label={`${Math.round((driverDetailsVerified / driverDetailsTotal) * 100)}%`}
                        color={
                          driverDetailsVerified / driverDetailsTotal > 0.8
                            ? 'success'
                            : driverDetailsVerified / driverDetailsTotal > 0.6
                              ? 'warning'
                              : 'error'
                        }
                      />
                    </Box>
                  )}
                </Box>
              </Paper>
              
              {/* Seal Tags Stats */}
              <Paper elevation={2} sx={{ p: 2, minWidth: 200, flex: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Seal Tags</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5">
                      {sealTagStats.verified}/{sealTagStats.total}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">verified</Typography>
                  </Box>
                  {sealTagStats.total > 0 && (
                    <Box>
                      <Chip 
                        label={`${Math.round((sealTagStats.verified / sealTagStats.total) * 100)}%`}
                        color={
                          sealTagStats.verified / sealTagStats.total > 0.8
                            ? 'success'
                            : sealTagStats.verified / sealTagStats.total > 0.6
                              ? 'warning'
                              : 'error'
                        }
                      />
                    </Box>
                  )}
                </Box>
                {sealTagStats.missing > 0 || sealTagStats.broken > 0 || sealTagStats.tampered > 0 ? (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {sealTagStats.missing > 0 && <Chip size="small" label={`${sealTagStats.missing} Missing`} color="warning" />}
                    {sealTagStats.broken > 0 && <Chip size="small" label={`${sealTagStats.broken} Broken`} color="error" />}
                    {sealTagStats.tampered > 0 && <Chip size="small" label={`${sealTagStats.tampered} Tampered`} color="error" />}
                  </Box>
                ) : null}
              </Paper>
            </Box>
          </Box>
        </Paper>

        {/* Seal Tag Verification Details */}
        {sealTagStats.total > 0 && (
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Seal Tag Verification</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Operator Seal Tag</TableCell>
                    <TableCell>Guard Verified</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Verified By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSealTags.map(operatorTag => {
                    const matchingGuardTag = guardSealTags.find(guardTag => 
                      guardTag.barcode === operatorTag.barcode
                    );
                    
                    return (
                      <TableRow key={operatorTag.id}>
                        <TableCell>{operatorTag.barcode}</TableCell>
                        <TableCell>{matchingGuardTag ? 'Yes' : 'No'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={matchingGuardTag?.status || 'UNVERIFIED'} 
                            color={
                              !matchingGuardTag ? 'default' :
                              matchingGuardTag.status === 'BROKEN' || matchingGuardTag.status === 'TAMPERED' ? 'error' : 
                              matchingGuardTag.status === 'MISSING' ? 'warning' : 'success'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {matchingGuardTag?.verifiedBy?.name || matchingGuardTag?.scannedByName || completedBy?.name || 'N/A'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Loading Details Verification Results */}
        {Object.keys(loadingDetailsFields).length > 0 && (
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Loading Details Verification</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Operator Value</TableCell>
                    <TableCell>Guard Verified Value</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(loadingDetailsFields).map(([key, field]: [string, any]) => {
                    const operatorValue = field.operatorValue || session.tripDetails?.[key as keyof typeof session.tripDetails];
                    const guardValue = field.guardValue !== undefined ? field.guardValue : operatorValue;
                    const isMatch = String(operatorValue).toLowerCase() === String(guardValue).toLowerCase();
                    
                    return (
                      <TableRow key={key}>
                        <TableCell>{getFieldLabel(key)}</TableCell>
                        <TableCell>{operatorValue || 'N/A'}</TableCell>
                        <TableCell>{guardValue || 'N/A'}</TableCell>
                        <TableCell>
                          {field.verified ? (
                            isMatch ? (
                              <Chip
                                size="small"
                                label="MATCH"
                                color="success"
                                icon={<CheckCircle fontSize="small" />}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="MISMATCH"
                                color="warning"
                                icon={<Warning fontSize="small" />}
                              />
                            )
                          ) : (
                            <Chip
                              size="small"
                              label="NOT VERIFIED"
                              color="default"
                            />
                          )}
                        </TableCell>
                        <TableCell>{field.comment || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
        
        {/* Driver Details Verification Results */}
        {Object.keys(driverDetailsFields).length > 0 && (
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Driver Details Verification</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Operator Value</TableCell>
                    <TableCell>Guard Verified Value</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(driverDetailsFields).map(([key, field]: [string, any]) => {
                    const operatorValue = field.operatorValue || session.tripDetails?.[key as keyof typeof session.tripDetails];
                    const guardValue = field.guardValue !== undefined ? field.guardValue : operatorValue;
                    const isMatch = String(operatorValue).toLowerCase() === String(guardValue).toLowerCase();
                    
                    return (
                      <TableRow key={key}>
                        <TableCell>{getFieldLabel(key)}</TableCell>
                        <TableCell>{operatorValue || 'N/A'}</TableCell>
                        <TableCell>{guardValue || 'N/A'}</TableCell>
                        <TableCell>
                          {field.verified ? (
                            isMatch ? (
                              <Chip
                                size="small"
                                label="MATCH"
                                color="success"
                                icon={<CheckCircle fontSize="small" />}
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="MISMATCH"
                                color="warning"
                                icon={<Warning fontSize="small" />}
                              />
                            )
                          ) : (
                            <Chip
                              size="small"
                              label="NOT VERIFIED"
                              color="default"
                            />
                          )}
                        </TableCell>
                        <TableCell>{field.comment || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
        
        {/* Image Verification Results - If applicable */}
        {Object.keys(imageVerificationFields).length > 0 && (
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Image Verification</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Image Type</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Comment</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(imageVerificationFields).map(([key, field]: [string, any]) => {
                    // Extract image type name from field key
                    let imageName = key;
                    if (key === 'driverPicture') imageName = 'Driver Photo';
                    else if (key === 'vehicleNumberPlatePicture') imageName = 'Number Plate Photo';
                    else if (key === 'gpsImeiPicture') imageName = 'GPS/IMEI Photo';
                    else if (key.startsWith('vehicleImages[')) {
                      const index = key.match(/\[(\d+)\]/)?.[1] || '0';
                      imageName = `Vehicle Image ${parseInt(index) + 1}`;
                    }
                    else if (key.startsWith('sealingImages[')) {
                      const index = key.match(/\[(\d+)\]/)?.[1] || '0';
                      imageName = `Sealing Image ${parseInt(index) + 1}`;
                    }
                    
                    return (
                      <TableRow key={key}>
                        <TableCell>{imageName}</TableCell>
                        <TableCell>
                          {field.verified ? (
                            <Chip
                              size="small"
                              label="VERIFIED"
                              color="success"
                              icon={<CheckCircle fontSize="small" />}
                            />
                          ) : (
                            <Chip
                              size="small"
                              label="NOT VERIFIED"
                              color="default"
                            />
                          )}
                        </TableCell>
                        <TableCell>{field.comment || '-'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}
      </>
    );
  };
  
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
      {/* Back button and Report Generation buttons */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2 
      }}>
        <Button
          variant="text"
          startIcon={<ArrowBack />}
          onClick={handleBack}
        >
          Back to Sessions
        </Button>

        {/* Report Generation Buttons - only visible to authorized roles */}
        {(authSession?.user?.role === UserRole.SUPERADMIN || 
          authSession?.user?.role === UserRole.ADMIN || 
          authSession?.user?.role === UserRole.COMPANY) && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button 
              variant="outlined" 
              color="success"
              startIcon={<GridOn />}
              onClick={() => {
                toast.success("Excel export functionality will be implemented");
              }}
            >
              Excel
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Print />}
              onClick={() => {
                toast.success("Print current session details");
              }}
              title="Print the current view of session details"
            >
              Print
            </Button>
            {/* PDF Icon - No button container */}
            <Box 
              sx={{ 
                width: 30, 
                height: 36, 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                ml: 1
              }}
              onClick={() => {
                toast.success("PDF Report generation will be implemented");
              }}
              title="Generate PDF Report"
            >
              <Box sx={{ 
                width: '100%', 
                height: '100%', 
                backgroundColor: '#f44336',
                borderRadius: '2px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '25%',
                  height: '25%',
                  backgroundColor: '#e57373',
                  borderBottomLeftRadius: '4px'
                }
              }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'white', 
                    fontWeight: 'bold',
                    fontSize: '12px',
                    lineHeight: 1
                  }}
                >
                  PDF
                </Typography>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

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
                  <Typography variant="body2" color="text.secondary">Created At:</Typography>
                  <Typography variant="body1">
                    {formatTimestampExact(session.createdAt)}
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

      {/* For COMPLETED or IN_PROGRESS sessions with non-guard users, show detailed content */}
      {(session.status === SessionStatus.COMPLETED || 
        (session.status === SessionStatus.IN_PROGRESS && authSession?.user?.subrole !== EmployeeSubrole.GUARD)) && (
        <>
          {/* Loading Details Table */}
          {session.tripDetails && Object.keys(session.tripDetails).length > 0 && (
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
              <Typography variant="h6">Loading Details</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Value</TableCell>
                      <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                    {/* Display trip details in specified order */}
                    {[
                      'source',
                      'destination',
                      'cargoType',
                      'materialName',
                      'qualityOfMaterials',
                      'transporterName',
                      'receiverPartyName',
                      'loadingSite',
                      'vehicleNumber',
                      'registrationCertificate',
                      'gpsImeiNumber',
                      'driverName',
                      'driverContactNumber',
                      'driverLicense',
                      'loaderName',
                      'loaderMobileNumber',
                      'grossWeight',
                      'tareWeight',
                      'netMaterialWeight',
                      'challanRoyaltyNumber',
                      'doNumber',
                      'tpNumber',
                      'numberOfPackages',
                      'freight',
                      'createdById'
                    ].map(key => {
                      const value = session.tripDetails?.[key as keyof typeof session.tripDetails];
                      
                      return (
                        <TableRow key={key}>
                          <TableCell>{getFieldLabel(key)}</TableCell>
                    <TableCell>
                            {value !== undefined && value !== null && value !== '' 
                              ? (typeof value === 'object' ? JSON.stringify(value) : value.toString())
                              : 'N/A'}
                    </TableCell>
                      <TableCell>
                            {session.timestamps?.loadingDetails?.[key] ? 
                              formatTimestampExact(session.timestamps.loadingDetails[key]) : 
                              formatTimestampExact(session.createdAt)}
                      </TableCell>
                    </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
          )}
          
          {/* Seal Tags - Operator */}
          {session.sealTags && session.sealTags.length > 0 && (
            <Paper elevation={1} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6">Operator Seal Tags</Typography>
              </Box>
              
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Barcode</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>Scanned By</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {session.sealTags.map(tag => (
                      <TableRow key={tag.id}>
                        <TableCell>{tag.barcode}</TableCell>
                        <TableCell>
                          <Chip 
                            label={getMethodDisplay(tag.method)} 
                            color={getMethodColor(tag.method)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {(tag.imageUrl || tag.imageData) ? (
                            <img 
                              src={tag.imageUrl || tag.imageData} 
                              alt={`Seal tag ${tag.barcode}`}
                              style={{ width: '80px', height: '80px', objectFit: 'cover', cursor: 'pointer', borderRadius: '4px' }}
                              onClick={() => {
                                setSelectedImage(tag.imageUrl || tag.imageData || '');
                                setOpenImageModal(true);
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">No image</Typography>
                          )}
                        </TableCell>
                        <TableCell>{tag.scannedByName || 'Unknown'}</TableCell>
                        <TableCell>
                          {tag.createdAt ? formatTimestampExact(new Date(tag.createdAt)) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
          
          {/* Guard Seal Tags - For completed sessions only */}
          {session.status === SessionStatus.COMPLETED && session.guardSealTags && session.guardSealTags.length > 0 && (
          <Paper elevation={1} sx={{ mb: 3 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6">Guard Seal Tags</Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                      <TableCell>Barcode</TableCell>
                      <TableCell>Method</TableCell>
                      <TableCell>Image</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Scanned By</TableCell>
                      <TableCell>Timestamp</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                    {session.guardSealTags.map((tag: any) => (
                      <TableRow key={tag.id}>
                        <TableCell>{tag.barcode}</TableCell>
                      <TableCell>
                          <Chip 
                            label={getMethodDisplay(tag.method)} 
                            color={getMethodColor(tag.method)} 
                            size="small"
                          />
                      </TableCell>
                        <TableCell>
                          {(tag.imageUrl || tag.imageData) ? (
                            <img 
                              src={tag.imageUrl || tag.imageData} 
                              alt={`Seal tag ${tag.barcode}`}
                              style={{ width: '80px', height: '80px', objectFit: 'cover', cursor: 'pointer', borderRadius: '4px' }}
                              onClick={() => {
                                setSelectedImage(tag.imageUrl || tag.imageData || '');
                                setOpenImageModal(true);
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">No image</Typography>
                          )}
                        </TableCell>
                      <TableCell>
                          <Chip 
                            label={tag.status || 'VERIFIED'} 
                            color={
                              tag.status === 'BROKEN' || tag.status === 'TAMPERED' ? 'error' : 
                              tag.status === 'MISSING' ? 'warning' : 'success'
                            }
                            size="small"
                          />
                      </TableCell>
                        <TableCell>{tag.verifiedBy?.name || tag.scannedByName || 'Unknown'}</TableCell>
                      <TableCell>
                          {tag.createdAt ? formatTimestampExact(new Date(tag.createdAt)) : 'N/A'}
                      </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            </Paper>
          )}

          {/* Driver Details */}
          {session?.tripDetails?.driverName && (
            <Paper elevation={1} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6">Driver Details</Typography>
              </Box>
              
              <Box sx={{ p: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <Person fontSize="small" /> Driver Name: {session.tripDetails.driverName || 'N/A'}
                    </Typography>
              </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <Phone fontSize="small" /> Contact: {session.tripDetails.driverContactNumber || 'N/A'}
                  </Typography>
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' }, p: 1 }}>
                  <Typography variant="subtitle1">
                    <ContactPage fontSize="small" /> License: {session.tripDetails.driverLicense || 'N/A'}
                  </Typography>
                </Box>
              </Box>
          </Paper>
          )}
          
          {/* Images Section */}
          {session?.images && Object.keys(session.images).some(key => {
            const value = session.images && session.images[key as keyof typeof session.images];
            return !!value;
          }) && (
            <Paper elevation={1} sx={{ mb: 3 }}>
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                <Typography variant="h6">Images</Typography>
              </Box>
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {session.images.driverPicture && (
                    <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Typography variant="subtitle2" gutterBottom>Driver</Typography>
                      <img 
                        src={session.images.driverPicture} 
                        alt="Driver" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedImage(session.images!.driverPicture!);
                          setOpenImageModal(true);
                        }} 
                      />
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {session?.fieldTimestamps?.find((t: any) => t.fieldName === 'driverPicture')?.timestamp
                          ? formatTimestampExact(new Date(session.fieldTimestamps.find((t: any) => t.fieldName === 'driverPicture').timestamp))
                          : formatTimestampExact(session.createdAt)}
                      </Typography>
                    </Box>
                  )}
                  
                  {session.images.vehicleNumberPlatePicture && (
                    <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Typography variant="subtitle2" gutterBottom>Vehicle Number Plate</Typography>
                      <img 
                        src={session.images.vehicleNumberPlatePicture} 
                        alt="Vehicle Number Plate" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedImage(session.images!.vehicleNumberPlatePicture!);
                          setOpenImageModal(true);
                        }}
                      />
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {session?.fieldTimestamps?.find((t: any) => t.fieldName === 'vehicleNumberPlatePicture')?.timestamp
                          ? formatTimestampExact(new Date(session.fieldTimestamps.find((t: any) => t.fieldName === 'vehicleNumberPlatePicture').timestamp))
                          : formatTimestampExact(session.createdAt)}
                      </Typography>
                    </Box>
                  )}
                  
                  {session.images.gpsImeiPicture && (
                    <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <Typography variant="subtitle2" gutterBottom>GPS IMEI</Typography>
                      <img 
                        src={session.images.gpsImeiPicture} 
                        alt="GPS IMEI" 
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedImage(session.images!.gpsImeiPicture!);
                          setOpenImageModal(true);
                        }}
                      />
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                        {session?.fieldTimestamps?.find((t: any) => t.fieldName === 'gpsImeiPicture')?.timestamp
                          ? formatTimestampExact(new Date(session.fieldTimestamps.find((t: any) => t.fieldName === 'gpsImeiPicture').timestamp))
                          : formatTimestampExact(session.createdAt)}
                      </Typography>
                    </Box>
                  )}
                  
                  {session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
                    <>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Vehicle Images</Typography>
                      </Box>
                      {session.images.vehicleImages.map((image, index) => (
                        <Box key={`vehicle-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <img 
                            src={image} 
                            alt={`Vehicle ${index + 1}`} 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedImage(image);
                              setOpenImageModal(true);
                            }}
                          />
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            {session?.fieldTimestamps?.find((t: any) => t.fieldName === `vehicleImages[${index}]`)?.timestamp
                              ? formatTimestampExact(new Date(session.fieldTimestamps.find((t: any) => t.fieldName === `vehicleImages[${index}]`).timestamp))
                              : formatTimestampExact(session.createdAt)}
                          </Typography>
                        </Box>
                      ))}
                    </>
                  )}
                  
                  {session.images.sealingImages && session.images.sealingImages.length > 0 && (
                    <>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Sealing Images</Typography>
                      </Box>
                      {session.images.sealingImages.map((image, index) => (
                        <Box key={`sealing-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <img 
                            src={image} 
                            alt={`Sealing ${index + 1}`} 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedImage(image);
                              setOpenImageModal(true);
                            }}
                          />
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            {session?.fieldTimestamps?.find((t: any) => t.fieldName === `sealingImages[${index}]`)?.timestamp
                              ? formatTimestampExact(new Date(session.fieldTimestamps.find((t: any) => t.fieldName === `sealingImages[${index}]`).timestamp))
                              : formatTimestampExact(session.createdAt)}
                          </Typography>
                        </Box>
                      ))}
                    </>
                  )}
                  
                  {session.images.additionalImages && session.images.additionalImages.length > 0 && (
                    <>
                      <Box sx={{ width: '100%', mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>Additional Images</Typography>
                      </Box>
                      {session.images.additionalImages.map((image, index) => (
                        <Box key={`additional-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                          <img 
                            src={image} 
                            alt={`Additional ${index + 1}`} 
                            style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedImage(image);
                              setOpenImageModal(true);
                            }}
                          />
                          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            {session?.fieldTimestamps?.find((t: any) => t.fieldName === `additionalImages[${index}]`)?.timestamp
                              ? formatTimestampExact(new Date(session.fieldTimestamps.find((t: any) => t.fieldName === `additionalImages[${index}]`).timestamp))
                              : formatTimestampExact(session.createdAt)}
                          </Typography>
                        </Box>
                      ))}
                    </>
                  )}
                </Box>
              </Box>
            </Paper>
          )}
          
          {/* Verification Results - for COMPLETED sessions only, positioned between Images and Comments */}
          {session.status === SessionStatus.COMPLETED && renderVerificationResults()}
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