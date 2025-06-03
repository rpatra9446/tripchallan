const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix all "item.method" references in the operatorSeals.map context to use "seal.method" instead
const mapPattern = /\{operatorSeals\.map\(\(seal,\s*index\)\s*=>\s*\([\s\S]+?item\.method/g;
content = content.replace(mapPattern, match => {
  return match.replace(/item\.method/g, 'seal.method');
});

// Fix all remaining instances of item.method
content = content.replace(/item\.method/g, 'seal.method');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all variable references in client.tsx'); 