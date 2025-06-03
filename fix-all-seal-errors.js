const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find all code blocks where we are in a mapping function and use the item variable name correctly
const mapRegex = /\{([\w\.]+)\.map\(\(([\w]+),\s*[\w]+\)\s*=>\s*\([\s\S]+?<\/TableRow>\s*\)\s*\}\)/g;
let match;
while ((match = mapRegex.exec(content)) !== null) {
  const [fullMatch, arrayName, itemName] = match;
  
  // Replace any remaining incorrect references to seal.method within this map block
  const fixedBlock = fullMatch.replace(/seal\.method/g, `${itemName}.method`);
  content = content.replace(fullMatch, fixedBlock);
}

// Fix direct references in the verification results section
const resultsSection = content.match(/const\s+renderVerificationResults\s*=\s*\(\)\s*=>\s*\{[\s\S]+?\};/);
if (resultsSection) {
  const originalSection = resultsSection[0];
  let fixedSection = originalSection;
  
  // Look for standalone Chip components using seal without context
  const chipPattern = /<Chip\s+label=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}\s+color=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}\s+size="small"\s*\/>/g;
  
  fixedSection = fixedSection.replace(chipPattern, (chipMatch) => {
    // Replace with the correct contextual variable
    return chipMatch.replace(/seal\.method/g, 'scanItem.method');
  });
  
  content = content.replace(originalSection, fixedSection);
}

// Fix any remaining standalone instances
content = content.replace(
  /<Chip\s+label=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}\s+color=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}\s+size="small"\s*\/>/g,
  '<Chip label={matchingSeal && matchingSeal.method && typeof matchingSeal.method === \'string\' && matchingSeal.method.toLowerCase().includes(\'manual\') ? \'Manually Entered\' : \'Digitally Scanned\'} color={matchingSeal && matchingSeal.method && typeof matchingSeal.method === \'string\' && matchingSeal.method.toLowerCase().includes(\'manual\') ? \'secondary\' : \'primary\'} size="small" />'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all seal reference errors in client.tsx'); 