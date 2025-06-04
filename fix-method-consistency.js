const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Standardize all method displays to a consistent format
const standardMethodDisplay = `
  (methodVar) => {
    if (!methodVar) return 'Unknown';
    if (typeof methodVar !== 'string') return 'Unknown';
    return methodVar.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned';
  }
`;

// Add the helper function at the beginning of the component
const functionInsertPoint = 'export default function SessionDetailClient({ sessionId }: { sessionId: string }) {';
const withHelperFunction = `export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  // Helper function to display method consistently
  const getMethodDisplay = ${standardMethodDisplay};
  const getMethodColor = (methodVar: any) => {
    if (!methodVar) return 'default';
    if (typeof methodVar !== 'string') return 'default';
    return methodVar.toLowerCase().includes('manual') ? 'secondary' : 'primary';
  };
`;

content = content.replace(functionInsertPoint, withHelperFunction);

// Replace complex inline logic with helper function calls
// For operator seals
content = content.replace(
  /label=\{operatorSeal\.method && typeof operatorSeal\.method === 'string' && operatorSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g,
  'label={getMethodDisplay(operatorSeal.method)}'
);

content = content.replace(
  /color=\{operatorSeal\.method && typeof operatorSeal\.method === 'string' && operatorSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g,
  'color={getMethodColor(operatorSeal.method)}'
);

// For guard seals
content = content.replace(
  /label=\{guardSeal\.method && typeof guardSeal\.method === 'string' && guardSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g,
  'label={getMethodDisplay(guardSeal.method)}'
);

content = content.replace(
  /color=\{guardSeal\.method && typeof guardSeal\.method === 'string' && guardSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g,
  'color={getMethodColor(guardSeal.method)}'
);

// For standalone seal displays
content = content.replace(
  /label=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g,
  'label={getMethodDisplay(seal.method)}'
);

content = content.replace(
  /color=\{seal\.method && typeof seal\.method === 'string' && seal\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g,
  'color={getMethodColor(seal.method)}'
);

// Fix for tag.method (in the guard seals section)
content = content.replace(
  /label=\{tag\.method && typeof tag\.method === 'string' && tag\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g,
  'label={getMethodDisplay(tag.method)}'
);

content = content.replace(
  /color=\{tag\.method && typeof tag\.method === 'string' && tag\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g,
  'color={getMethodColor(tag.method)}'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed method display consistency in client.tsx'); 