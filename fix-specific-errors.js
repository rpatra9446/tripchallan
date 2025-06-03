const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix specific icon syntax errors
content = content.replace(
  /icon=\{seal\.verified \? <CheckCircle fontSize="small" \/> <\/TableCell>: <Warning fontSize="small" \/>\}/g,
  'icon={seal.verified ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}'
);

// 2. Fix any remaining table cell duplicate closings
content = content.replace(/<\/TableCell>\s*<\/TableCell>/g, '</TableCell>');

// 3. Fix multiple consecutive replacements errors
content = content.replace(/<\/TableCell>\s*<\/TableRow>\s*<\/TableRow>/g, '</TableCell></TableRow>');

// 4. Ensure JSX fragments are properly closed
content = content.replace(/<>\s*<TableCell>[\s\S]*?<\/TableCell>\s*<TableCell>[\s\S]*?<\/TableCell>\s*<TableCell>[\s\S]*?<\/TableCell>\s*(?!<\/>)/g, match => {
  return match + '</>';
});

// 5. Wrap conditional expressions in fragments where needed
content = content.replace(
  /(guardSeal \? \()([^<])/g,
  '$1<>$2'
);

content = content.replace(
  /(\) : \()([^<])/g,
  '$1<>$2'
);

// 6. Fix missing closing fragment tags
content = content.replace(
  /(<TableCell[^>]*>[^<]*<\/TableCell>\s*)(?!<\/TableCell>|<\/TableRow>|<\/>)(\))/g,
  '$1</>$2'
);

// 7. Fix the specific issue with the "JSX expressions must have one parent element" error
content = content.replace(
  /(return\s*\(\s*)<TableRow key=\{([^}]+)\}\s*sx=\{\{([^}]+)\}\}\s*>/g,
  '$1<><TableRow key={$2} sx={{$3}}>'
);

content = content.replace(
  /<\/TableRow>\s*\);/g,
  '</TableRow></>);'
);

// 8. Fix specific variable references for scanItem.method
content = content.replace(/scanItem\.method/g, 'seal.method');

// 9. Fix duplicate array closing bracket
content = content.replace(/const updatedSeals = \[\.\.\.(guardScannedSeals|scannedSeals), newSeal\]\];/g, 'const updatedSeals = [...$1, newSeal];');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed specific edge cases in client.tsx'); 