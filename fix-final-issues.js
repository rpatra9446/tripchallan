const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix any remaining double question marks
content = content.replace(/\?\?/g, '?');

// Fix any incorrect template string formatting
content = content.replace(/\$\{(\w+)\?\.id \|\| "Unknown"\}/g, '${$1?.id || "Unknown"}');

// Ensure all operatorSeal.method references have proper optional chaining
content = content.replace(/operatorSeal\.method/g, 'operatorSeal?.method');
content = content.replace(/guardSeal\.method/g, 'guardSeal?.method');

// Remove any duplicate null checks introduced by previous fixes
content = content.replace(/(\w+)\?\.\w+ && \1\?\.(\w+)/g, '$1?.$2');

// Fix any incorrect spacing in JSX attributes
content = content.replace(/label=\{([^}]+)\}\s+size/g, 'label={$1} size');
content = content.replace(/color=\{([^}]+)\}\s+size/g, 'color={$1} size');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed remaining issues in client.tsx'); 