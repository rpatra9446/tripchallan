const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Check if Box is properly imported
if (!content.includes("import { Box } from '@mui/material'") && 
    !content.includes("import { Box,") && 
    !content.match(/import\s*{[^}]*Box[^}]*}\s*from\s*['"]@mui\/material['"]/)) {
  // Add Box to the imports if missing
  content = content.replace(
    /import\s*{([^}]*)}\s*from\s*['"]@mui\/material['"];/,
    'import { $1, Box } from "@mui/material";'
  );
}

// Fix the JSX component nesting around line 1891
// Find the problematic component that starts with <Box> around line 1891
const boxComponentRegex = /return\s*\(\s*<Box>\s*<Typography[^>]*>[^<]*<\/Typography>/g;
const hasBoxComponentIssue = boxComponentRegex.test(content);

if (hasBoxComponentIssue) {
  console.log("Found Box component issue, fixing...");
  
  // Fix all TableHead/TableRow issues
  content = content.replace(
    /<TableCell[^>]*>[^<]*<\/TableCell>\s*<\/TableRow><TableCell/g,
    '<TableCell$1>$2</TableCell>\n                <TableCell'
  );
  
  // Fix JSX fragment nesting
  content = content.replace(
    /<><TableRow/g,
    '<TableRow'
  );
  
  content = content.replace(
    /<\/TableRow>\s*<\/>/g,
    '</TableRow>'
  );
  
  // Fix operatorSeal reference issues
  content = content.replace(
    /operatorSeal\.method/g,
    'seal.method'
  );
}

// Fix issues with table components around line 1920
content = content.replace(
  /<TableHead[^>]*>\s*<TableRow[^>]*>[\s\S]*?<\/TableRow>\s*<\/TableHead>/g,
  (match) => {
    // Fix any bad nesting in TableHead
    return match.replace(/<\/TableRow><TableCell/g, '</TableCell>\n                <TableCell');
  }
);

// Remove malformed fragment closing tags
content = content.replace(/<\/><TableCell/g, '</TableCell>\n                <TableCell');

// Make sure every <TableRow> has a matching </TableRow>
content = content.replace(/<TableRow([^>]*)>[\s\S]*?(?!<\/TableRow>)<\/TableCell>\s*<\/TableCell>/g, 
  (match) => match + '</TableRow>'
);

// Make sure table cells are properly formatted
content = content.replace(
  /<\/TableCell>\s*<\/TableCell>/g,
  '</TableCell>'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed more JSX syntax issues in client.tsx'); 