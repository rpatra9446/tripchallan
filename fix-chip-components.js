const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix mixed references in operatorSeal context
content = content.replace(
  /label=\{operatorSeal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g,
  "label={operatorSeal.method && typeof operatorSeal.method === 'string' && operatorSeal.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned'}"
);

// Fix color attribute in the same components
content = content.replace(
  /color=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g,
  "color={operatorSeal.method && typeof operatorSeal.method === 'string' && operatorSeal.method.toLowerCase().includes('manual') ? 'secondary' : 'primary'}"
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed mixed variable references in Chip components'); 