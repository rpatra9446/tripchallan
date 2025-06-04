/**
 * Image Utilities for handling image processing and compression
 */

/**
 * Resize and compress an image to ensure it's within size limits
 * @param file The original image file
 * @param maxWidth Maximum width in pixels (default: 800px)
 * @param maxHeight Maximum height in pixels (default: 800px)
 * @param quality JPEG quality from 0 to 1 (default: 0.6 = 60%)
 * @param maxSizeInMB Maximum size in MB (default: 2MB)
 * @returns A promise that resolves to the processed File
 */
export async function resizeAndCompressImage(
  file: File, 
  maxWidth = 800, 
  maxHeight = 800, 
  quality = 0.6,
  maxSizeInMB = 2
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Skip non-image files
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }
    
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
          
          // Check if the size is still too large
          if (blob.size > maxSizeInMB * 1024 * 1024) {
            // If still too large, try with lower quality and smaller dimensions
            if (quality > 0.3) {
              const newWidth = Math.round(width * 0.8);
              const newHeight = Math.round(height * 0.8);
              const newQuality = quality - 0.1;
              
              resizeAndCompressImage(file, newWidth, newHeight, newQuality, maxSizeInMB)
                .then(resolve)
                .catch(reject);
              return;
            }
          }
          
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

/**
 * Process multiple images, compressing each one
 * @param files Array of image files to process
 * @param maxFiles Maximum number of files to process (default: 10)
 * @param maxSizeInMB Maximum size in MB for each image
 * @returns Promise resolving to array of processed files
 */
export async function processMultipleImages(
  files: File[], 
  maxFiles = 10,
  maxSizeInMB = 2
): Promise<File[]> {
  // Limit the number of files
  const limitedFiles = files.slice(0, maxFiles);
  
  // Process each file
  return Promise.all(
    limitedFiles.map(file => resizeAndCompressImage(file, 800, 800, 0.6, maxSizeInMB))
  );
}

/**
 * Compress a base64 image string to reduce its size
 * @param base64Image The original base64 image string
 * @param quality JPEG quality from 0 to 1 (default: 0.6 = 60%)
 * @returns A promise that resolves to the compressed base64 image string
 */
export async function compressImage(
  base64Image: string,
  quality = 0.6
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Image;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Use original dimensions (no resizing)
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Get the compressed base64 string
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      
      resolve(compressedBase64);
    };
    
    img.onerror = (error) => {
      reject(error);
    };
  });
} 