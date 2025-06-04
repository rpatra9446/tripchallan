const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix indentation issues with Chip components
content = content.replace(
  /<Chip\s+\n\s+label={(.+?)}\s+\n\s+color={(.+?)}\s+\n\s+size="small"\s+\n\s+\/>/g,
  '<Chip\n                            label={$1}\n                            color={$2}\n                            size="small"\n                          />'
);

// Fix inconsistent spacing in operator/guard method checks
content = content.replace(
  /label={operatorSeal\.method && typeof operatorSeal\.method === 'string' && \s+\n\s+operatorSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? \s+\n\s+'Manually Entered' : 'Digitally Scanned'}/g,
  "label={operatorSeal.method && typeof operatorSeal.method === 'string' && operatorSeal.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned'}"
);

content = content.replace(
  /color={operatorSeal\.method && typeof operatorSeal\.method === 'string' && \s+\n\s+operatorSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? \s+\n\s+'secondary' : 'primary'}/g,
  "color={operatorSeal.method && typeof operatorSeal.method === 'string' && operatorSeal.method.toLowerCase().includes('manual') ? 'secondary' : 'primary'}"
);

// Apply same fixes for guardSeal.method
content = content.replace(
  /label={guardSeal\.method && typeof guardSeal\.method === 'string' && \s+\n\s+guardSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? \s+\n\s+'Manually Entered' : 'Digitally Scanned'}/g,
  "label={guardSeal.method && typeof guardSeal.method === 'string' && guardSeal.method.toLowerCase().includes('manual') ? 'Manually Entered' : 'Digitally Scanned'}"
);

content = content.replace(
  /color={guardSeal\.method && typeof guardSeal\.method === 'string' && \s+\n\s+guardSeal\.method\.toLowerCase\(\)\.includes\('manual'\) \? \s+\n\s+'secondary' : 'primary'}/g,
  "color={guardSeal.method && typeof guardSeal.method === 'string' && guardSeal.method.toLowerCase().includes('manual') ? 'secondary' : 'primary'}"
);

// Fix size="small" inconsistent indentation
content = content.replace(
  /size="small"\s+\n\s+\/>/g,
  'size="small" />'
);

// Fix misaligned closing tags
content = content.replace(
  /<\/Box>\s+\n\s+<\/Box>/g,
  '</Box>\n                    </Box>'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed indentation and spacing issues in client.tsx'); 