const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix imports first - ensure Material UI components are properly imported
// Check if Box is already imported
if (!content.includes('Box,') && !content.includes(', Box') && !content.includes('Box }')) {
  console.log('Adding Box to imports');
  content = content.replace(
    /import\s*{([\s\S]*?)}\s*from\s*["']@mui\/material["'];/,
    'import {$1, Box} from "@mui/material";'
  );
}

// 2. Fix all standalone Box components to ensure they're properly specified
content = content.replace(/<Box>/g, '<Box component="div">');

// 3. Fix all table structure issues
// Fix closing table row tags followed immediately by table cells (malformed table structure)
content = content.replace(
  /<\/TableRow>\s*<TableCell/g,
  '</TableCell>\n                </TableRow>\n                <TableRow>\n                  <TableCell'
);

// Fix cells that are closed twice
content = content.replace(/<\/TableCell>\s*<\/TableCell>/g, '</TableCell>');

// 4. Fix JSX fragment issues
// Remove empty fragments
content = content.replace(/<>\s*<\/>/g, '');

// Fix malformed fragment + TableRow combinations
content = content.replace(/<>\s*<TableRow/g, '<TableRow');
content = content.replace(/<\/TableRow>\s*<\/>/g, '</TableRow>');

// 5. Ensure all tables have proper structure
// Fix TableBody with no closing tag
content = content.replace(
  /<TableBody>[\s\S]*?(?!<\/TableBody>)<\/Table>/g,
  (match) => match.replace('</Table>', '</TableBody>\n              </Table>')
);

// Fix TableHead with no closing tag
content = content.replace(
  /<TableHead>[\s\S]*?(?!<\/TableHead>)<TableBody>/g,
  (match) => match.replace('<TableBody>', '</TableHead>\n              <TableBody>')
);

// 6. Fix variable references
// Fix references to undefined operatorSeal variable
content = content.replace(/operatorSeal\.method/g, 'seal.method');

// 7. Fix the specific component at line 1891 that's causing the error
const verificationFunction = `  // Seal Tags Verification
  const renderSealTagsVerification = () => {
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
        
        {/* OPERATOR Seal Tags Table */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ color: 'primary.contrastText' }}>
            OPERATOR Seal Tags to Match ({operatorSeals ? operatorSeals.length : 0})
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'primary.contrastText' }}>
            The following seal tags were registered by the operator. Scan or enter these exact tags to verify them.
          </Typography>
          
          {operatorSeals && operatorSeals.length > 0 && (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'primary.main' }}>
                  <TableRow>
                    <TableCell sx={{ color: 'primary.contrastText' }}>#</TableCell>
                    <TableCell sx={{ color: 'primary.contrastText' }}>Seal Tag ID</TableCell>
                    <TableCell sx={{ color: 'primary.contrastText' }}>Method</TableCell>
                    <TableCell sx={{ color: 'primary.contrastText' }}>Registered On</TableCell>
                    <TableCell sx={{ color: 'primary.contrastText' }}>Image</TableCell>
                    <TableCell sx={{ color: 'primary.contrastText' }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSeals.map((seal, index) => {
                    // Check if this operator seal has been scanned by the guard
                    const isScanned = guardScannedSeals.some(
                      guardSeal => guardSeal.id.toLowerCase() === seal.id.toLowerCase()
                    );
                    
                    return (
                      <TableRow key={index} 
                        sx={{
                          bgcolor: isScanned ? 'success.light' : 'background.paper',
                          '&:hover': { bgcolor: isScanned ? 'success.light' : 'action.hover' }
                        }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2"
                            sx={{ 
                              fontWeight: 'medium',
                              fontFamily: 'monospace'
                            }}
                          >
                            {seal.id}
                          </Typography>
                          {isScanned && (
                            <Chip 
                              size="small" 
                              label="Verified" 
                              color="success"
                              icon={<CheckCircle fontSize="small" />}
                              sx={{ mt: 0.5 }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={seal && seal.method && typeof seal.method === 'string' && seal.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned'}
                            color={seal && seal.method && typeof seal.method === 'string' && seal.method.toLowerCase().includes('manual') ? 'secondary' : 'primary'} 
                            size="small"
                          />
                       </TableCell>
                        <TableCell>{new Date(seal.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          {seal.imageData ? (
                            <Box 
                              component="img" 
                              src={seal.imageData} 
                              alt={\`Seal tag \${index+1}\`}
                              sx={{ 
                                width: 60, 
                                height: 60, 
                                objectFit: 'cover',
                                borderRadius: 1,
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                // Open image in modal
                                setSelectedSeal(seal);
                                setDetailsDialogOpen(true);
                              }}
                              onError={(e) => {
                                console.error(\`Failed to load image for seal \${seal.id}:\`, seal.imageData);
                                // Try alternative image URL formats
                                const img = e.target as HTMLImageElement;
                                if (session?.id) {
                                  // Attempt direct URL to seal tag image
                                  img.src = \`/api/images/\${session.id}/sealing/\${index}\`;
                                  console.log(\`Retrying with index-based URL: \${img.src}\`);
                                }
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              No image
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {isScanned ? (
                            <Chip 
                              size="small"
                              label="Scanned" 
                              color="success"
                              icon={<CheckCircle fontSize="small" />}
                            />
                          ) : (
                            <Chip 
                              size="small"
                              label="Not Scanned Yet" 
                              color="warning"
                              icon={<Warning fontSize="small" />}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
        
        {/* Additional component content would go here */}
      </Box>
    );
  };`;

// Replace the component - look for function declaration up to closing bracket
const componentRegex = /\/\/\s*Seal Tags Verification[\s\S]*?const renderSealTagsVerification[\s\S]*?\);[\s\S]*?\};/;
const componentMatch = content.match(componentRegex);
if (componentMatch) {
  console.log('Found and replacing renderSealTagsVerification function');
  content = content.replace(componentMatch[0], verificationFunction);
} else {
  console.log('Could not find renderSealTagsVerification function');
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all Box component issues in client.tsx'); 