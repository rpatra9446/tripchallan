const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the helper function syntax
const badMethodFunction = `  // Helper function to display method consistently
  const getMethodDisplay = 
  (methodVar) => {
    if (!methodVar) return 'Unknown';
    if (typeof methodVar !== 'string') return 'Unknown';
    return methodVar.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned';
  }
;`;

const goodMethodFunction = `  // Helper function to display method consistently
  const getMethodDisplay = (methodVar: any): string => {
    if (!methodVar) return 'Unknown';
    if (typeof methodVar !== 'string') return 'Unknown';
    return methodVar.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned';
  };`;

content = content.replace(badMethodFunction, goodMethodFunction);

// Fix any remaining instances where the helper function is incorrectly formatted
content = content.replace(/getMethodDisplay\s*=\s*\n\s*\(/g, 'getMethodDisplay = (');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed helper function syntax in client.tsx'); 