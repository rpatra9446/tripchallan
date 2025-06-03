const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the seal verification section
// Replace any incorrect variable references in the Chip components
content = content.replace(
  /<Chip\s+label=\{item\.method/g,
  '<Chip label={seal.method'
);

// Fix the Session Details section
// Ensure the Registration Certificate field is properly displayed
content = content.replace(
  /<strong>Registration Certificate:<\/strong> \{session\.tripDetails\.registrationCertificate \|\| "N\/A"\}/g,
  '<strong>Registration Certificate:</strong> {session.tripDetails?.registrationCertificate || "N/A"}'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed seal verification and session details issues in client.tsx'); 