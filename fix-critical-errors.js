const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let originalContent = fs.readFileSync(filePath, 'utf8');

// Focus on the JSX expressions must have one parent element error
// Specifically at line 1928 as reported in the error
let content = originalContent;

// Simplest approach: Directly fix the pattern at line 1928
// Look for specific patterns where TableRow is being returned without a parent element
content = content.replace(
  /(return\s*\(\s*)(<TableRow[^>]*>[\s\S]*?<\/TableRow>\s*)(\);)/g,
  '$1<>$2</>$3'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed critical JSX parent element errors in client.tsx'); 