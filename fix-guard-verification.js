const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Update the Guard Verification Seal Tags table to properly display all information
// Improve the "Verified By" column to properly show the guard's name
let updates = 0;

// Fix the display of verifiedBy information
content = content.replace(
  /<TableCell>\s+{tag\.verifiedBy\s+\?\s+tag\.verifiedBy\.name\s+:\s+"N\/A"}\s+<\/TableCell>/g,
  `<TableCell>
                        <Typography variant="body2">
                          {tag?.verifiedBy ? tag.verifiedBy.name : "N/A"}
                        </Typography>
                      </TableCell>`
);
updates++;

// Fix the display of creation time
content = content.replace(
  /<TableCell>\s+{tag\.createdAt\s+\?\s+formatDate\(tag\.createdAt\)\s+:\s+"N\/A"}\s+<\/TableCell>/g,
  `<TableCell>
                        {tag?.createdAt ? formatDate(tag.createdAt) : "N/A"}
                      </TableCell>`
);
updates++;

// Add logic to updateSealComparison to properly handle the guard verification data
const updateSealComparisonFunctionCode = `
  // Update the seal comparison based on the current guard seals
  const updateSealComparison = useCallback((currentGuardSeals = guardScannedSeals) => {
    // Find matched seals (present in both lists)
    const matched = operatorSeals.filter(opSeal => 
      currentGuardSeals.some(guardSeal => 
        guardSeal.id.trim().toLowerCase() === opSeal.id.trim().toLowerCase()
      )
    ).map(seal => seal.id);
    
    // Find mismatched seals (guard scanned but not in operator list)
    const mismatched = currentGuardSeals.filter(guardSeal => 
      !operatorSeals.some(opSeal => 
        opSeal.id.trim().toLowerCase() === guardSeal.id.trim().toLowerCase()
      )
    ).map(seal => seal.id);
    
    // Find unverified seals (in operator list but not scanned by guard)
    const unverified = operatorSeals.filter(opSeal => 
      !currentGuardSeals.some(guardSeal => 
        guardSeal.id.trim().toLowerCase() === opSeal.id.trim().toLowerCase()
      )
    ).map(seal => seal.id);
    
    // Update the comparison state
    setSealComparison({
      matched,
      mismatched,
      unverified
    });
  }, [operatorSeals, guardScannedSeals]);
`;

// Check if updateSealComparison function already exists, if not add it
if (!content.includes('const updateSealComparison = useCallback')) {
  // Find a good place to insert the function (after fetchGuardSealTags)
  content = content.replace(
    /const fetchGuardSealTags = useCallback\(.*?\}\);/s,
    match => match + '\n\n' + updateSealComparisonFunctionCode
  );
  updates++;
}

// Add a useEffect to update the seal comparison when operator seals or guard scanned seals change
const updateSealComparisonEffectCode = `
  // Update seal comparison when operator seals or guard scanned seals change
  useEffect(() => {
    if (operatorSeals.length > 0 || guardScannedSeals.length > 0) {
      updateSealComparison();
    }
  }, [operatorSeals, guardScannedSeals, updateSealComparison]);
`;

// Check if the effect already exists, if not add it
if (!content.includes('useEffect(() => {\n    if (operatorSeals.length > 0 || guardScannedSeals.length > 0)')) {
  // Find a good place to insert the effect (after updateSealComparison)
  content = content.replace(
    /const updateSealComparison = useCallback\(.*?\}\);/s,
    match => match + '\n\n' + updateSealComparisonEffectCode
  );
  updates++;
}

// Fix the compressImage function to handle image compression better
const compressImageFunctionCode = `
  // Utility function to compress images
  const compressImage = async (base64Image, quality = 0.8) => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.src = base64Image;
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          
          // Calculate size - respect aspect ratio but limit max dimensions
          const MAX_SIZE = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to webp format for better compression if supported
          const mimeType = 'image/jpeg';
          
          // Get compressed base64
          const compressedBase64 = canvas.toDataURL(mimeType, quality);
          resolve(compressedBase64);
        };
        
        img.onerror = () => {
          reject(new Error('Error loading image for compression'));
        };
      } catch (error) {
        reject(error);
      }
    });
  };
`;

// Check if compressImage function already exists, if not add it
if (!content.includes('const compressImage = async')) {
  // Find a good place to insert the function (after formatDate)
  content = content.replace(
    /const formatDate = \(dateString: string\): string => {.*?\};/s,
    match => match + '\n\n' + compressImageFunctionCode
  );
  updates++;
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log(`Fixed ${updates} issues with guard seal tag verification in client.tsx`); 