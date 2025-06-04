const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Ensure consistent handling of optional chaining in JSX expressions
content = content.replace(/(\w+)\.(\w+) \? formatDate\(\1\.\2\) : "N\/A"/g, '$1?.$2 ? formatDate($1.$2) : "N/A"');

// Ensure consistent optional chaining on method property
content = content.replace(/(\w+)\.method([^?])/g, (match, p1, p2) => {
  // Don't add optional chaining to string literals in comparisons
  if (match.includes("'method'") || match.includes('"method"')) {
    return match;
  }
  return `${p1}?.method${p2}`;
});

// Ensure consistent handling of imageData property
content = content.replace(/(\w+)\.imageData([^?])/g, '$1?.imageData$2');

// Ensure consistent handling of id property in template literals
content = content.replace(/\`(\w+) \$\{([^.]+)\.id([^?}])/g, '`$1 ${$2?.id$3');

// Fix any double optional chaining that might have been introduced
content = content.replace(/\?\?\./g, '?.');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed consistency issues in client.tsx'); 