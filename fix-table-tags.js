const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the double closing TableBody tag issue
content = content.replace(
  /<\/TableBody>\s*<\/TableBody>/g,
  '</TableBody>'
);

// Fix any unclosed TableCell in Box> area
content = content.replace(
  /<Box component="div">/g,
  '<Box>'
);

// Fix TableHead and TableRow tag nesting issues
content = content.replace(
  /<TableCell\$1>\$2<\/TableCell>/g,
  '<TableCell sx={{ color: \'primary.contrastText\' }}>#</TableCell>'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed table tags structure in client.tsx'); 