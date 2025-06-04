const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the Guard Verification Seal Tags table to better show verification status
// Find the table section in the code
const guardTableRegex = /{\s*session\.guardSealTags\s*&&\s*session\.guardSealTags\.length\s*>\s*0\s*&&\s*\(\s*<Box[^]*?Guard Verification Seal Tags[^]*?<\/TableContainer>\s*<\/Box>\s*\)\s*}/;
const guardTableSection = content.match(guardTableRegex);

if (guardTableSection) {
  let tableCode = guardTableSection[0];
  
  // 1. Improve the Status column to show match status
  tableCode = tableCode.replace(
    /<TableCell>\s*<Chip\s*size="small"\s*label=\{\s*tag\.status\s*\|\|\s*"VERIFIED"\s*\}\s*color="success"\s*\/>\s*<\/TableCell>/g,
    `<TableCell>
                      {/* Show verification status based on matching with operator seals */}
                      {operatorSeals.some(opSeal => opSeal.id.toLowerCase() === tag.barcode.toLowerCase()) ? (
                        <Chip 
                          size="small" 
                          label="Matched" 
                          color="success"
                          icon={<CheckCircle fontSize="small" />}
                        />
                      ) : (
                        <Chip 
                          size="small" 
                          label="Not Matched" 
                          color="error"
                          icon={<Cancel fontSize="small" />}
                        />
                      )}
                      </TableCell>`
  );
  
  // 2. Enhance the timestamp display
  tableCode = tableCode.replace(
    /{tag\?.createdAt \? formatDate\(tag\.createdAt\) : "N\/A"}/g,
    `{tag?.createdAt ? (
                          <Tooltip title={new Date(tag.createdAt).toLocaleString()}>
                            <Typography variant="body2">{formatDate(tag.createdAt)}</Typography>
                          </Tooltip>
                        ) : "N/A"}`
  );
  
  // 3. Improve the Tag ID display
  tableCode = tableCode.replace(
    /<Box\s*sx=\{\s*\{\s*border:\s*'1px solid',\s*borderColor:\s*'divider',\s*borderRadius:\s*1,\s*p:\s*0\.75,\s*bgcolor:\s*'background\.paper',\s*maxWidth:\s*180,\s*overflow:\s*'hidden'\s*\}\s*\}\s*>\s*<Typography\s*variant="body2"\s*sx=\{\s*\{\s*fontFamily:\s*'monospace',\s*fontSize:\s*'0\.9rem',\s*fontWeight:\s*'medium'\s*\}\s*\}>\s*{tag\.barcode}\s*<\/Typography>\s*<\/Box>/g,
    `<Box 
                          sx={{ 
                            border: '1px solid',
                            borderColor: operatorSeals.some(opSeal => opSeal.id.toLowerCase() === tag.barcode.toLowerCase()) 
                              ? 'success.main' 
                              : 'error.main',
                            borderRadius: 1,
                            p: 0.75,
                            bgcolor: 'background.paper',
                            maxWidth: 180,
                            overflow: 'hidden'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'medium' }}>
                            {tag.barcode}
                          </Typography>
                        </Box>`
  );
  
  // Replace the original table code with our improved version
  content = content.replace(guardTableRegex, tableCode);
  
  // 4. Add imports if needed
  if (!content.includes('import { CheckCircle, Cancel }')) {
    content = content.replace(
      /import {([^}]*)}/,
      (match, imports) => {
        // Add the icons if they're not already imported
        const needToAdd = [];
        if (!imports.includes('CheckCircle')) needToAdd.push('CheckCircle');
        if (!imports.includes('Cancel')) needToAdd.push('Cancel');
        
        return `import {${imports}${imports.trim() ? ', ' : ''}${needToAdd.join(', ')}}`;
      }
    );
  }
  
  // Write the fixed content back to the file
  fs.writeFileSync(filePath, content);
  console.log('Improved the Guard Verification Seal Tags table display');
} else {
  console.log('Could not find the Guard Verification Seal Tags table section in the file');
} 