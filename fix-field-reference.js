const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error with the field.method reference
content = content.replace(
  /label=\{field\.method && typeof seal\.method/g,
  'label={seal.method && typeof seal.method'
);

// Check for any similar issues in the file
content = content.replace(
  /field\.method/g,
  'seal.method'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed field.method reference in Chip component'); 