const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Check specific sections for incorrect variable references
// Each context needs appropriate variable references

// Pattern 1: Inside renderSealVerification function (lines ~2260-2265)
content = content.replace(
  /(<TableCell>\s*<Chip\s*label=\{)seal(\.method && typeof )seal(\.method === 'string' && )seal(\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}\s*color=\{)seal(\.method && typeof )seal(\.method === 'string' && )seal(\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}\s*size="small"\s*\/>\s*<\/TableCell>)/g,
  (match, prefix, mid1, mid2, mid3, mid4, mid5, mid6) => {
    // Replace with the variable in this context
    return `${prefix}matchingSeal${mid1}matchingSeal${mid2}matchingSeal${mid3}matchingSeal${mid4}matchingSeal${mid5}matchingSeal${mid6}`;
  }
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed variable references in client.tsx'); 