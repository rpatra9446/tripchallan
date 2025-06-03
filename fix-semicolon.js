const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error with semicolon instead of comma
content = content.replace(
  /const updatedSeals = \[\.\.\.(guardScannedSeals|scannedSeals), newSeal;/g,
  'const updatedSeals = [...$1, newSeal];'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed syntax error with semicolon instead of comma at line 2084'); 