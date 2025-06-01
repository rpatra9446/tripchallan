"use client";

import { useState, useEffect, useMemo, useContext } from "react";
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
  InputAdornment,
  IconButton,
  FormHelperText,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from "@mui/material";
import { 
  ArrowBack, 
  ArrowForward, 
  PhotoCamera, 
  QrCode,
  Download,
  Close,
  Delete,
  CloudUpload
} from "@mui/icons-material";
import Link from "next/link";
import { EmployeeSubrole } from "@/prisma/enums";
import { SessionUpdateContext } from "@/app/dashboard/layout";
import ClientSideQrScanner from "@/app/components/ClientSideQrScanner";
import SimpleQrScanner from "@/app/components/SimpleQrScanner";
import { toast } from "react-hot-toast";

type CompanyType = {
  id: string;
  name: string;
};

type LoadingDetailsForm = {
  transporterName: string;
  materialName: string;
  receiverPartyName: string;
  vehicleNumber: string;
  registrationCertificate: string;
  registrationCertificateDoc: File | null;
  gpsImeiNumber: string;
  gpsImeiPicture: File | null;
  cargoType: string;
  loadingSite: string;
  source: string; // Added source location
  destination: string; // Added destination location
  loaderName: string;
  challanRoyaltyNumber: string;
  doNumber: string;
  freight: number;
  qualityOfMaterials: string;
  numberOfPackages: string;
  tpNumber: string;
  grossWeight: number;
  tareWeight: number;
  netMaterialWeight: number;
  loaderMobileNumber: string;
  timestamps: Record<string, string>;
};

type DriverDetailsForm = {
  driverName: string;
  driverContactNumber: string;
  driverLicense: string;
  driverLicenseDoc: File | null;
  driverPicture: File | null;
  timestamps: Record<string, string>;
};

type SealTagsForm = {
  sealTagIds: string[];
  sealTagScanned: boolean;
  manualSealTagId: string;
  sealTagImages: Record<string, File | null>;
  sealTagMethods: Record<string, 'digitally scanned' | 'manually entered'>;
  timestamps: Record<string, string>;
};

type ImagesForm = {
  vehicleNumberPlatePicture: File | null;
  vehicleImages: File[];
  additionalImages: File[];
  timestamps: Record<string, string>;
};

// const FileUploadHelp = () => (
//   <Box sx={{ mt: 1, mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
//     <Typography variant="body2" color="info.contrastText">
//       <strong>File Upload Tips:</strong>
//       <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
//         <li>Maximum file size: 5MB per image</li>
//         <li>Maximum 5 images per category</li>
//         <li>Reduce image size before uploading to avoid errors</li>
//         <li>Recommended image resolution: 1280x960 or smaller</li>
//       </ul>
//     </Typography>
//   </Box>
// );

const ImageProcessingInfo = () => (
  <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
    <Typography variant="body2" color="success.contrastText">
      <strong>Improved Image Storage:</strong> Images are automatically compressed and stored securely in the database. 
      This ensures they will always display correctly on all devices, even when viewing past trips.
    </Typography>
  </Box>
);

// const ImageErrorDisplay = ({ show }: { show: boolean }) => {
//   if (!show) return null;
  
//   return (
//     <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
//       <Typography variant="subtitle2" color="error.contrastText" gutterBottom>
//         <strong>Image Upload Requirements:</strong>
//       </Typography>
//       <Typography variant="body2" component="div" color="error.contrastText">
//         <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: '4px' }}>
//           <li>Each image must be smaller than 5MB</li>
//           <li>Total upload size must be under 20MB</li>
//           <li>Maximum 5 images per category</li>
//           <li>Recommended resolution: 1280x960 or smaller</li>
//           <li>Try reducing image quality if needed</li>
//         </ul>
//       </Typography>
//       <Typography variant="body2" color="error.contrastText" sx={{ mt: 1 }}>
//         If you're having trouble, try using the camera at a lower resolution or use an image compression app before uploading.
//       </Typography>
//     </Box>
//   );
// };

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

async function resizeImage(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.8/*, maxSizeInMB = 2*/): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calculate the new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * maxHeight / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with quality setting
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed'));
            return;
          }
          
          // // Check if the size is still too large
          // if (blob.size > maxSizeInMB * 1024 * 1024) { // This line and the block below should be commented
          //   // If still too large, try with lower quality
          //   if (quality > 0.4) {
          //     resizeImage(file, maxWidth, maxHeight, quality - 0.1 /*, maxSizeInMB*/) // maxSizeInMB commented
          //       .then(resolve)
          //       .catch(reject);
          //   } else {
          //     // Reduce dimensions further if quality reduction isn't enough
          //     resizeImage(file, Math.round(maxWidth * 0.7), Math.round(maxHeight * 0.7), 0.6 /*, maxSizeInMB*/) // maxSizeInMB commented
          //       .then(resolve)
          //       .catch(reject);
          //   }
          //   return;
          // }
          
          // Convert blob to file
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          resolve(resizedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = (error) => {
        reject(error);
      };
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
}

export default function CreateSessionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Vehicle data for autocomplete
  const [vehicles, setVehicles] = useState<Array<{id: string, numberPlate: string, status: string}>>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  
  // Step 1: Loading Details
  const [loadingDetails, setLoadingDetails] = useState<LoadingDetailsForm>({
    transporterName: "",
    materialName: "",
    receiverPartyName: "",
    vehicleNumber: "",
    registrationCertificate: "",
    registrationCertificateDoc: null,
    gpsImeiNumber: "",
    gpsImeiPicture: null,
    cargoType: "--Others--",
    loadingSite: "",
    source: "", // Added source location
    destination: "", // Added destination location
    loaderName: "",
    challanRoyaltyNumber: "",
    doNumber: "",
    freight: 0,
    qualityOfMaterials: "",
    numberOfPackages: "",
    tpNumber: "",
    grossWeight: 0,
    tareWeight: 0,
    netMaterialWeight: 0,
    loaderMobileNumber: "",
    timestamps: {}
  });

  // Step 2: Driver Details (new step)
  const [driverDetails, setDriverDetails] = useState<DriverDetailsForm>({
    driverName: "",
    driverContactNumber: "",
    driverLicense: "",
    driverLicenseDoc: null,
    driverPicture: null,
    timestamps: {}
  });
  
  // Step 3: Seal Tags (now the third step)
  const [sealTags, setSealTags] = useState<SealTagsForm>({
    sealTagIds: [],
    sealTagScanned: false,
    manualSealTagId: "",
    sealTagImages: {},
    sealTagMethods: {},
    timestamps: {}
  });

  // Step 4: Images & Verification
  const [imagesForm, setImagesForm] = useState<ImagesForm>({
    vehicleNumberPlatePicture: null,
    vehicleImages: [],
    additionalImages: [],
    timestamps: {}
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Calculate net weight automatically
  useEffect(() => {
    if (loadingDetails.grossWeight && loadingDetails.tareWeight) {
      const netWeight = loadingDetails.grossWeight - loadingDetails.tareWeight;
      setLoadingDetails(prev => ({
        ...prev,
        netMaterialWeight: netWeight > 0 ? netWeight : 0,
        timestamps: {
          ...prev.timestamps,
          netMaterialWeight: new Date().toISOString()
        }
      }));
    }
  }, [loadingDetails.grossWeight, loadingDetails.tareWeight]);

  useEffect(() => {
    // Check if user is an operator
    if (status === "authenticated" && session?.user) {
      if (
        session.user.role !== "EMPLOYEE" || 
        session.user.subrole !== EmployeeSubrole.OPERATOR
      ) {
        router.push("/dashboard");
      } else {
        // Check if operator has permission to create sessions
        fetch('/api/employees/' + session.user.id + '/permissions')
          .then(response => response.json())
          .then(data => {
            if (!data.canCreate) {
              setError("You don't have permission to create new trips. Please contact your administrator.");
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

  // Get user coin balance
  const [userCoins, setUserCoins] = useState<number | null>(null);
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetch('/api/users/' + session.user.id)
        .then(response => response.json())
        .then(data => {
          if (data && typeof data.coins === 'number') {
            setUserCoins(data.coins);
          }
        })
        .catch(err => {
          console.error("Error fetching user data:", err);
        });
    }
  }, [status, session]);

  // Fetch vehicles for the company
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setLoadingVehicles(true);
      fetch('/api/vehicles')
        .then(response => response.json())
        .then(data => {
          if (data.vehicles) {
            // Sort vehicles alphabetically by number plate
            const sortedVehicles = [...data.vehicles].sort((a, b) => 
              a.numberPlate.localeCompare(b.numberPlate)
            );
            setVehicles(sortedVehicles);
          }
        })
        .catch(err => {
          console.error("Error fetching vehicles:", err);
          setError("Could not load vehicle data. You can still enter a vehicle number manually.");
        })
        .finally(() => {
          setLoadingVehicles(false);
        });
    }
  }, [status, session]);

  // Handle creating a new vehicle
  const createNewVehicle = async (vehicleNumber: string) => {
    try {
      // Include RC data from the loading details
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          numberPlate: vehicleNumber,
          registrationCertificate: loadingDetails.registrationCertificate || null
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          // Vehicle already exists but wasn't in our list (could happen if another operator added it)
          // We can just continue with the trip
          console.log("Vehicle already exists in the system, continuing with trip creation");
          return true;
        }
        throw new Error(errorData.error || "Failed to create vehicle record");
      }
      
      const data = await response.json();
      // Add the new vehicle to our list
      setVehicles(prev => [...prev, data.vehicle].sort((a, b) => 
        a.numberPlate.localeCompare(b.numberPlate))
      );
      
      return true;
    } catch (err) {
      console.error("Error creating vehicle:", err);
      // Don't block trip creation if vehicle creation fails
      return true;
    }
  };

  // Specialized handler for vehicle number changes
  const handleVehicleNumberChange = (event: React.SyntheticEvent, value: string | null) => {
    // Clear any previous vehicle errors
    setError("");
    
    if (value) {
      // Check if vehicle exists and is active
      const existingVehicle = vehicles.find(v => v.numberPlate === value);
      
      if (existingVehicle && existingVehicle.status === "INACTIVE") {
        // Set validation error to block form submission
        setValidationErrors(prev => ({
          ...prev,
          vehicleNumber: "The entered Vehicle number is not Active. Please select an active vehicle."
        }));
      } else {
        // Clear validation error if vehicle is active or new
        if (validationErrors.vehicleNumber) {
          setValidationErrors(prev => {
            const newErrors = {...prev};
            delete newErrors.vehicleNumber;
            return newErrors;
          });
        }
      }
      
      // Update form value regardless of status
      setLoadingDetails(prev => ({
        ...prev,
        vehicleNumber: value,
        timestamps: {
          ...prev.timestamps,
          vehicleNumber: new Date().toISOString()
        }
      }));
    } else {
      // Handle clearing the field
      setLoadingDetails(prev => ({
        ...prev,
        vehicleNumber: "",
        timestamps: {
          ...prev.timestamps,
          vehicleNumber: new Date().toISOString()
        }
      }));
      
      // Clear validation error
      if (validationErrors.vehicleNumber) {
        setValidationErrors(prev => {
          const newErrors = {...prev};
          delete newErrors.vehicleNumber;
          return newErrors;
        });
      }
    }
  };
  
  // Handle manual input in the vehicle number field
  const handleVehicleInputChange = (event: React.SyntheticEvent, value: string) => {
    // Update the form data with the typed value
    setLoadingDetails(prev => ({
      ...prev,
      vehicleNumber: value,
      timestamps: {
        ...prev.timestamps,
        vehicleNumber: new Date().toISOString()
      }
    }));
    
    // Check if the entered vehicle exists and is inactive
    if (value) {
      const existingVehicle = vehicles.find(v => v.numberPlate === value);
      
      if (existingVehicle && existingVehicle.status === "INACTIVE") {
        // Set validation error to block form submission
        setValidationErrors(prev => ({
          ...prev,
          vehicleNumber: "The entered Vehicle number is not Active. Please select an active vehicle."
        }));
      } else {
        // Clear validation error if vehicle is active or new
        if (validationErrors.vehicleNumber) {
          setValidationErrors(prev => {
            const newErrors = {...prev};
            delete newErrors.vehicleNumber;
            return newErrors;
          });
        }
      }
    } else {
      // Clear errors when field is empty
      if (validationErrors.vehicleNumber) {
        setValidationErrors(prev => {
          const newErrors = {...prev};
          delete newErrors.vehicleNumber;
          return newErrors;
        });
      }
    }
  };

  const handleLoadingDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoadingDetails(prev => ({
      ...prev,
      [name]: value,
      timestamps: {
        ...prev.timestamps,
        [name]: new Date().toISOString()
      }
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

  const handleDriverDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDriverDetails(prev => ({
            ...prev,
      [name]: value,
      timestamps: {
        ...prev.timestamps,
        [name]: new Date().toISOString()
      }
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof ImagesForm | 'registrationCertificateDoc' | 'driverLicenseDoc') => {
    if (!e.target.files?.length) return;
    
    if (fieldName === 'vehicleImages' || fieldName === 'additionalImages') {
      // Filter out files that are too large
      const filesArray = Array.from(e.target.files);
      
      if (filesArray.length > 0) {
        setImagesForm(prev => ({
          ...prev,
          [fieldName]: [...prev[fieldName] as File[], ...filesArray],
          timestamps: {
            ...prev.timestamps,
            [fieldName]: new Date().toISOString()
          }
        }));
      }
    } else if (fieldName === 'registrationCertificateDoc') {
      const file = e.target.files[0];
      setLoadingDetails(prev => ({
        ...prev,
        registrationCertificateDoc: file,
        timestamps: {
          ...prev.timestamps,
          registrationCertificateDoc: new Date().toISOString()
        }
      }));
    } else if (fieldName === 'driverLicenseDoc') {
      const file = e.target.files[0];
      setDriverDetails(prev => ({
        ...prev,
        driverLicenseDoc: file,
        timestamps: {
          ...prev.timestamps,
          driverLicenseDoc: new Date().toISOString()
        }
      }));
    } else {
      // Handle other single file uploads (non-array fields)
      const file = e.target.files[0];
      setImagesForm(prev => ({
        ...prev,
        [fieldName]: file,
        timestamps: {
          ...prev.timestamps,
          [fieldName]: new Date().toISOString()
        }
      }));
    }
    
    // Clear validation error when file is uploaded
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // First, add a new function to check if a seal tag has been used before
  // Add this after the createNewVehicle function
  
  // Function to check if a seal tag has been used before
  const checkSealTagExistence = async (tagId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/sessions/seal-tags/check?tagId=${encodeURIComponent(tagId)}`);
      
      // If response is not ok, assume there's a server error and allow the tag (fail open)
      if (!response.ok) {
        console.error(`Error checking seal tag existence: ${response.status} ${response.statusText}`);
        return false;
      }
      
      const data = await response.json();
      return data.exists; // Return true if tag exists, false otherwise
    } catch (error) {
      console.error("Error checking seal tag existence:", error);
      return false; // In case of error, fail open to allow submission
    }
  };

  // Now update the handleAddSealTagWithImage function to use this check
  // Add a handler for adding seal tags with images
  const handleAddSealTagWithImage = async (tagId: string, imageFile: File) => {
    // Check if we've reached the maximum number of allowed seal tags
    if (sealTags.sealTagIds.length >= 40) {
      setError("Maximum of 40 seal tags allowed");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    // Check if tag is already in the list
    if (sealTags.sealTagIds.includes(tagId)) {
      setError("Tag ID already used in this session");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    // Check if tag has been used in any other session
    setError("Verifying seal tag...");
    const exists = await checkSealTagExistence(tagId);
    if (exists) {
      setError("Invalid Seal Tag scanned - this tag has already been used in another session");
      setTimeout(() => setError(""), 5000);
      return;
    }
    
    // Clear any previous error
    setError("");
    
    setSealTags(prev => ({
        ...prev,
      sealTagIds: [...prev.sealTagIds, tagId],
      sealTagImages: {
        ...prev.sealTagImages,
        [tagId]: imageFile
      },
      sealTagMethods: {
        ...prev.sealTagMethods,
        [tagId]: 'digitally scanned'
      },
        timestamps: {
          ...prev.timestamps,
        [tagId]: new Date().toISOString()
        }
      }));
  };

  // Update handleAddSealTag for manual entries to require an image and check for existence
  const handleAddSealTag = async () => {
    if (!sealTags.manualSealTagId) return;
    
    // Check if we've reached the maximum number of allowed seal tags
    if (sealTags.sealTagIds.length >= 40) {
      setError("Maximum of 40 seal tags allowed");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    // Check if tag is already in the list
    if (sealTags.sealTagIds.includes(sealTags.manualSealTagId)) {
      setError("Tag ID already used in this session");
      setTimeout(() => setError(""), 3000);
      return;
    }

    // Create validation error if no image is provided for manual entry
    if (!manualEntryImage) {
      setValidationErrors(prev => ({
        ...prev,
        manualEntryImage: "An image is required for manually entered seal tags"
      }));
      return;
    }
    
    // Check if tag has been used in any other session
    setError("Verifying seal tag...");
    const exists = await checkSealTagExistence(sealTags.manualSealTagId);
    if (exists) {
      setError("Invalid Seal Tag entered - this tag has already been used in another session");
      setTimeout(() => setError(""), 5000);
      return;
    }
    
    // Clear any previous error
    setError("");
    
    setSealTags(prev => ({
      ...prev,
      sealTagIds: [...prev.sealTagIds, prev.manualSealTagId],
      sealTagImages: {
        ...prev.sealTagImages,
        [prev.manualSealTagId]: manualEntryImage
      },
      sealTagMethods: {
        ...prev.sealTagMethods,
        [prev.manualSealTagId]: 'manually entered'
      },
      manualSealTagId: "",
      timestamps: {
        ...prev.timestamps,
        [prev.manualSealTagId]: new Date().toISOString()
      }
    }));

    // Clear the manual entry image
    setManualEntryImage(null);
    // Clear validation errors
    if (validationErrors.manualEntryImage) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.manualEntryImage;
        return newErrors;
      });
    }
  };

  // Handle removing a seal tag
  const handleRemoveSealTag = (tagId: string) => {
    setSealTags(prev => {
      const updatedSealTagIds = prev.sealTagIds.filter(id => id !== tagId);
      
      // Also remove the image and method for this tag
      const { [tagId]: removedImage, ...updatedImages } = prev.sealTagImages;
      const { [tagId]: removedMethod, ...updatedMethods } = prev.sealTagMethods;
      const { [tagId]: _, ...updatedTimestamps } = prev.timestamps;
      
      return {
        ...prev,
        sealTagIds: updatedSealTagIds,
        sealTagImages: updatedImages,
        sealTagMethods: updatedMethods,
        timestamps: updatedTimestamps
      };
    });
  };

  // State for storing the image for manual seal tag entries
  const [manualEntryImage, setManualEntryImage] = useState<File | null>(null);

  // Handle image upload for manual seal tag entries
  const handleManualSealTagImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    setManualEntryImage(file);
    
    // Clear validation error when file is uploaded
    if (validationErrors.manualEntryImage) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors.manualEntryImage;
        return newErrors;
      });
    }
  };

  // Add validation for ensuring all seal tags have images
  const validateSealTagsStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
      if (sealTags.sealTagIds.length === 0) {
        newErrors.sealTagIds = "At least one seal tag ID is required";
      }
      
      if (sealTags.sealTagIds.length > 40) {
        newErrors.sealTagIds = "Maximum of 40 seal tags allowed";
      }
      
    // Check for minimum number of tags (minimum 20 required)
    if (sealTags.sealTagIds.length < 20) {
      newErrors.sealTagIds = "Minimum of 20 seal tags required";
        }
        
    // Check if all seal tags have associated images
    const missingImages = sealTags.sealTagIds.filter(id => !sealTags.sealTagImages[id]);
    if (missingImages.length > 0) {
      newErrors.sealTagImages = `${missingImages.length} seal tag(s) are missing images`;
        }
    
    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Update the validateStep function
  const validateStep = (step: number): boolean => {
    // First, clear any existing validation errors
    const newErrors: Record<string, string> = {};
    
    if (step === 0) {
      // Validate Loading Details
      if (!loadingDetails.transporterName.trim()) {
        newErrors.transporterName = "Transporter name is required";
      }
      
      if (!loadingDetails.materialName.trim()) {
        newErrors.materialName = "Material name is required";
      }
      
      if (!loadingDetails.receiverPartyName.trim()) {
        newErrors.receiverPartyName = "Receiver party name is required";
      }
      
      if (!loadingDetails.vehicleNumber.trim()) {
        newErrors.vehicleNumber = "Vehicle number is required";
      }
      
      if (!loadingDetails.gpsImeiNumber.trim()) {
        newErrors.gpsImeiNumber = "GPS IMEI number is required";
      }
      
      // Add validation for GPS IMEI picture
      if (!loadingDetails.gpsImeiPicture) {
        newErrors.gpsImeiPicture = "GPS IMEI picture is required";
      }
      
      if (!loadingDetails.loadingSite.trim()) {
        newErrors.loadingSite = "Loading site is required";
      }
      if (!loadingDetails.source.trim()) {
        newErrors.source = "Source location is required";
      }
      if (!loadingDetails.destination.trim()) {
        newErrors.destination = "Destination location is required";
      }
    } else if (step === 1) {
      // Use the specialized validation for seal tags
      if (sealTags.sealTagIds.length === 0) {
        newErrors.sealTagIds = "At least one seal tag ID is required";
      }
      
      if (sealTags.sealTagIds.length > 40) {
        newErrors.sealTagIds = "Maximum of 40 seal tags allowed";
      }
      
      // Check for minimum number of tags (minimum 20 required)
      if (sealTags.sealTagIds.length < 20) {
        newErrors.sealTagIds = "Minimum of 20 seal tags required";
      }
      
      // Check if all seal tags have associated images
      const missingImages = sealTags.sealTagIds.filter(id => !sealTags.sealTagImages[id]);
      if (missingImages.length > 0) {
        newErrors.sealTagImages = `${missingImages.length} seal tag(s) are missing images`;
      }
    } else if (step === 2) {
      // Validate Driver Details
      if (!driverDetails.driverName.trim()) {
        newErrors.driverName = "Driver name is required";
      }
      
      if (!driverDetails.driverContactNumber.trim()) {
        newErrors.driverContactNumber = "Driver contact number is required";
      } else if (!/^\d{10}$/.test(driverDetails.driverContactNumber)) {
        newErrors.driverContactNumber = "Contact number must be 10 digits";
      }
      
      if (!driverDetails.driverLicense.trim()) {
        newErrors.driverLicense = "Driver license is required";
      }
      
      // Add validation for driver picture
      if (!driverDetails.driverPicture) {
        newErrors.driverPicture = "Driver's picture is required";
      }
    } else if (step === 3) {
      // Validate Images & Verification
      if (!imagesForm.vehicleNumberPlatePicture) {
        newErrors.vehicleNumberPlatePicture = "Vehicle number plate picture is required";
      }
      if (imagesForm.vehicleImages.length === 0) {
        newErrors.vehicleImages = "At least one vehicle image is required";
      }
    }
    
    // Set all validation errors at once
    setValidationErrors(newErrors);
    
    // Return true if there are no errors
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  // Add state for loading ID and QR code display
  const [tripCreated, setTripCreated] = useState(false);
  const [loadingId, setLoadingId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  // Function to generate QR code for the loading ID
  const generateQRCode = (id: string) => {
    // Create a URL for a QR code generator API (e.g., QRServer)
    const baseUrl = "https://api.qrserver.com/v1/create-qr-code/";
    const data = JSON.stringify({
      loadingId: id,
      createdAt: new Date().toISOString()
    });
    const url = `${baseUrl}?data=${encodeURIComponent(data)}&size=200x200&margin=10`;
    setQrCodeUrl(url);
  };

  // Function to download QR code
  const downloadQRCode = () => {
    // Create a temporary link and trigger download
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `loading-id-${loadingId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Update handleSubmit to fix form submission issues
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submission started");
    
    // Check if form is already submitting to prevent double submissions
    if (isSubmitting) {
      console.log("Submission already in progress, preventing duplicate submission");
      return;
    }
    
    // Immediately set isSubmitting to true to disable the submit button
    setIsSubmitting(true);
    
    // Clear previous errors
    setError("");
    setErrorDetails("");
    
    // Validate the current step (final step)
    if (!validateStep(activeStep)) {
      console.log("Validation failed on final step", validationErrors);
      setIsSubmitting(false);
      return;
    }
    
    try {
      console.log("Starting trip creation process");
      
      // Create form data to handle file uploads
      const formData = new FormData();
      
      // Add loading details
      Object.entries(loadingDetails).forEach(([key, value]) => {
        if (key !== 'timestamps' && key !== 'registrationCertificateDoc' && key !== 'gpsImeiPicture') {
          formData.append(key, String(value));
        }
      });
      
      // Add timestamps for loading details
      formData.append('loadingDetailsTimestamps', JSON.stringify(loadingDetails.timestamps));
      
      // Add driver details
      Object.entries(driverDetails).forEach(([key, value]) => {
        if (key !== 'timestamps' && key !== 'driverLicenseDoc' && key !== 'driverPicture') {
          formData.append(key, String(value));
        }
      });
      
      // Add timestamps for driver details
      formData.append('driverDetailsTimestamps', JSON.stringify(driverDetails.timestamps));
      
      // Add seal tags data
      formData.append('sealTagIds', JSON.stringify(sealTags.sealTagIds));
      formData.append('sealTagMethods', JSON.stringify(sealTags.sealTagMethods));
      formData.append('sealTagTimestamps', JSON.stringify(sealTags.timestamps));
      
      console.log("Form data basic fields added");
      
      // Prepare base64 image data
      const imageBase64Data: Record<string, any> = {};
      
      // Track progress in more detail to detect where issues might occur
      let progressStage = "starting";
      
      try {
        progressStage = "processing seal tag images";
        // Add seal tag images to the imageBase64Data and formData
        imageBase64Data.sealTagImages = {};
        console.log(`Processing ${sealTags.sealTagIds.length} seal tag images`);
        for (const tagId of sealTags.sealTagIds) {
          const image = sealTags.sealTagImages[tagId];
          if (image) {
            try {
              const resizedImage = await resizeImage(image, 1280, 1280, 0.8);
          const base64Data = await fileToBase64(resizedImage);
              
              // Add to base64 data
              imageBase64Data.sealTagImages[tagId] = {
                data: base64Data.split(',')[1],
            contentType: resizedImage.type,
                name: resizedImage.name,
                method: sealTags.sealTagMethods[tagId] || 'unknown'
          };
              
              // Add to form data
              formData.append(`sealTagImages[${tagId}]`, resizedImage);
        } catch (error) {
              console.error(`Error processing seal tag image for ${tagId}:`, error);
              throw new Error(`Error processing image for seal tag ${tagId}. Please try with a smaller image.`);
            }
          }
        }
        
        progressStage = "processing registration certificate";
        // Convert registration certificate document to base64 if available
        if (loadingDetails.registrationCertificateDoc) {
          try {
            const base64Data = await fileToBase64(loadingDetails.registrationCertificateDoc);
            imageBase64Data.registrationCertificateDoc = {
              data: base64Data.split(',')[1],
              contentType: loadingDetails.registrationCertificateDoc.type,
              name: loadingDetails.registrationCertificateDoc.name
            };
            formData.append('registrationCertificateDoc', loadingDetails.registrationCertificateDoc);
          } catch (error) {
            console.error("Error processing registration certificate document:", error);
            throw new Error("Error processing registration certificate document. Please try with a smaller file.");
          }
        }
        
        progressStage = "processing driver license";
        // Convert driver license document to base64 if available
        if (driverDetails.driverLicenseDoc) {
          try {
            const base64Data = await fileToBase64(driverDetails.driverLicenseDoc);
            imageBase64Data.driverLicenseDoc = {
              data: base64Data.split(',')[1],
              contentType: driverDetails.driverLicenseDoc.type,
              name: driverDetails.driverLicenseDoc.name
            };
            formData.append('driverLicenseDoc', driverDetails.driverLicenseDoc);
          } catch (error) {
            console.error("Error processing driver license document:", error);
            throw new Error("Error processing driver license document. Please try with a smaller file.");
          }
        }
        
        progressStage = "processing GPS IMEI picture";
        // Process GPS IMEI picture
        if (loadingDetails.gpsImeiPicture) {
          try {
            const resizedImage = await resizeImage(loadingDetails.gpsImeiPicture, 1280, 1280, 0.8);
          const base64Data = await fileToBase64(resizedImage);
            imageBase64Data.gpsImeiPicture = {
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          };
            formData.append('gpsImeiPicture', resizedImage);
        } catch (error) {
            console.error("Error processing GPS IMEI image:", error);
            throw new Error("Error processing GPS IMEI image. Please try with a smaller image.");
          }
        }
        
        progressStage = "processing driver picture";
        // Process driver picture
        if (driverDetails.driverPicture) {
          try {
            const resizedImage = await resizeImage(driverDetails.driverPicture, 1280, 1280, 0.8);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.driverPicture = {
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          };
          formData.append('driverPicture', resizedImage);
        } catch (error) {
          console.error("Error processing driver picture:", error);
            throw new Error("Error processing driver picture. Please try with a smaller image.");
          }
        }
        
        progressStage = "processing vehicle number plate picture";
        // Convert vehicle number plate picture
        if (imagesForm.vehicleNumberPlatePicture) {
          try {
            // Resize the image first
            const resizedImage = await resizeImage(imagesForm.vehicleNumberPlatePicture, 1280, 1280, 0.8);
          const base64Data = await fileToBase64(resizedImage);
            imageBase64Data.vehicleNumberPlatePicture = {
              data: base64Data.split(',')[1], // Remove data URL prefix
            contentType: resizedImage.type,
            name: resizedImage.name
            };
            formData.append('vehicleNumberPlatePicture', resizedImage);
        } catch (error) {
            console.error("Error processing vehicle number plate image:", error);
            throw new Error("Error processing vehicle number plate image. Please try with a smaller image.");
          }
        }
        
        progressStage = "processing vehicle images";
        // Process array images
        imageBase64Data.vehicleImages = [];
        imageBase64Data.additionalImages = [];
        
        // Add multiple files - limit the number of files to reduce payload size
        const maxImagesPerCategory = 5; // Limit to 5 images per category
      
      // Process vehicle images
      for (let i = 0; i < Math.min(imagesForm.vehicleImages.length, maxImagesPerCategory); i++) {
        try {
          const file = imagesForm.vehicleImages[i];
            const resizedImage = await resizeImage(file, 1280, 1280, 0.8);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.vehicleImages.push({
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          });
          formData.append(`vehicleImages[${i}]`, resizedImage);
        } catch (error) {
          console.error(`Error processing vehicle image ${i}:`, error);
            throw new Error(`Error processing vehicle image ${i+1}. Please try with a smaller image.`);
        }
      }
      
        progressStage = "processing additional images";
        // Process additional images with the same approach
      for (let i = 0; i < Math.min(imagesForm.additionalImages.length, maxImagesPerCategory); i++) {
        try {
          const file = imagesForm.additionalImages[i];
            const resizedImage = await resizeImage(file, 1280, 1280, 0.8);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.additionalImages.push({
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          });
          formData.append(`additionalImages[${i}]`, resizedImage);
        } catch (error) {
          console.error(`Error processing additional image ${i}:`, error);
            throw new Error(`Error processing additional image ${i+1}. Please try with a smaller image.`);
          }
        }
      } catch (error) {
        console.error(`Error while ${progressStage}:`, error);
        setError(`Error while ${progressStage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setErrorDetails("Try using smaller images or fewer images. Each image should be under 5MB.");
          setIsSubmitting(false);
          return;
      }
      
      // Add the base64 image data to the form
      formData.append('imageBase64Data', JSON.stringify(imageBase64Data));
      
      // Add timestamps for images form
      formData.append('imagesFormTimestamps', JSON.stringify(imagesForm.timestamps));

      console.log("All form data prepared, sending to server");

      // Send the request without Content-Type header to allow browser to set correct boundary for FormData
      const response = await fetch("/api/sessions", {
        method: "POST",
        body: formData,
        // Do not set Content-Type header as browser will set it automatically for FormData
      });

      console.log("API response status:", response.status);

      // Handle different error response types
      if (!response.ok) {
        // Try to parse error as JSON first
        let errorData;
        try {
          errorData = await response.json();
          console.error("API error response:", errorData);
          
          let mainError = errorData.error || "Failed to create trip";
          let detailsError = "";
          
          // Extract the main error from potentially longer message
          if (mainError.includes(":")) {
            const parts = mainError.split(":");
            mainError = parts[0].trim();
            detailsError = parts.slice(1).join(":").trim();
          }
          
          throw new Error(mainError, { cause: detailsError });
        } catch (jsonError) {
          // If we can't parse JSON, use the status text
          console.error("Failed to parse error response:", jsonError);
          
          if (response.status === 500) {
            throw new Error("Server error: Could not process the request.", 
              { cause: "An unexpected error occurred on the server. Please try again with smaller images or fewer images." });
          } else if (response.status === 413) {
            throw new Error("Data too large", 
              { cause: "The images or data you're uploading are too large. Please use smaller or fewer images." });
          } else {
            throw new Error(`Server error: ${response.status} ${response.statusText}.`, 
              { cause: "An unexpected server error occurred. Please try again later." });
          }
        }
      }
      
      const data = await response.json();
      console.log("API response data:", data);

      // Generate QR code for the loading ID
      if (data.sessionId) {
        setLoadingId(data.sessionId);
        generateQRCode(data.sessionId);

      // Refresh the user session to update coin balance
        if (refreshUserSession) {
      await refreshUserSession();
        }

        // Show success message
        toast.success("Session created successfully!");
        
        // Redirect to sessions page after successful creation
      router.push("/dashboard/sessions");
        return; // Ensure no further code runs after redirect
      } else {
        console.error("API response missing session ID:", data);
        throw new Error("Invalid response from server. Session ID not found.");
      }
    } catch (err) {
      const error = err as Error;
      console.error("Error submitting form:", error);
      setError(error.message || "An unknown error occurred");
      setErrorDetails(error.cause as string || "");
      
      // Show error toast for better visibility
      toast.error(error.message || "An error occurred while creating the session");
      } finally {
      // Ensure isSubmitting is always set to false after API call completes
      setIsSubmitting(false);
    }
  };

  const steps = ['Loading Details', 'Seal Tags', 'Driver Details', 'Images'];
  
  // Function to display a preview of an image
  const renderImagePreview = (file: File | null) => {
    if (!file) return null;
    
    const imageUrl = URL.createObjectURL(file);
    return (
      <Box sx={{ mt: 1, position: 'relative', width: '100%', height: '100%' }}>
        <img
          src={imageUrl}
          alt="Preview"
          style={{ 
            width: '100%', 
            height: '100%', 
            objectFit: 'cover',
            borderRadius: '4px'
          }}
          onLoad={() => URL.revokeObjectURL(imageUrl)}
        />
      </Box>
    );
  };

  // Add a section to display QR code and loading ID after trip creation
  const renderSuccessView = () => {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Trip Created Successfully!
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 2 }}>
          Loading ID: <strong>{loadingId}</strong>
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          {qrCodeUrl && (
            <Box sx={{ textAlign: 'center' }}>
              <img src={qrCodeUrl} alt="Loading ID QR Code" style={{ maxWidth: '200px' }} />
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Scan this QR code to view trip details
              </Typography>
            </Box>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={downloadQRCode}
          >
            Download QR Code
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={() => router.push("/dashboard/sessions")}
          >
            View All Trips
          </Button>
        </Box>
      </Box>
    );
  };

  if (status === "loading") {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box mb={3}>
        <Button
          component={Link}
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Box>

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Trip
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography fontWeight="medium">
              {error}
            </Typography>
            {errorDetails && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {errorDetails}
              </Typography>
            )}
          </Alert>
        )}
        
        {/* <ImageErrorDisplay show={!!error && (error.includes("image") || error.includes("large") || errorDetails.includes("image") || errorDetails.includes("MB"))} /> */}

        {/* Coin notice */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography fontWeight="medium">
            Creating a new session costs 1 coin from your balance.
            {userCoins !== null && (
              <> Your current balance: <strong>{userCoins} {userCoins === 1 ? 'coin' : 'coins'}</strong>.</>
            )}
            {userCoins !== null && userCoins < 1 && (
              <Box mt={1}>
                <Typography color="error" fontWeight="bold">
                  You don't have enough coins to create a session. Please contact an administrator to allocate more coins.
                </Typography>
              </Box>
            )}
          </Typography>
        </Alert>

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit}>
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Loading Details
                </Typography>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Transporter Name"
                  name="transporterName"
                  value={loadingDetails.transporterName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.transporterName}
                  helperText={validationErrors.transporterName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Receiver Party Name"
                  name="receiverPartyName"
                  value={loadingDetails.receiverPartyName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.receiverPartyName}
                  helperText={validationErrors.receiverPartyName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Material Name"
                  name="materialName"
                  value={loadingDetails.materialName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.materialName}
                  helperText={validationErrors.materialName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <FormControl fullWidth error={!!validationErrors.cargoType}>
                  <InputLabel id="cargo-type-label">Cargo Type</InputLabel>
                  <Select
                    labelId="cargo-type-label"
                    id="cargo-type"
                    name="cargoType"
                    value={loadingDetails.cargoType}
                    label="Cargo Type"
                    onChange={(e) => handleLoadingDetailsChange(e as React.ChangeEvent<HTMLInputElement>)}
                  >
                    <MenuItem value="Perishable (fruits, vegetables, dairy)">Perishable (fruits, vegetables, dairy)</MenuItem>
                    <MenuItem value="Hazardous (chemicals, explosives)">Hazardous (chemicals, explosives)</MenuItem>
                    <MenuItem value="Liquid Bulk (petroleum, oils)">Liquid Bulk (petroleum, oils)</MenuItem>
                    <MenuItem value="Dry Bulk (grains, coal)">Dry Bulk (grains, coal)</MenuItem>
                    <MenuItem value="Containerized (packed in containers)">Containerized (packed in containers)</MenuItem>
                    <MenuItem value="General Cargo (machinery, textiles)">General Cargo (machinery, textiles)</MenuItem>
                    <MenuItem value="--Others--">--Others--</MenuItem>
                  </Select>
                  {validationErrors.cargoType && (
                    <FormHelperText>{validationErrors.cargoType}</FormHelperText>
                  )}
                </FormControl>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Quality of Materials"
                  name="qualityOfMaterials"
                  value={loadingDetails.qualityOfMaterials}
                  onChange={handleLoadingDetailsChange}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Number of Packages (Optional)"
                  name="numberOfPackages"
                  value={loadingDetails.numberOfPackages}
                  onChange={handleLoadingDetailsChange}
                  type="number"
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Autocomplete
                  freeSolo
                  options={vehicles.map(vehicle => vehicle.numberPlate)}
                  value={loadingDetails.vehicleNumber}
                  onChange={handleVehicleNumberChange}
                  onInputChange={handleVehicleInputChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                  fullWidth
                  label="Vehicle Number"
                  name="vehicleNumber"
                  required
                  placeholder="MH02AB1234"
                  error={!!validationErrors.vehicleNumber}
                      helperText={
                        validationErrors.vehicleNumber || 
                        "Format: MH02AB1234 (Standard) or TEMP/25/OD/02/1234 (Temporary)"
                      }
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loadingVehicles ? <CircularProgress size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  loading={loadingVehicles}
                  loadingText="Loading vehicles..."
                  noOptionsText="No vehicles found"
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Registration Certificate (RC)"
                  name="registrationCertificate"
                  value={loadingDetails.registrationCertificate}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.registrationCertificate}
                  helperText={validationErrors.registrationCertificate}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload RC Document
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {loadingDetails.registrationCertificateDoc ? 'Change Document' : 'Upload Document'}
                  <input
                    type="file"
                    hidden
                    accept="application/pdf,image/*"
                    onChange={(e) => handleFileChange(e, 'registrationCertificateDoc')}
                  />
                </Button>
                {loadingDetails.registrationCertificateDoc && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {loadingDetails.registrationCertificateDoc.name}
                  </Typography>
                )}
                {validationErrors.registrationCertificateDoc && (
                  <FormHelperText error>{validationErrors.registrationCertificateDoc}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  fullWidth
                    label="GPS IMEI Number"
                    name="gpsImeiNumber"
                    value={loadingDetails.gpsImeiNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                    type="number"
                    error={!!validationErrors.gpsImeiNumber}
                    helperText={validationErrors.gpsImeiNumber}
                  />
                  <Box sx={{ minWidth: '120px', mt: 1 }}>
                    <ClientSideQrScanner
                      buttonVariant="outlined"
                      buttonText="Scan"
                      scannerTitle="Scan GPS IMEI"
                      onScanWithImage={(data, imageFile) => {
                        setLoadingDetails(prev => ({
                          ...prev,
                          gpsImeiNumber: data,
                          gpsImeiPicture: imageFile,
                          timestamps: {
                            ...prev.timestamps,
                            gpsImeiNumber: new Date().toISOString(),
                            gpsImeiPicture: new Date().toISOString()
                          }
                        }));
                        
                        // Clear validation errors if any
                        if (validationErrors.gpsImeiNumber || validationErrors.gpsImeiPicture) {
                          setValidationErrors(prev => {
                            const newErrors = {...prev};
                            delete newErrors.gpsImeiNumber;
                            delete newErrors.gpsImeiPicture;
                            return newErrors;
                          });
                        }
                      }}
                    />
                  </Box>
                </Box>
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    GPS IMEI Picture {loadingDetails.gpsImeiPicture ? '(Auto-captured from scan)' : '(Manual capture required)'}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {!loadingDetails.gpsImeiPicture ? (
                      <Button
                        variant="outlined"
                        component="label"
                        startIcon={<PhotoCamera />}
                        sx={{ height: '56px' }}
                      >
                        Take Photo
                        <input
                          type="file"
                          hidden
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            if (!e.target.files?.length) return;
                            const file = e.target.files[0];
                            setLoadingDetails(prev => ({
                              ...prev,
                              gpsImeiPicture: file,
                              timestamps: {
                                ...prev.timestamps,
                                gpsImeiPicture: new Date().toISOString()
                              }
                            }));
                            
                            // Clear validation errors
                            if (validationErrors.gpsImeiPicture) {
                              setValidationErrors(prev => {
                                const newErrors = {...prev};
                                delete newErrors.gpsImeiPicture;
                                return newErrors;
                              });
                            }
                          }}
                        />
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Close />}
                        sx={{ height: '56px' }}
                        onClick={() => {
                          setLoadingDetails(prev => ({
                            ...prev,
                            gpsImeiPicture: null,
                            // Clear GPS IMEI number if it was captured by scanning
                            ...(prev.timestamps.gpsImeiNumber === prev.timestamps.gpsImeiPicture ? { gpsImeiNumber: '' } : {}),
                            timestamps: {
                              ...prev.timestamps,
                              gpsImeiPicture: new Date().toISOString(),
                              ...(prev.timestamps.gpsImeiNumber === prev.timestamps.gpsImeiPicture ? { gpsImeiNumber: new Date().toISOString() } : {})
                            }
                          }));
                        }}
                      >
                        Remove
                      </Button>
                    )}
                    
                    {/* Preview of GPS IMEI image */}
                    {loadingDetails.gpsImeiPicture && (
                      <Box sx={{ maxWidth: '150px', maxHeight: '150px', overflow: 'hidden' }}>
                        {renderImagePreview(loadingDetails.gpsImeiPicture)}
                      </Box>
                    )}
                  </Box>
                  {validationErrors.gpsImeiPicture && (
                    <FormHelperText error>{validationErrors.gpsImeiPicture}</FormHelperText>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loading Site"
                  name="loadingSite"
                  value={loadingDetails.loadingSite}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.loadingSite}
                  helperText={validationErrors.loadingSite}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Source"
                  name="source"
                  value={loadingDetails.source}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.source}
                  helperText={validationErrors.source}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Destination"
                  name="destination"
                  value={loadingDetails.destination}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.destination}
                  helperText={validationErrors.destination}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loader Name"
                  name="loaderName"
                  value={loadingDetails.loaderName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.loaderName}
                  helperText={validationErrors.loaderName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loader Mobile Number"
                  name="loaderMobileNumber"
                  value={loadingDetails.loaderMobileNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="tel"
                  inputProps={{ maxLength: 10 }}
                  error={!!validationErrors.loaderMobileNumber}
                  helperText={validationErrors.loaderMobileNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Challan Royalty Number"
                  name="challanRoyaltyNumber"
                  value={loadingDetails.challanRoyaltyNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.challanRoyaltyNumber}
                  helperText={validationErrors.challanRoyaltyNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="DO Number"
                  name="doNumber"
                  value={loadingDetails.doNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.doNumber}
                  helperText={validationErrors.doNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Freight"
                  name="freight"
                  value={loadingDetails.freight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  error={!!validationErrors.freight}
                  helperText={validationErrors.freight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="TP Number"
                  name="tpNumber"
                  value={loadingDetails.tpNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.tpNumber}
                  helperText={validationErrors.tpNumber}
                />
              </Box>

              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Gross Weight (kg)"
                  name="grossWeight"
                  value={loadingDetails.grossWeight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.grossWeight}
                  helperText={validationErrors.grossWeight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Tare Weight (kg)"
                  name="tareWeight"
                  value={loadingDetails.tareWeight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.tareWeight}
                  helperText={validationErrors.tareWeight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Net Material Weight (kg)"
                  value={loadingDetails.netMaterialWeight}
                  InputProps={{
                    readOnly: true,
                  }}
                  disabled
                />
              </Box>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Seal Tags
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Scan or manually enter seal tags. A minimum of 20 seal tags is required. Each tag must be unique and have an associated image.
                </Typography>
                
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
              </Box>
              
              <Box sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                    Scan QR/Barcode
                </Typography>
                  <ClientSideQrScanner
                    onScanWithImage={(data, imageFile) => {
                      // Check if already scanned
                      if (sealTags.sealTagIds.includes(data)) {
                        setError("Tag ID already used");
                        setTimeout(() => setError(""), 3000);
                        return;
                      }
                      
                      handleAddSealTagWithImage(data, imageFile);
                    }}
                    buttonText="Scan QR Code"
                    scannerTitle="Scan Seal Tag"
                    buttonVariant="outlined"
                  />
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Manual Entry
                  </Typography>
                  <TextField
                    fullWidth
                    label="Seal Tag ID"
                    value={sealTags.manualSealTagId}
                    onChange={(e) => setSealTags(prev => ({
                      ...prev,
                      manualSealTagId: e.target.value
                    }))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button 
                            onClick={handleAddSealTag} 
                            disabled={!sealTags.manualSealTagId || !manualEntryImage}
                          >
                            Add
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    error={!!validationErrors.sealTagIds}
                    helperText={validationErrors.sealTagIds}
                    sx={{ mb: 2 }}
                  />
                  
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                {!manualEntryImage ? (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<PhotoCamera />}
                      sx={{ height: '56px' }}
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
                      startIcon={<CloudUpload />}
                      sx={{ height: '56px' }}
                    >
                      Upload
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleManualSealTagImageChange}
                      />
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                  </Box>
                  
                  {validationErrors.manualEntryImage && (
                    <FormHelperText error>{validationErrors.manualEntryImage}</FormHelperText>
                  )}
                </Box>
              </Box>
              
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Registered Seal Tags: {sealTags.sealTagIds.length}</span>
                  {validationErrors.sealTagImages && (
                    <Typography variant="caption" color="error">
                      {validationErrors.sealTagImages}
                  </Typography>
                )}
                </Typography>
                
                {sealTags.sealTagIds.length > 0 ? (
                  <Box sx={{ 
                    mt: 1, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    borderRadius: 1,
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>No.</TableCell>
                          <TableCell>Seal Tag ID</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Image</TableCell>
                          <TableCell>Timestamp</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                    {sealTags.sealTagIds.map((tagId, index) => (
                          <TableRow key={tagId}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{tagId}</TableCell>
                            <TableCell>
                          <Chip
                                label={sealTags.sealTagMethods[tagId] === 'digitally scanned' ? 'Digitally Scanned' : 'Manually Entered'} 
                                color={sealTags.sealTagMethods[tagId] === 'digitally scanned' ? 'primary' : 'secondary'} 
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {sealTags.sealTagImages[tagId] ? (
                                <Box sx={{ width: 40, height: 40 }}>
                                  {renderImagePreview(sealTags.sealTagImages[tagId])}
                                </Box>
                              ) : (
                                <Typography variant="caption" color="error">No image</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                          {sealTags.timestamps[tagId] && (
                            <Typography variant="caption" color="text.secondary">
                              {new Date(sealTags.timestamps[tagId]).toLocaleString()}
                            </Typography>
                          )}
                            </TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleRemoveSealTag(tagId)}
                                aria-label="Delete Seal Tag"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                    ))}
                      </TableBody>
                    </Table>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    No seal tags registered. Scan or manually enter seal tags above.
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Driver Details
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Enter the driver's details.
                </Typography>
                
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Driver's Photo
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  sx={{ height: '56px' }}
                >
                    {driverDetails.driverPicture ? 'Change Photo' : 'Take Photo'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                      capture="user"
                      onChange={(e) => {
                        if (!e.target.files?.length) return;
                        const file = e.target.files[0];
                        setDriverDetails(prev => ({
                          ...prev,
                          driverPicture: file,
                          timestamps: {
                            ...prev.timestamps,
                            driverPicture: new Date().toISOString()
                          }
                        }));
                      }}
                  />
                </Button>
                  
                  {/* Preview of driver image */}
                  {driverDetails.driverPicture && (
                    <Box sx={{ maxWidth: '150px', maxHeight: '150px', overflow: 'hidden', borderRadius: '4px' }}>
                      {renderImagePreview(driverDetails.driverPicture)}
                    </Box>
                )}
                </Box>
                {validationErrors.driverPicture && (
                  <FormHelperText error>{validationErrors.driverPicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver Name"
                  name="driverName"
                  value={driverDetails.driverName}
                  onChange={handleDriverDetailsChange}
                  required
                  error={!!validationErrors.driverName}
                  helperText={validationErrors.driverName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver Contact Number"
                  name="driverContactNumber"
                  value={driverDetails.driverContactNumber}
                  onChange={handleDriverDetailsChange}
                  required
                  type="tel"
                  inputProps={{ maxLength: 10 }}
                  error={!!validationErrors.driverContactNumber}
                  helperText={validationErrors.driverContactNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver License"
                  name="driverLicense"
                  value={driverDetails.driverLicense}
                  onChange={handleDriverDetailsChange}
                  required
                  error={!!validationErrors.driverLicense}
                  helperText={validationErrors.driverLicense}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Driver's License Document
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {driverDetails.driverLicenseDoc ? 'Change Document' : 'Upload Document'}
                  <input
                    type="file"
                    hidden
                    accept="application/pdf,image/*"
                    onChange={(e) => handleFileChange(e, 'driverLicenseDoc')}
                  />
                </Button>
                {driverDetails.driverLicenseDoc && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {driverDetails.driverLicenseDoc.name}
                  </Typography>
                )}
                {validationErrors.driverLicenseDoc && (
                  <FormHelperText error>{validationErrors.driverLicenseDoc}</FormHelperText>
                )}
              </Box>
            </Box>
          )}

          {activeStep === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Images
                </Typography>
                <ImageProcessingInfo />
              </Box>
              
              {/* Display GPS IMEI picture from Loading Details */}
              {loadingDetails.gpsImeiPicture && (
                <Box sx={{ width: '100%', mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                    GPS IMEI Picture
                </Typography>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      border: '1px solid #ddd', 
                      borderRadius: 1, 
                      p: 2, 
                      maxWidth: '300px' 
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      GPS IMEI Number: {loadingDetails.gpsImeiNumber}
                    </Typography>
                    <Box sx={{ maxWidth: '280px', mt: 1 }}>
                      {renderImagePreview(loadingDetails.gpsImeiPicture)}
                    </Box>
                  </Box>
                </Box>
              )}
              
              {/* Display Driver picture from Driver Details */}
              {driverDetails.driverPicture && (
                <Box sx={{ width: '100%', mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Driver Picture
                  </Typography>
                  <Box 
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      border: '1px solid #ddd', 
                      borderRadius: 1, 
                      p: 2, 
                      maxWidth: '300px' 
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" gutterBottom>
                      Driver Name: {driverDetails.driverName}
                    </Typography>
                    <Box sx={{ maxWidth: '280px', mt: 1 }}>
                      {renderImagePreview(driverDetails.driverPicture)}
                    </Box>
                  </Box>
                </Box>
              )}
              
              {/* Display Seal Tags table read-only */}
              <Box sx={{ width: '100%', mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Seal Tags
                </Typography>
                {sealTags.sealTagIds.length > 0 ? (
                  <Box sx={{ 
                    mt: 1, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    borderRadius: 1,
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>No.</TableCell>
                          <TableCell>Seal Tag ID</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Image</TableCell>
                          <TableCell>Timestamp</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sealTags.sealTagIds.map((tagId, index) => (
                          <TableRow key={tagId}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{tagId}</TableCell>
                            <TableCell>
                              <Chip 
                                label={sealTags.sealTagMethods[tagId] === 'digitally scanned' ? 'Digitally Scanned' : 'Manually Entered'} 
                                color={sealTags.sealTagMethods[tagId] === 'digitally scanned' ? 'primary' : 'secondary'} 
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {sealTags.sealTagImages[tagId] ? (
                                <Box sx={{ width: 40, height: 40 }}>
                                  {renderImagePreview(sealTags.sealTagImages[tagId])}
                                </Box>
                              ) : (
                                <Typography variant="caption" color="error">No image</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {sealTags.timestamps[tagId] && (
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(sealTags.timestamps[tagId]).toLocaleString()}
                  </Typography>
                )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    No seal tags registered. Please add seal tags in the Seal Tags section.
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Vehicle Number Plate
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.vehicleNumberPlatePicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'vehicleNumberPlatePicture')}
                  />
                </Button>
                {imagesForm.vehicleNumberPlatePicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.vehicleNumberPlatePicture.name}
                  </Typography>
                )}
                {validationErrors.vehicleNumberPlatePicture && (
                  <FormHelperText error>{validationErrors.vehicleNumberPlatePicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Vehicle Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'vehicleImages')}
                  />
                </Button>
                {imagesForm.vehicleImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.vehicleImages.length} image(s) selected
                  </Typography>
                )}
                {validationErrors.vehicleImages && (
                  <FormHelperText error>{validationErrors.vehicleImages}</FormHelperText>
                )}
              </Box>
            </Box>
          )}

          <Box mt={4} display="flex" justifyContent="space-between">
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            
            <Box>
              {activeStep < (steps.length - 1) ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  endIcon={<ArrowForward />}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting || (userCoins !== null && userCoins < 1)}
                  onClick={(e) => {
                    // Prevent the button from submitting the form directly
                    // as the form already has an onSubmit handler
                    e.preventDefault();
                    if (!isSubmitting) {
                      handleSubmit(e);
                    }
                  }}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Create Trip"
                  )}
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
} 