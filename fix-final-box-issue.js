const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. First, make sure Box is explicitly imported at the top of the file
if (!content.includes('Box,') && !content.includes(', Box') && !content.includes('Box }')) {
  // Add Box to Material UI imports
  content = content.replace(
    /import\s*{([^}]*)}\s*from\s*["']@mui\/material["'];/,
    (match, p1) => {
      return `import { ${p1.trim()}, Box } from "@mui/material";`;
    }
  );
  console.log('Added Box to MUI imports');
}

// 2. Find all bare Box components and add component="div" to them
const boxMatches = content.match(/<Box(?!\s+component=)/g) || [];
if (boxMatches.length > 0) {
  console.log(`Found ${boxMatches.length} Box components without component prop`);
  
  // Replace all instances of <Box> with <Box component="div">
  content = content.replace(
    /<Box(?!\s+component=)(\s+[^>]*)?>/g, 
    '<Box component="div"$1>'
  );
}

// 3. Fix any TypeScript/JSX template strings or expressions 
// that might be causing parsing issues in Box components
const boxTemplateMatches = content.match(/<Box[^>]*>\s*\{`/g) || [];
if (boxTemplateMatches.length > 0) {
  console.log(`Found ${boxTemplateMatches.length} Box components with template literals`);
  
  // Ensure proper JSX in template literals
  content = content.replace(
    /(<Box[^>]*>)\s*\{`([^`]*)`\}/g,
    (match, boxOpen, templateContent) => {
      return `${boxOpen}${templateContent}`;
    }
  );
}

// 4. Make sure all Box components have closing tags
// Find potential unclosed Box tags
content = content.replace(
  /<Box[^>]*>(?!\s*<\/Box>)[\s\S]*?(?=<\/)/g,
  (match) => {
    if (!match.includes('</Box>') && !match.endsWith('</')) {
      return match + '</Box>';
    }
    return match;
  }
);

// 5. Replace any Box components in renderVerification functions with Paper
// as a backup approach
content = content.replace(
  /(const\s+render[A-Za-z]+Verification\s*=\s*\(\)\s*=>\s*\{[\s\S]*?return\s*\()(\s*)<Box/g,
  '$1$2<Paper variant="outlined"'
);

content = content.replace(
  /(const\s+render[A-Za-z]+Verification[\s\S]*?return[\s\S]*?)<\/Box>(\s*\);[\s\S]*?\};)/g,
  '$1</Paper>$2'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all remaining Box component issues in client.tsx'); 