const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the syntax error with the square brackets
const errorPattern = /label=\{([^\}]*)\[([^\]]*)\]([^\}]*)\}/g;
content = content.replace(errorPattern, 'label={$1$2$3}');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed syntax error in Chip component'); 