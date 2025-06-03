const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The pattern to look for - all instances of hardcoded "Digitally Scanned" label
const pattern = /label="Digitally Scanned"\s+color="primary"/g;

// The replacement that uses the seal.method property
const replacement = 'label={seal.method && typeof seal.method === \'string\' && seal.method.toLowerCase().includes(\'manual\') ? \'Manually Entered\' : \'Digitally Scanned\'}\n                          color={seal.method && typeof seal.method === \'string\' && seal.method.toLowerCase().includes(\'manual\') ? \'secondary\' : \'primary\'}';

// Count replacements
let replacementCount = 0;

// Replace the pattern
content = content.replace(pattern, (match) => {
  replacementCount++;
  return replacement;
});

// Save the file if changes were made
if (replacementCount > 0) {
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${replacementCount} instances of hardcoded "Digitally Scanned" in ${filePath}`);
} else {
  console.log('No matching patterns found. No changes made.');
} 