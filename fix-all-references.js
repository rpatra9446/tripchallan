const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find and fix all problematic Chip components where seal isn't defined
// This is a simpler, more direct approach

// The correct pattern for lines 1954-1959 in the operatorSeals.map context should use "seal"
// The correct pattern for lines 2259-2265 (outside map) should use a different variable

// Find and replace all Chip components where seal isn't defined with matchingSeal or item variable
// This searches for any Chip component where seal is used but doesn't exist in context
const problematicPattern = /<TableCell>\s*<Chip\s+label=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}\s+color=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}\s+size="small"\s*\/>\s*<\/TableCell>/g;

// Replace all occurrences with a version that uses 'item' instead of 'seal'
content = content.replace(problematicPattern, match => {
  return match.replace(/seal\.method/g, 'item.method');
});

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all variable references in client.tsx'); 