const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// First approach: Find the renderVerificationResults function context
// and replace incorrect seal references within map functions
const verificationResultsSection = content.match(/const\s+renderVerificationResults\s*=\s*\(\)\s*=>\s*\{[\s\S]+?\};/);

if (verificationResultsSection) {
  const verificationCode = verificationResultsSection[0];
  // Look for map functions where there's a potential reference to 'seal' without proper context
  const fixedVerificationCode = verificationCode.replace(
    /(\{[\w\.]+\.map\(\((\w+),\s*\w+\)\s*=>\s*\{[\s\S]+?)seal\.method/g,
    (match, prefix, itemVar) => {
      return prefix + itemVar + '.method';
    }
  );
  
  content = content.replace(verificationCode, fixedVerificationCode);
}

// Second approach: Directly target all instances where seal.method is used in Chip components
// Find all mapping functions and ensure they use the correct variable
content = content.replace(
  /\{([^}]+)\.map\(\(([^,]+)[^}]+\)\s*=>\s*\([\s\S]+?<Chip\s+label=\{seal\.method/g,
  (match, arrayName, itemName) => {
    return match.replace(/seal\.method/g, `${itemName}.method`);
  }
);

// Third approach: Fix any remaining direct references to 'seal'
content = content.replace(
  /<Chip\s+label=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}\s+color=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}\s+size="small"\s*\/>/g,
  (match) => {
    // Replace with contextual variable - need to infer from surrounding code
    // Use matchingSeal as a fallback
    return match.replace(/seal\.method/g, 'matchingSeal.method');
  }
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed seal references in GUARD verification page'); 