const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix array syntax errors
content = content.replace(
  /const updatedSeals = \[\.\.\.(guardScannedSeals|scannedSeals), newSeal\]\];/g,
  'const updatedSeals = [...$1, newSeal];'
);

// Fix duplicate closing tags
content = content.replace(
  /<\/TableCell>\s*<\/TableCell>/g,
  '</TableCell>'
);

// Fix undefined variable references
const varReplacements = [
  // Replace 'item' with 'seal' in the operator seal mapping context
  { from: /label=\{item && item\.method && typeof item\.method === 'string' && seal\.method/g, to: 'label={seal && seal.method && typeof seal.method === \'string\' && seal.method' },
  { from: /color=\{item && item\.method && typeof item\.method === 'string' && seal\.method/g, to: 'color={seal && seal.method && typeof seal.method === \'string\' && seal.method' },
  
  // Replace 'scanItem' with the appropriate variable in context
  { from: /label=\{scanItem\.method && typeof scanItem\.method === 'string' && scanItem\.method/g, to: 'label={seal.method && typeof seal.method === \'string\' && seal.method' },
  { from: /color=\{scanItem\.method && typeof scanItem\.method === 'string' && scanItem\.method/g, to: 'color={seal.method && typeof seal.method === \'string\' && seal.method' },
  
  // For guards context, make it guardSeal
  { from: /label=\{guardSeal\.method && typeof seal\.method/g, to: 'label={guardSeal.method && typeof guardSeal.method' },
  { from: /color=\{guardSeal\.method && typeof seal\.method/g, to: 'color={guardSeal.method && typeof guardSeal.method' },
];

for (const replacement of varReplacements) {
  content = content.replace(replacement.from, replacement.to);
}

// Fix mismatched JSX tags - ensure TableRows have proper closing tags
content = content.replace(
  /(<TableRow[^>]*>[\s\S]*?)(?!<\/TableRow>)([\s\S]*?<\/TableCell>\s*<\/TableCell>)/g,
  '$1$2</TableRow>'
);

// Fix JSX expressions must have one parent element by wrapping with fragments
content = content.replace(
  /(return\s*\(\s*)(<TableRow[^>]*>)/g,
  '$1<>$2'
);

content = content.replace(
  /(<\/TableRow>\s*)(\);)/g,
  '$1</>$2'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all errors in client.tsx'); 