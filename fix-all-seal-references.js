const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix mixed references where seal.method is used but then operatorSeal.method follows
content = content.replace(/label=\{seal\.method && typeof seal\.method === 'string' && operatorSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g, 
  "label={seal.method && typeof seal.method === 'string' && seal.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned'}"
);

content = content.replace(/color=\{seal\.method && typeof seal\.method === 'string' && operatorSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g, 
  "color={seal.method && typeof seal.method === 'string' && seal.method.toLowerCase().includes('manual') ? 'secondary' : 'primary'}"
);

// Fix any remaining operatorSeal references that should be seal
content = content.replace(/operatorSeal\.method/g, 'seal.method');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all variable references in client.tsx'); 