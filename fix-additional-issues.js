const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix any mixed or incorrect usage of getMethodDisplay/getMethodColor
content = content.replace(
  /label=\{(.+?)\.method && typeof (.+?)\.method === 'string' && (.+?)\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}/g,
  'label={getMethodDisplay($1.method)}'
);

content = content.replace(
  /color=\{(.+?)\.method && typeof (.+?)\.method === 'string' && (.+?)\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}/g,
  'color={getMethodColor($1.method)}'
);

// Fix potential null reference issues when accessing method property
content = content.replace(
  /guardSeal\.method/g,
  'guardSeal?.method'
);

content = content.replace(
  /operatorSeal\.method/g,
  'operatorSeal?.method'
);

content = content.replace(
  /seal\.method/g,
  'seal?.method'
);

content = content.replace(
  /tag\.method/g,
  'tag?.method'
);

// Fix potential undefined references in template literals
content = content.replace(
  /\`Seal \$\{(.+?)\.id\}\`/g,
  '`Seal ${$1?.id || "Unknown"}`'
);

content = content.replace(
  /\`Seal tag \$\{(.+?)\.id\}\`/g,
  '`Seal tag ${$1?.id || "Unknown"}`'
);

// Fix potential undefined references in formatDate
content = content.replace(
  /\{formatDate\((.+?)\.timestamp\)\}/g,
  '{$1?.timestamp ? formatDate($1.timestamp) : "N/A"}'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed additional issues in client.tsx'); 