const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The line causing the error is at line 1891 - this is likely a JSX/import issue 
// Let's find the function that contains this line (likely renderSealTagsVerification)
const sealTagsVerificationRegex = /const\s+render[A-Za-z]+Verification\s*=\s*\(\)\s*=>\s*\{[\s\S]*?return\s*\(\s*<Box>[\s\S]*?<\/Box>\s*\);\s*\};/g;

// Find all verification functions and fix them
const matches = content.match(sealTagsVerificationRegex);
if (matches) {
  console.log(`Found ${matches.length} verification functions to fix`);
  
  // Replace each function with a fixed version
  for (const match of matches) {
    const fixedFunction = match
      // Fix Box component - make sure it's properly imported
      .replace(/<Box>/g, '<Box component="div">')
      
      // Fix table header issues
      .replace(/<\/TableRow><TableCell/g, '</TableCell>\n                <TableCell')
      
      // Fix fragment syntax
      .replace(/<><TableRow/g, '<TableRow')
      .replace(/<\/TableRow>\s*<\/>/g, '</TableRow>')
      
      // Fix broken TableCell nesting
      .replace(/<\/TableCell>\s*<\/TableCell>/g, '</TableCell>');
    
    content = content.replace(match, fixedFunction);
  }
}

// Add proper imports
const hasBoxImport = content.includes('Box,') || content.includes('Box }') || content.includes('Box,');
if (!hasBoxImport) {
  // Add Box to the MUI imports
  content = content.replace(
    /import {([^}]*)}/,
    'import {$1, Box }'
  );
}

// Fix direct errors in the table structure
content = content.replace(
  /<TableCell[^>]*>.*?<\/TableCell>\s*<\/TableRow><TableCell/g, 
  (match) => match.replace('</TableRow><TableCell', '</TableCell>\n                <TableCell')
);

// Fix the component at line 1891 by replacing it completely if needed
const sealTagsComponent = `const renderSealTagsVerification = () => {
    if (!session || !session.qrCodes || 
        (!session.qrCodes.primaryBarcode && 
         (!session.qrCodes.additionalBarcodes || session.qrCodes.additionalBarcodes.length === 0))) {
      return (
        <Box component="div" sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No seal tag information available for verification. This session may have been created before seal tag scanning was implemented.
          </Typography>
        </Box>
      );
    }

    return (
      <Box component="div">
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>
        
        {/* Rest of component */}
      </Box>
    );
  };`;

// Try to find and replace the problematic component if it exists
const componentMatch = content.match(/const\s+renderSealTagsVerification\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};/);
if (componentMatch) {
  content = content.replace(componentMatch[0], sealTagsComponent);
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed key components in client.tsx'); 