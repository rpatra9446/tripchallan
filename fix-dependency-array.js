const fs = require('fs');
const path = require('path');

// Path to the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');

console.log(`Reading file: ${filePath}`);
let content = fs.readFileSync(filePath, 'utf8');

// Find and fix the dependency array pattern (this is the main build error)
console.log('Looking for patterns to fix...');

// The specific pattern causing the build error mentioned in the logs
const dependencyArrayPattern = /}, \[guardScannedSeals, operatorSeals, sessionId, fetchGuardSealTags, updateSealComparison, toast\]\);/g;
if (dependencyArrayPattern.test(content)) {
  console.log('Found dependency array pattern.');
  content = content.replace(dependencyArrayPattern, '};');
  console.log('Fixed dependency array issue.');
}

// Fix handleScanComplete references
content = content.replace(/typeof handleScanComplete === 'function'/g, 
                        'typeof handleGuardScanComplete === \'function\'');
content = content.replace(/handleScanComplete\(trimmedData, 'digital', imageFile\)/g, 
                        'handleGuardScanComplete(trimmedData, \'digital\', imageFile)');
content = content.replace(/handleScanComplete\(scanInput, 'manual'\)/g, 
                        'handleGuardScanComplete(scanInput, \'manual\')');

// Fix any duplicate function declarations
const duplicateFunction = content.match(/const handleScanComplete[\s\S]*?}\);[\s\S]*?const handleGuardScanComplete/);
if (duplicateFunction) {
  console.log('Found duplicate function declaration. Removing the first instance...');
  const duplicateText = duplicateFunction[0];
  const replacement = 'const handleGuardScanComplete';
  content = content.replace(duplicateText, replacement);
}

// Fix useToast import issue
content = content.replace(/import toast, { useToast as useToastOriginal } from "react-hot-toast";/g, 
                         'import toast from "react-hot-toast";');

// Remove any custom useToast implementation if it exists
const useToastPattern = /const useToast[\s\S]*?};/;
if (useToastPattern.test(content)) {
  console.log('Found custom useToast implementation. Removing...');
  content = content.replace(useToastPattern, '');
}

// Write the changes back to the file
console.log('Writing changes back to file...');
fs.writeFileSync(filePath, content);
console.log('Fixes applied successfully!'); 