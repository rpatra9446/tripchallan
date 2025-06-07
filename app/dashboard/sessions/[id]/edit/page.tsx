"use client";

import { useState, useEffect, useContext, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Stack,
  Divider,
  Card,
  CardMedia,
  CardContent,
  IconButton
} from "@mui/material";
import { 
  ArrowBack, 
  ArrowForward, 
  Save,
  PhotoCamera,
  Delete,
  Clear
} from "@mui/icons-material";
import Link from "next/link";
import { EmployeeSubrole } from "@/prisma/enums";
import { SessionUpdateContext } from "@/app/dashboard/layout";

type SessionDetails = {
  id: string;
  source: string;
  destination: string;
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
  };
  images?: {
    gpsImeiPicture?: string;
    vehicleNumberPlatePicture?: string;
    driverPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
  };
  seal?: {
    id: string;
    barcode: string;
    verified: boolean;
  } | null;
};

export default function EditSessionPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionDetails | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    source: "",
    destination: "",
    transporterName: "",
    materialName: "",
    receiverPartyName: "",
    vehicleNumber: "",
    gpsImeiNumber: "",
    driverName: "",
    driverContactNumber: "",
    loadingSite: "",
    loaderName: "",
    challanRoyaltyNumber: "",
    doNumber: "",
    freight: 0,
    qualityOfMaterials: "",
    tpNumber: "",
    grossWeight: 0,
    tareWeight: 0,
    netMaterialWeight: 0,
    loaderMobileNumber: ""
  });

  // Seal data
  const [sealData, setSealData] = useState({
    id: "",
    barcode: "",
    verified: false
  });

  // Image data
  const [imageData, setImageData] = useState({
    gpsImeiPicture: "",
    vehicleNumberPlatePicture: "",
    driverPicture: "", 
    sealingImages: [] as string[],
    vehicleImages: [] as string[],
    additionalImages: [] as string[]
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Fetch session data when component loads
  useEffect(() => {
    const fetchSessionData = async () => {
      try {
        const response = await fetch(`/api/session/${params.id}`);
        
        if (!response.ok) {
          throw new Error("Failed to fetch session data");
        }
        
        const data = await response.json();
        setSessionData(data);
        
        // Populate form with session data
        setFormData({
          source: data.source || "",
          destination: data.destination || "",
          transporterName: data.tripDetails?.transporterName || "",
          materialName: data.tripDetails?.materialName || "",
          receiverPartyName: data.tripDetails?.receiverPartyName || "",
          vehicleNumber: data.tripDetails?.vehicleNumber || "",
          gpsImeiNumber: data.tripDetails?.gpsImeiNumber || "",
          driverName: data.tripDetails?.driverName || "",
          driverContactNumber: data.tripDetails?.driverContactNumber || "",
          loadingSite: data.tripDetails?.loadingSite || "",
          loaderName: data.tripDetails?.loaderName || "",
          challanRoyaltyNumber: data.tripDetails?.challanRoyaltyNumber || "",
          doNumber: data.tripDetails?.doNumber || "",
          freight: data.tripDetails?.freight || 0,
          qualityOfMaterials: data.tripDetails?.qualityOfMaterials || "",
          tpNumber: data.tripDetails?.tpNumber || "",
          grossWeight: data.tripDetails?.grossWeight || 0,
          tareWeight: data.tripDetails?.tareWeight || 0,
          netMaterialWeight: data.tripDetails?.netMaterialWeight || 0,
          loaderMobileNumber: data.tripDetails?.loaderMobileNumber || ""
        });

        // Populate seal data if exists
        if (data.seal) {
          setSealData({
            id: data.seal.id || "",
            barcode: data.seal.barcode || "",
            verified: data.seal.verified || false
          });
        }

        // Populate image data if exists
        if (data.images) {
          setImageData({
            gpsImeiPicture: data.images.gpsImeiPicture || "",
            vehicleNumberPlatePicture: data.images.vehicleNumberPlatePicture || "",
            driverPicture: data.images.driverPicture || "",
            sealingImages: data.images.sealingImages || [],
            vehicleImages: data.images.vehicleImages || [],
            additionalImages: data.images.additionalImages || []
          });
        }
      } catch (error) {
        console.error("Error fetching session:", error);
        setError("Failed to load session data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    if (status === "authenticated" && session?.user) {
      fetchSessionData();
    }
  }, [params.id, status, session]);

  // Check if user is authorized (OPERATOR with edit permission)
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      if (
        session.user.role !== "EMPLOYEE" || 
        session.user.subrole !== EmployeeSubrole.OPERATOR
      ) {
        router.push("/dashboard");
      } else {
        // Check if operator has permission to edit sessions
        fetch('/api/employees/' + session.user.id + '/permissions')
          .then(response => response.json())
          .then(data => {
            if (!data.canModify) {
              setError("You don't have permission to edit trips. Please contact your administrator.");
              setTimeout(() => {
                router.push("/dashboard");
              }, 3000);
            }
          })
          .catch(err => {
            console.error("Error fetching permissions:", err);
          });
      }
    }
  }, [status, session, router]);

  // Calculate net weight automatically
  useEffect(() => {
    if (formData.grossWeight && formData.tareWeight) {
      const netWeight = formData.grossWeight - formData.tareWeight;
      setFormData(prev => ({
        ...prev,
        netMaterialWeight: netWeight > 0 ? netWeight : 0
      }));
    }
  }, [formData.grossWeight, formData.tareWeight]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when field is modified
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate required fields
    if (!formData.source) errors.source = "Source is required";
    if (!formData.destination) errors.destination = "Destination is required";
    if (!formData.vehicleNumber) errors.vehicleNumber = "Vehicle number is required";
    if (!formData.driverName) errors.driverName = "Driver name is required";
    
    // Validate numeric fields
    if (formData.freight < 0) errors.freight = "Freight cannot be negative";
    if (formData.grossWeight <= 0) errors.grossWeight = "Gross weight must be greater than 0";
    if (formData.tareWeight <= 0) errors.tareWeight = "Tare weight must be greater than 0";
    if (formData.netMaterialWeight <= 0) errors.netMaterialWeight = "Net weight must be greater than 0";
    
    // If vehicle number contains spaces, show a warning
    if (formData.vehicleNumber && formData.vehicleNumber.includes(' ')) {
      errors.vehicleNumber = "Vehicle number should not contain spaces";
    }
    
    // Set validation errors and return validation status
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/session/${params.id}/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: formData.source,
          destination: formData.destination,
          tripDetails: {
            transporterName: formData.transporterName,
            materialName: formData.materialName,
            receiverPartyName: formData.receiverPartyName,
            vehicleNumber: formData.vehicleNumber,
            gpsImeiNumber: formData.gpsImeiNumber,
            driverName: formData.driverName,
            driverContactNumber: formData.driverContactNumber,
            loadingSite: formData.loadingSite,
            loaderName: formData.loaderName,
            challanRoyaltyNumber: formData.challanRoyaltyNumber,
            doNumber: formData.doNumber,
            freight: Number(formData.freight),
            qualityOfMaterials: formData.qualityOfMaterials,
            tpNumber: formData.tpNumber,
            grossWeight: Number(formData.grossWeight),
            tareWeight: Number(formData.tareWeight),
            netMaterialWeight: Number(formData.netMaterialWeight),
            loaderMobileNumber: formData.loaderMobileNumber
          },
          images: imageData,
          seal: sealData.barcode ? {
            barcode: sealData.barcode
          } : undefined
        }),
      });
      
      if (!response.ok) {
        // Try to get detailed error information
        const errorData = await response.json().catch(() => null);
        console.error("Server response error:", errorData);
        throw new Error(errorData?.error || "Failed to update session");
      }
      
      // Navigate back to session details page
      if (refreshUserSession) refreshUserSession();
      router.push(`/dashboard/sessions/${params.id}`);
    } catch (error) {
      console.error("Error updating session:", error);
      setError("Failed to update session. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle seal barcode change
  const handleSealChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSealData(prev => ({
      ...prev,
      barcode: value
    }));
  };

  // Handle image data changes
  const handleImageChange = (type: keyof typeof imageData, url: string) => {
    setImageData(prev => ({
      ...prev,
      [type]: url
    }));
  };

  // Function to handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: keyof typeof imageData) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setIsSubmitting(true);
      setError("");
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }
      
      const data = await response.json();
      
      // Update the image data with the new URL
      handleImageChange(type, data.url);
      
    } catch (error) {
      console.error("Error uploading image:", error);
      setError(error instanceof Error ? error.message : "Failed to upload image. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Function to delete an image
  const handleDeleteImage = (type: keyof typeof imageData) => {
    // If type is an array, we need special handling
    if (Array.isArray(imageData[type])) {
      setImageData(prev => ({
        ...prev,
        [type]: []
      }));
    } else {
      // For single image fields
      handleImageChange(type, '');
    }
  };

  // Update the sealing images upload handler
  const handleMultipleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'sealingImages' | 'vehicleImages' | 'additionalImages') => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsSubmitting(true);
    setError("");
    
    try {
      const uploadedUrls: string[] = [];
      
      // Process each file
      for (const file of Array.from(e.target.files)) {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }
        
        const data = await response.json();
        uploadedUrls.push(data.url);
      }
      
      // Add the new URLs to the existing array
      setImageData(prev => ({
        ...prev,
        [type]: [...prev[type], ...uploadedUrls]
      }));
    } catch (error) {
      console.error("Error uploading images:", error);
      setError(error instanceof Error ? error.message : "Failed to upload images. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <Container maxWidth="md" sx={{ my: 4 }}>
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ my: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button 
          component={Link} 
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ my: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={3}>
          <Button 
            component={Link} 
            href={`/dashboard/sessions/${params.id}`} 
            startIcon={<ArrowBack />}
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography variant="h5">Edit Session</Typography>
        </Box>
        
        <form onSubmit={handleSubmit}>
          <Typography variant="h6" gutterBottom>Basic Information</Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Source"
                name="source"
                value={formData.source}
                onChange={handleInputChange}
                error={!!validationErrors.source}
                helperText={validationErrors.source}
                required
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Destination"
                name="destination"
                value={formData.destination}
                onChange={handleInputChange}
                error={!!validationErrors.destination}
                helperText={validationErrors.destination}
                required
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Transporter Name"
                name="transporterName"
                value={formData.transporterName}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Material Name"
                name="materialName"
                value={formData.materialName}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Receiver Party Name"
                name="receiverPartyName"
                value={formData.receiverPartyName}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Vehicle Number"
                name="vehicleNumber"
                value={formData.vehicleNumber}
                onChange={handleInputChange}
                error={!!validationErrors.vehicleNumber}
                helperText={validationErrors.vehicleNumber}
                required
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="GPS IMEI Number"
                name="gpsImeiNumber"
                value={formData.gpsImeiNumber}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Driver Name"
                name="driverName"
                value={formData.driverName}
                onChange={handleInputChange}
                error={!!validationErrors.driverName}
                helperText={validationErrors.driverName}
                required
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Driver Contact Number"
                name="driverContactNumber"
                value={formData.driverContactNumber}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Loading Site"
                name="loadingSite"
                value={formData.loadingSite}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Loader Name"
                name="loaderName"
                value={formData.loaderName}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Loader Mobile Number"
                name="loaderMobileNumber"
                value={formData.loaderMobileNumber}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Challan/Royalty Number"
                name="challanRoyaltyNumber"
                value={formData.challanRoyaltyNumber}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="DO Number"
                name="doNumber"
                value={formData.doNumber}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="TP Number"
                name="tpNumber"
                value={formData.tpNumber}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Freight"
                name="freight"
                type="number"
                value={formData.freight}
                onChange={handleInputChange}
                error={!!validationErrors.freight}
                helperText={validationErrors.freight}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Quality of Materials"
                name="qualityOfMaterials"
                value={formData.qualityOfMaterials}
                onChange={handleInputChange}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 30%', minWidth: '180px' }}>
              <TextField
                fullWidth
                label="Gross Weight"
                name="grossWeight"
                type="number"
                value={formData.grossWeight}
                onChange={handleInputChange}
                error={!!validationErrors.grossWeight}
                helperText={validationErrors.grossWeight}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 30%', minWidth: '180px' }}>
              <TextField
                fullWidth
                label="Tare Weight"
                name="tareWeight"
                type="number"
                value={formData.tareWeight}
                onChange={handleInputChange}
                error={!!validationErrors.tareWeight}
                helperText={validationErrors.tareWeight}
                margin="normal"
              />
            </Box>
            
            <Box sx={{ flex: '1 1 30%', minWidth: '180px' }}>
              <TextField
                fullWidth
                label="Net Material Weight"
                name="netMaterialWeight"
                type="number"
                value={formData.netMaterialWeight}
                InputProps={{ readOnly: true }}
                margin="normal"
              />
            </Box>
          </Box>

          {/* Seal Information Section */}
          <Typography variant="h6" sx={{ mt: 4 }} gutterBottom>Seal Information</Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 45%', minWidth: '240px' }}>
              <TextField
                fullWidth
                label="Seal Barcode"
                value={sealData.barcode}
                onChange={handleSealChange}
                margin="normal"
                disabled={sealData.verified}
                helperText={sealData.verified ? "Seal is verified and cannot be modified" : ""}
              />
            </Box>
          </Box>

          {/* Images Section */}
          <Typography variant="h6" sx={{ mt: 4 }} gutterBottom>Images</Typography>
          <Divider sx={{ mb: 2 }} />
          
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Driver & Vehicle Images</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {/* Driver Picture */}
              <Box sx={{ flex: '1 1 30%', minWidth: '240px' }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Driver Picture</Typography>
                    {imageData.driverPicture ? (
                      <>
                        <Box sx={{ position: 'relative' }}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={imageData.driverPicture}
                            alt="Driver"
                            sx={{ objectFit: 'cover', mb: 1 }}
                          />
                          <IconButton 
                            sx={{ position: 'absolute', top: 5, right: 5, bgcolor: 'rgba(255,255,255,0.7)' }}
                            size="small"
                            onClick={() => handleDeleteImage('driverPicture')}
                          >
                            <Clear />
                          </IconButton>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          label="Image URL"
                          value={imageData.driverPicture}
                          onChange={(e) => handleImageChange('driverPicture', e.target.value)}
                          margin="dense"
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<PhotoCamera />}
                          fullWidth
                          sx={{ height: '56px', mb: 1 }}
                        >
                          Upload Image
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'driverPicture')}
                          />
                        </Button>
                        <Typography variant="caption" display="block" gutterBottom>
                          OR
                        </Typography>
                        <TextField
                          fullWidth
                          label="Image URL"
                          placeholder="Enter image URL"
                          value={imageData.driverPicture}
                          onChange={(e) => handleImageChange('driverPicture', e.target.value)}
                          margin="normal"
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </Box>

              {/* Vehicle Number Plate */}
              <Box sx={{ flex: '1 1 30%', minWidth: '240px' }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Vehicle Number Plate</Typography>
                    {imageData.vehicleNumberPlatePicture ? (
                      <>
                        <Box sx={{ position: 'relative' }}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={imageData.vehicleNumberPlatePicture}
                            alt="Vehicle Number Plate"
                            sx={{ objectFit: 'cover', mb: 1 }}
                          />
                          <IconButton 
                            sx={{ position: 'absolute', top: 5, right: 5, bgcolor: 'rgba(255,255,255,0.7)' }}
                            size="small"
                            onClick={() => handleDeleteImage('vehicleNumberPlatePicture')}
                          >
                            <Clear />
                          </IconButton>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          label="Image URL"
                          value={imageData.vehicleNumberPlatePicture}
                          onChange={(e) => handleImageChange('vehicleNumberPlatePicture', e.target.value)}
                          margin="dense"
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<PhotoCamera />}
                          fullWidth
                          sx={{ height: '56px', mb: 1 }}
                        >
                          Upload Image
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'vehicleNumberPlatePicture')}
                          />
                        </Button>
                        <Typography variant="caption" display="block" gutterBottom>
                          OR
                        </Typography>
                        <TextField
                          fullWidth
                          label="Image URL"
                          placeholder="Enter image URL"
                          value={imageData.vehicleNumberPlatePicture}
                          onChange={(e) => handleImageChange('vehicleNumberPlatePicture', e.target.value)}
                          margin="normal"
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </Box>

              {/* GPS IMEI Picture */}
              <Box sx={{ flex: '1 1 30%', minWidth: '240px' }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>GPS IMEI Picture</Typography>
                    {imageData.gpsImeiPicture ? (
                      <>
                        <Box sx={{ position: 'relative' }}>
                          <CardMedia
                            component="img"
                            height="140"
                            image={imageData.gpsImeiPicture}
                            alt="GPS IMEI"
                            sx={{ objectFit: 'cover', mb: 1 }}
                          />
                          <IconButton 
                            sx={{ position: 'absolute', top: 5, right: 5, bgcolor: 'rgba(255,255,255,0.7)' }}
                            size="small"
                            onClick={() => handleDeleteImage('gpsImeiPicture')}
                          >
                            <Clear />
                          </IconButton>
                        </Box>
                        <TextField
                          fullWidth
                          size="small"
                          label="Image URL"
                          value={imageData.gpsImeiPicture}
                          onChange={(e) => handleImageChange('gpsImeiPicture', e.target.value)}
                          margin="dense"
                        />
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={<PhotoCamera />}
                          fullWidth
                          sx={{ height: '56px', mb: 1 }}
                        >
                          Upload Image
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'gpsImeiPicture')}
                          />
                        </Button>
                        <Typography variant="caption" display="block" gutterBottom>
                          OR
                        </Typography>
                        <TextField
                          fullWidth
                          label="Image URL"
                          placeholder="Enter image URL"
                          value={imageData.gpsImeiPicture}
                          onChange={(e) => handleImageChange('gpsImeiPicture', e.target.value)}
                          margin="normal"
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Box>
          </Box>

          {/* Add section for additional image types */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>Sealing & Additional Images</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Sealing Images */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>Sealing Images</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {imageData.sealingImages && imageData.sealingImages.length > 0 ? (
                      imageData.sealingImages.map((img, index) => (
                        <Box key={index} sx={{ position: 'relative', width: 120, height: 120 }}>
                          <img 
                            src={img} 
                            alt={`Sealing ${index+1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} 
                          />
                          <IconButton 
                            sx={{ position: 'absolute', top: 5, right: 5, bgcolor: 'rgba(255,255,255,0.7)' }}
                            size="small"
                            onClick={() => {
                              const updatedImages = [...imageData.sealingImages];
                              updatedImages.splice(index, 1);
                              setImageData(prev => ({
                                ...prev,
                                sealingImages: updatedImages
                              }));
                            }}
                          >
                            <Clear />
                          </IconButton>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">No sealing images</Typography>
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCamera />}
                    fullWidth
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Uploading..." : "Add Sealing Images"}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultipleImageUpload(e, 'sealingImages')}
                    />
                  </Button>
                </CardContent>
              </Card>

              {/* Vehicle Images */}
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>Vehicle Images</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {imageData.vehicleImages && imageData.vehicleImages.length > 0 ? (
                      imageData.vehicleImages.map((img, index) => (
                        <Box key={index} sx={{ position: 'relative', width: 120, height: 120 }}>
                          <img 
                            src={img} 
                            alt={`Vehicle ${index+1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} 
                          />
                          <IconButton 
                            sx={{ position: 'absolute', top: 5, right: 5, bgcolor: 'rgba(255,255,255,0.7)' }}
                            size="small"
                            onClick={() => {
                              const updatedImages = [...imageData.vehicleImages];
                              updatedImages.splice(index, 1);
                              setImageData(prev => ({
                                ...prev,
                                vehicleImages: updatedImages
                              }));
                            }}
                          >
                            <Clear />
                          </IconButton>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">No vehicle images</Typography>
                    )}
                  </Box>
                  <Button
                    variant="outlined"
                    component="label"
                    startIcon={<PhotoCamera />}
                    fullWidth
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Uploading..." : "Add Vehicle Images"}
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      multiple
                      onChange={(e) => handleMultipleImageUpload(e, 'vehicleImages')}
                    />
                  </Button>
                </CardContent>
              </Card>
            </Box>
          </Box>

          <Box mt={4} display="flex" justifyContent="flex-end">
            <Button 
              component={Link} 
              href={`/dashboard/sessions/${params.id}`} 
              sx={{ mr: 2 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={20} /> : <Save />}
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
} 