import React, { useState } from 'react';
import {
  Box, Paper, Typography, Tabs, Tab, Button, Chip, Grid,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TextField, IconButton, Alert, InputAdornment
} from '@mui/material';
import {
  InfoOutlined, QrCode, PhotoLibrary, CheckCircle, Warning,
  KeyboardArrowDown, Cancel, PhotoCamera, CloudUpload
} from '@mui/icons-material';
import ClientSideQrScanner from '@/app/components/ClientSideQrScanner';

// TabPanel component for verification mode
function TabPanel(props: {
  children?: React.ReactNode;
  index: number;
  value: number;
}) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`verification-tabpanel-${index}`}
      aria-labelledby={`verification-tab-${index}`}
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

// Interfaces
interface SealType {
  id: string;
  method?: string;
  image?: File | null;
  imagePreview?: string | null;
  timestamp?: string;
  verified?: boolean;
}

interface SessionImageType {
  vehicleNumberPlatePicture?: string;
  gpsImeiPicture?: string;
  driverPicture?: string;
  sealingImages?: string[];
  vehicleImages?: string[];
}

interface GuardVerificationUIProps {
  session: any;
  operatorSeals: Array<SealType>;
  guardScannedSeals: Array<SealType>;
  sealComparison: {matched: string[], mismatched: string[]};
  scanInput: string;
  scanError: string;
  verificationFields: Record<string, any>;
  verifying: boolean;
  onScanInputChange: (value: string) => void;
  onScanComplete: (data: string, method: string, imageFile?: File) => void;
  onVerifyField: (field: string) => void;
  onVerifyImage: (imageKey: string) => void;
  onVerifyAllFields: () => void;
  onSelectImage: (imageUrl: string) => void;
  onCompleteVerification: () => void;
  getFieldLabel: (field: string) => string;
  isSystemField: (key: string) => boolean;
  getMethodDisplay: (method?: string) => string;
  getMethodColor: (method?: string) => "primary" | "secondary" | "default";
}

export default function GuardVerificationUI({
  session,
  operatorSeals,
  guardScannedSeals,
  sealComparison,
  scanInput,
  scanError,
  verificationFields,
  verifying,
  onScanInputChange,
  onScanComplete,
  onVerifyField,
  onVerifyImage,
  onVerifyAllFields,
  onSelectImage,
  onCompleteVerification,
  getFieldLabel,
  isSystemField,
  getMethodDisplay,
  getMethodColor
}: GuardVerificationUIProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Paper sx={{ mb: 3 }}>
      <Tabs 
        value={activeTab} 
        onChange={(_, newValue) => setActiveTab(newValue)} 
        variant="fullWidth"
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab icon={<InfoOutlined />} label="Trip Details" />
        <Tab icon={<QrCode />} label="Seal Tags" />
        <Tab icon={<PhotoLibrary />} label="Images" />
      </Tabs>
      
      {/* Trip Details Tab */}
      <TabPanel value={activeTab} index={0}>
        <Typography variant="h6" gutterBottom>
          Trip Information Verification
        </Typography>
        
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {session.tripDetails && Object.entries(session.tripDetails)
                .filter(([key]) => !isSystemField(key))
                .map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell>{getFieldLabel(key)}</TableCell>
                    <TableCell>{value || 'N/A'}</TableCell>
                    <TableCell>
                      {verificationFields[key]?.verified ? (
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
                          onClick={() => onVerifyField(key)}
                        >
                          Verify
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={onVerifyAllFields}
          >
            Verify All Fields
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveTab(1)}
          >
            Next: Seal Tags
          </Button>
        </Box>
      </TabPanel>
      
      {/* Seal Tags Tab */}
      <TabPanel value={activeTab} index={1}>
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>
        
        {/* Scan Seal Tags - Updated UI to exactly match OPERATOR's UI */}
        <Box sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box sx={{ width: { xs: '100%', md: '47%' } }}>
            <Typography variant="subtitle1" gutterBottom>
              Scan QR/Barcode
            </Typography>
            <Box sx={{ height: '56px' }}>
              <ClientSideQrScanner
                onScanWithImage={(data, imageFile) => {
                  onScanComplete(data, 'digital', imageFile);
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
              onChange={(e) => onScanInputChange(e.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Button 
                      onClick={() => onScanComplete(scanInput, 'manual')}
                      disabled={!scanInput}
                    >
                      Add
                    </Button>
                  </InputAdornment>
                ),
              }}
              error={!!scanError}
              helperText={scanError}
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<PhotoCamera />}
              >
                Take Photo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (scanInput) {
                        onScanComplete(scanInput, 'manual', file);
                      }
                    }
                  }}
                />
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
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (scanInput) {
                        onScanComplete(scanInput, 'manual', file);
                      }
                    }
                  }}
                />
              </Button>
            </Box>
          </Box>
        </Box>
        
        {/* Verification Progress */}
        <Box 
          sx={{ 
            p: 2, 
            mb: 3, 
            border: '1px solid', 
            borderColor: 'divider',
            borderLeft: '4px solid',
            borderLeftColor: 'primary.main',
            borderRadius: 1
          }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Verification Progress:
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip
              label={`${sealComparison.matched.length}/${operatorSeals.length} Verified`}
              color="primary"
              variant="outlined"
            />
            
            <Chip 
              icon={<CheckCircle fontSize="small" />}
              label={`${sealComparison.matched.length} Matched`}
              color="success" 
              variant="outlined"
            />
            
            {sealComparison.mismatched.length > 0 && (
              <Chip 
                icon={<Warning fontSize="small" />}
                label={`${sealComparison.mismatched.length} Not Scanned`}
                color="warning" 
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        
        {/* Seal Tags Table */}
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell>Seal Tag ID</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Render operator seals with their verification status */}
              {operatorSeals.map((seal) => {
                const isVerified = sealComparison.matched.includes(seal.id);
                return (
                  <TableRow key={seal.id} sx={{ backgroundColor: isVerified ? '#f5fff5' : '#fff5f5' }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {isVerified ? (
                          <CheckCircle color="success" fontSize="small" sx={{ mr: 1 }} />
                        ) : (
                          <Cancel color="error" fontSize="small" sx={{ mr: 1 }} />
                        )}
                        {seal.id}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getMethodDisplay('digital')}
                        color={getMethodColor('digital')}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label="Operator"
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {isVerified ? (
                        <Chip 
                          icon={<CheckCircle fontSize="small" />}
                          label="Verified" 
                          color="success" 
                          size="small"
                        />
                      ) : (
                        <Chip 
                          icon={<Warning fontSize="small" />}
                          label="Not Scanned" 
                          color="warning" 
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => {
                        // Toggle details visibility
                        const detailsRow = document.getElementById(`details-${seal.id}`);
                        if (detailsRow) {
                          detailsRow.style.display = detailsRow.style.display === 'none' ? 'table-row' : 'none';
                        }
                      }}>
                        <KeyboardArrowDown />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setActiveTab(0)}
          >
            Back: Trip Details
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={() => setActiveTab(2)}
          >
            Next: Images
          </Button>
        </Box>
      </TabPanel>
      
      {/* Images Tab */}
      <TabPanel value={activeTab} index={2}>
        <Typography variant="h6" gutterBottom>
          Image Verification
        </Typography>
        
        {session.images && (
          <Grid container spacing={2}>
            {session.images.vehicleNumberPlatePicture && (
              <Grid item xs={12} sm={6} md={4}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column'
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    Vehicle Number Plate
                  </Typography>
                  
                  <Box 
                    component="img"
                    src={session.images.vehicleNumberPlatePicture}
                    alt="Vehicle Number Plate"
                    sx={{ 
                      width: '100%', 
                      height: 180, 
                      objectFit: 'cover',
                      cursor: 'pointer',
                      borderRadius: 1,
                      mb: 2
                    }}
                    onClick={() => onSelectImage(session.images.vehicleNumberPlatePicture)}
                  />
                  
                  {verificationFields['vehicleNumberPlatePicture']?.verified ? (
                    <Chip 
                      icon={<CheckCircle fontSize="small" />}
                      label="Verified" 
                      color="success" 
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onVerifyImage('vehicleNumberPlatePicture')}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Verify Image
                    </Button>
                  )}
                </Paper>
              </Grid>
            )}
            
            {session.images.gpsImeiPicture && (
              <Grid item xs={12} sm={6} md={4}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column'
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    GPS IMEI Image
                  </Typography>
                  
                  <Box 
                    component="img"
                    src={session.images.gpsImeiPicture}
                    alt="GPS IMEI"
                    sx={{ 
                      width: '100%', 
                      height: 180, 
                      objectFit: 'cover',
                      cursor: 'pointer',
                      borderRadius: 1,
                      mb: 2
                    }}
                    onClick={() => onSelectImage(session.images.gpsImeiPicture)}
                  />
                  
                  {verificationFields['gpsImeiPicture']?.verified ? (
                    <Chip 
                      icon={<CheckCircle fontSize="small" />}
                      label="Verified" 
                      color="success" 
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onVerifyImage('gpsImeiPicture')}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Verify Image
                    </Button>
                  )}
                </Paper>
              </Grid>
            )}
            
            {session.images.vehicleImages && session.images.vehicleImages.map((imageUrl: string, index: number) => (
              <Grid item xs={12} sm={6} md={4} key={`vehicle-${index}`}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column'
                  }}
                >
                  <Typography variant="subtitle1" gutterBottom>
                    Vehicle Image {index + 1}
                  </Typography>
                  
                  <Box 
                    component="img"
                    src={imageUrl}
                    alt={`Vehicle ${index + 1}`}
                    sx={{ 
                      width: '100%', 
                      height: 180, 
                      objectFit: 'cover',
                      cursor: 'pointer',
                      borderRadius: 1,
                      mb: 2
                    }}
                    onClick={() => onSelectImage(imageUrl)}
                  />
                  
                  {verificationFields[`vehicleImages-${index}`]?.verified ? (
                    <Chip 
                      icon={<CheckCircle fontSize="small" />}
                      label="Verified" 
                      color="success" 
                      size="small"
                      sx={{ alignSelf: 'flex-start' }}
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onVerifyImage(`vehicleImages-${index}`)}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Verify Image
                    </Button>
                  )}
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setActiveTab(1)}
          >
            Back: Seal Tags
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={onCompleteVerification}
            disabled={verifying}
          >
            Complete Verification
          </Button>
        </Box>
      </TabPanel>
    </Paper>
  );
} 