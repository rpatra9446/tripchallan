const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix common variable reference issues
const fixes = [
  // Fix matchingSeal references
  { from: /matchingSeal\.method/g, to: 'scanItem.method' },
  // Fix incorrect seal references outside of mapping contexts
  { from: /seal\.method && typeof seal\.method/g, to: 'item && item.method && typeof item.method' },
  // Fix field references 
  { from: /field\.method/g, to: 'item.method' },
  // Fix imageUrl references with method property
  { from: /imageUrl\.method/g, to: 'item.method' },
  // Fix semicolon errors in array spread
  { from: /\[\.\.\.(guardScannedSeals|scannedSeals), ([^;]+);/g, to: '[...$1, $2];' },
  // Fix missing closing TableCell tags
  { from: /<TableCell>\s*<Chip[\s\S]+?\/>\s*(?!<\/TableCell>)/g, to: match => match + '</TableCell>' }
];

// Apply all fixes
for (const fix of fixes) {
  content = content.replace(fix.from, fix.to);
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all variable reference issues in client.tsx'); 