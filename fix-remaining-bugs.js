const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix issue with verificationResults.allFields?.matches usage
content = content.replace(
  /data\.matches/g,
  'data?.matches'
);

// Fix incorrect usage of formatDate function
content = content.replace(
  /formatDate\((.+?)\.timestamp\)/g,
  '$1?.timestamp ? formatDate($1.timestamp) : "N/A"'
);

// Fix issue with verificationResults?.mismatches
content = content.replace(
  /verificationResults\.mismatches/g,
  'verificationResults?.mismatches'
);

// Fix issue with verificationResults?.matches
content = content.replace(
  /verificationResults\.matches/g,
  'verificationResults?.matches'
);

// Fix issue with verificationResults?.unverified
content = content.replace(
  /verificationResults\.unverified/g,
  'verificationResults?.unverified'
);

// Fix issue with verificationResults?.allFields
content = content.replace(
  /verificationResults\.allFields/g,
  'verificationResults?.allFields'
);

// Fix issue with improper prop spreading
content = content.replace(
  /component="img"\n\s+src=\{(.+?)\}/g,
  'component="img"\n                  src={$1 || ""}'
);

// Ensure all alt attributes have fallbacks
content = content.replace(
  /alt=\{`(.+?) \$\{(.+?)(\.\w+)?\}`\}/g,
  'alt={`$1 ${$2$3 || "Unknown"}`}'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed remaining bugs in client.tsx'); 