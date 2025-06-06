'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, IconButton, Alert, Box } from '@mui/material';
import { Close, Cameraswitch } from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';

// Add console log for debugging purposes
console.log('ClientSideQrScanner component loaded');

interface ClientSideQrScannerProps {
  /**
   * Callback function when a QR code is scanned
   */
  onScan?: (data: string) => void;
  
  /**
   * Callback function when a QR code is scanned with image
   */
  onScanWithImage?: (data: string, imageFile: File) => void;
  
  /**
   * Text to display on the scan button
   */
  buttonText?: string;
  
  /**
   * Dialog title for the QR scanner modal
   */
  scannerTitle?: string;
  
  /**
   * Variant for the scan button
   */
  buttonVariant?: 'text' | 'outlined' | 'contained';
}

/**
 * ClientSideQrScanner - A wrapper component that provides a button to open the QR scanner
 * and handles the client-side import of the actual scanner component.
 */
const ClientSideQrScanner: React.FC<ClientSideQrScannerProps> = ({
  onScan,
  onScanWithImage,
  buttonText = 'Scan QR Code',
  scannerTitle = 'Scan QR/Barcode',
  buttonVariant = 'contained',
}) => {
  const [open, setOpen] = useState(false);
  
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  
  const handleScan = useCallback((data: string) => {
    if (onScan) onScan(data);
    setOpen(false);
  }, [onScan]);

  const handleScanWithImage = useCallback((data: string, imageFile: File) => {
    if (onScanWithImage) onScanWithImage(data, imageFile);
    setOpen(false);
  }, [onScanWithImage]);

  // Check for camera permissions before opening scanner
  const handleOpenScanner = useCallback(async () => {
    try {
      // Try to get camera permissions
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Clean up the stream
      stream.getTracks().forEach(track => track.stop());
      // If we get here, permission was granted
      setOpen(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Camera access is required for scanning. Please grant camera permissions and try again.');
    }
  }, []);

  return (
    <>
      <Button 
        variant={buttonVariant} 
        onClick={handleOpenScanner}
        fullWidth
        sx={{ height: '56px' }}
      >
        {buttonText}
      </Button>
      
      {open && (
        <Dialog
          open={open}
          onClose={handleClose}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            {scannerTitle}
            <IconButton
              aria-label="close"
              onClick={handleClose}
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
              }}
            >
              <Close />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <QrScannerContent 
              onScan={onScan ? handleScan : undefined}
              onScanWithImage={onScanWithImage ? handleScanWithImage : undefined}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

interface QrScannerContentProps {
  onScan?: (data: string) => void;
  onScanWithImage?: (data: string, imageFile: File) => void;
}

const QrScannerContent: React.FC<QrScannerContentProps> = ({
  onScan,
  onScanWithImage
}) => {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastScannedRef = useRef<{ text: string; timestamp: number } | null>(null);
  const scannerContainerId = "html5-qrcode-scanner";
  
  React.useEffect(() => {
    let scanner: any = null;
    
    const initScanner = async () => {
      try {
        console.log('Initializing QR scanner...');
        setError(null);
        
        if (!Html5Qrcode) {
          console.error('Html5Qrcode is not defined. Library may not be loaded correctly.');
          setError('QR scanner library failed to load. Please try refreshing the page.');
          return;
        }
        
        if (!scanner) {
          console.log('Creating new Html5Qrcode instance...');
          scanner = new Html5Qrcode(scannerContainerId);
          scannerRef.current = scanner;
        }
        
        // Get all available cameras
        console.log('Requesting camera permissions...');
        const devices = await Html5Qrcode.getCameras();
        console.log('Available cameras:', devices);
        
        if (devices && devices.length) {
          // Sort cameras to prioritize rear/back cameras
          const sortedDevices = sortCamerasByFacingMode(devices);
          setCameras(sortedDevices);
          
          // Start with the first camera (should be a rear camera if available)
          if (sortedDevices.length > 0) {
            const cameraId = sortedDevices[0].id;
            startScanner(scanner, cameraId);
          } else {
            setError("No suitable camera found. Please make sure your camera is connected and you've granted permission to use it.");
          }
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setError("Failed to initialize scanner. Please make sure you've granted camera permissions and try again.");
      }
    };
    
    const sortCamerasByFacingMode = (cameras: Array<{ id: string; label: string }>) => {
      return cameras.sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        
        // Check for common keywords used in camera labels
        const aIsRear = 
          aLabel.includes('back') || 
          aLabel.includes('rear') || 
          aLabel.includes('environment');
        
        const bIsRear = 
          bLabel.includes('back') || 
          bLabel.includes('rear') || 
          bLabel.includes('environment');
        
        if (aIsRear && !bIsRear) return -1; // a is rear, b is not - a comes first
        if (!aIsRear && bIsRear) return 1;  // b is rear, a is not - b comes first
        return 0; // both are the same type
      });
    };
    
    const startScanner = async (scanner: any, cameraId: string) => {
      try {
        console.log(`Starting scanner with camera ID: ${cameraId}`);
        setIsScanning(true);
        
        if (!scanner) {
          console.error('Scanner instance is null or undefined');
          setError('Scanner initialization failed. Please refresh and try again.');
          setIsScanning(false);
          return;
        }
        
        await scanner.start(
          cameraId, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText: string) => {
            console.log('QR code scanned:', decodedText);
            
            // Add debounce logic to prevent multiple scans in quick succession
            const now = Date.now();
            const lastScanned = lastScannedRef.current;
            
            // If same code was scanned in the last 3 seconds, ignore it
            if (lastScanned && 
                lastScanned.text === decodedText && 
                now - lastScanned.timestamp < 3000) {
              console.log('Ignoring duplicate scan within debounce period');
              return;
            }
            
            // Update the last scanned reference
            lastScannedRef.current = { text: decodedText, timestamp: now };
            
            // Capture the image from the video feed
            if (onScanWithImage) {
              captureFrame(decodedText);
            } else if (onScan) {
              onScan(decodedText);
            }
          },
          () => {}
        );

        console.log('Scanner started successfully');

        // Get reference to the video element created by the scanner
        setTimeout(() => {
          const videoElement = document.querySelector('#' + scannerContainerId + ' video') as HTMLVideoElement;
          if (videoElement) {
            console.log('Video element found');
            videoRef.current = videoElement;
          } else {
            console.warn('Video element not found');
          }
        }, 1000); // Give the scanner time to set up the video
      } catch (err) {
        console.error('Error starting scanner:', err);
        setError("Failed to start scanner. Please try again or use a different browser.");
        setIsScanning(false);
      }
    };

    // Function to capture a frame from the video as an image
    const captureFrame = async (decodedText: string) => {
      try {
        console.log('Attempting to capture frame from video...');
        if (!videoRef.current) {
          // Try to find the video element if not already set
          console.log('Video ref not set, looking for video element...');
          const videoElement = document.querySelector('#' + scannerContainerId + ' video') as HTMLVideoElement;
          if (!videoElement) {
            console.error('Video element not found for frame capture');
            if (onScan) {
              console.log('Falling back to onScan without image');
              onScan(decodedText);
            }
            return;
          }
          videoRef.current = videoElement;
        }

        // Create a canvas element if it doesn't exist
        if (!canvasRef.current) {
          console.log('Creating canvas for frame capture');
          const canvas = document.createElement('canvas');
          canvasRef.current = canvas;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Make sure video is ready
        if (video.readyState !== video.HAVE_ENOUGH_DATA) {
          console.log('Video not ready yet, waiting for data...');
          // Wait a moment and try again
          setTimeout(() => captureFrame(decodedText), 100);
          return;
        }
        
        // Set canvas dimensions to match video but reduce size to improve performance
        // Use smaller dimensions for better performance and reduced file size
        const scaleFactor = 0.8; // 80% of original size
        canvas.width = video.videoWidth * scaleFactor;
        canvas.height = video.videoHeight * scaleFactor;
        console.log(`Canvas dimensions set to ${canvas.width}x${canvas.height}`);
        
        // Draw the current video frame to the canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Clear canvas first
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw video frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob with reduced quality for smaller file size
          canvas.toBlob((blob) => {
            if (blob && onScanWithImage) {
              // Create a file from the blob
              const imageFile = new File([blob], `qr-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
              console.log('Image captured successfully, size:', blob.size);
              
              // Call the callback with the decoded text and image file
              onScanWithImage(decodedText, imageFile);
            } else if (onScan) {
              console.log('No blob created or onScanWithImage not provided, falling back to onScan');
              onScan(decodedText);
            }
          }, 'image/jpeg', 0.6); // Use 60% JPEG quality for better compression
        } else if (onScan) {
          console.error('Could not get canvas context');
          onScan(decodedText);
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
        if (onScan) {
          console.log('Error in frame capture, falling back to onScan');
          onScan(decodedText);
        }
      }
    };
    
    // Initialize scanner
    const timer = setTimeout(() => {
      initScanner();
    }, 300);
    
    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch((err: any) => {
            console.warn('Error stopping scanner:', err);
          });
        } catch (err) {
          console.warn('Error stopping scanner:', err);
        }
      }
    };
  }, [onScan, onScanWithImage]);
  
  const handleRetry = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch((err: any) => {
          console.warn('Error stopping scanner:', err);
        });
        scannerRef.current = null;
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    
    setTimeout(() => {
      setError(null);
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          const sortedDevices = devices.sort((a, b) => {
            const aLabel = a.label.toLowerCase();
            const bLabel = b.label.toLowerCase();
            
            const aIsRear = 
              aLabel.includes('back') || 
              aLabel.includes('rear') || 
              aLabel.includes('environment');
            
            const bIsRear = 
              bLabel.includes('back') || 
              bLabel.includes('rear') || 
              bLabel.includes('environment');
            
            if (aIsRear && !bIsRear) return -1;
            if (!aIsRear && bIsRear) return 1;
            return 0;
          });
          
          setCameras(sortedDevices);
          const cameraId = sortedDevices[0].id;
          
          scanner.start(
            cameraId, 
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText: string) => {
              if (onScanWithImage) {
                captureFrame(decodedText);
              } else if (onScan) {
                onScan(decodedText);
              }
            },
            () => {}
          ).catch(err => {
            console.error('Error starting scanner:', err);
            setError("Failed to start scanner. Please try again.");
          });
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      }).catch(err => {
        console.error('Error getting cameras:', err);
        setError("Could not access cameras. Please ensure camera permissions are granted.");
      });
    }, 300);
  };
  
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    
    try {
      // Stop current scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (err) {
          console.warn('Error stopping scanner during camera switch:', err);
        }
      }
      
      // Switch to next camera
      const nextCameraIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextCameraIndex);
      
      // Create a new scanner instance for reliability
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      // Start scanner with new camera
      await scanner.start(
        cameras[nextCameraIndex].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText: string) => {
          if (onScanWithImage) {
            captureFrame(decodedText);
          } else if (onScan) {
            onScan(decodedText);
          }
        },
        () => {}
      );
    } catch (err) {
      console.error('Error switching camera:', err);
      setError("Failed to switch camera. Please try again.");
      handleRetry();
    }
  };

  // Function to capture a frame from video
  const captureFrame = async (decodedText: string) => {
    try {
      console.log('Attempting to capture frame from video...');
      if (!videoRef.current) {
        // Try to find the video element if not already set
        console.log('Video ref not set, looking for video element...');
        const videoElement = document.querySelector('#' + scannerContainerId + ' video') as HTMLVideoElement;
        if (!videoElement) {
          console.error('Video element not found for frame capture');
          if (onScan) {
            console.log('Falling back to onScan without image');
            onScan(decodedText);
          }
          return;
        }
        videoRef.current = videoElement;
      }

      // Create a canvas element if it doesn't exist
      if (!canvasRef.current) {
        console.log('Creating canvas for frame capture');
        const canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Make sure video is ready
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.log('Video not ready yet, waiting for data...');
        // Wait a moment and try again
        setTimeout(() => captureFrame(decodedText), 100);
        return;
      }
      
      // Set canvas dimensions to match video but reduce size to improve performance
      const scaleFactor = 0.8; // 80% of original size
      canvas.width = video.videoWidth * scaleFactor;
      canvas.height = video.videoHeight * scaleFactor;
      console.log(`Canvas dimensions set to ${canvas.width}x${canvas.height}`);
      
      // Draw the current video frame to the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Clear canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob with reduced quality for smaller file size
        canvas.toBlob((blob) => {
          if (blob && onScanWithImage) {
            // Create a file from the blob
            const imageFile = new File([blob], `qr-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
            console.log('Image captured successfully, size:', blob.size);
            
            // Call the callback with the decoded text and image file
            onScanWithImage(decodedText, imageFile);
          } else if (onScan) {
            console.log('No blob created or onScanWithImage not provided, falling back to onScan');
            onScan(decodedText);
          }
        }, 'image/jpeg', 0.6); // Use 60% JPEG quality for better compression
      } else if (onScan) {
        console.error('Could not get canvas context');
        onScan(decodedText);
      }
    } catch (error) {
      console.error('Error capturing frame:', error);
      if (onScan) {
        console.log('Error in frame capture, falling back to onScan');
        onScan(decodedText);
      }
    }
  };
  
  return (
    <>
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Try again
            </Button>
          }
        >
          {error}
        </Alert>
      )}
      
      <Box 
        id={scannerContainerId} 
        sx={{ 
          width: '100%', 
          height: 300,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid #ddd',
          borderRadius: 1,
          position: 'relative',
          overflow: 'hidden'
        }}
      />
      
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Position the QR code in the center of the frame
        </Typography>
        <Typography variant="caption" color="text.secondary">
          For best results, ensure good lighting and hold the device steady
        </Typography>
      </Box>
      
      {cameras.length > 1 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Button 
            startIcon={<Cameraswitch />} 
            onClick={handleSwitchCamera}
            variant="outlined"
            size="small"
          >
            Switch Camera
          </Button>
        </Box>
      )}
    </>
  );
};

export default ClientSideQrScanner; 