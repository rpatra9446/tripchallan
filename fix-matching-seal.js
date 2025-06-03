const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Find the context of the matchingSeal reference around line 2134
const snippetBeforeMatchingSeal = content.substring(content.indexOf('matchingSeal') - 500, content.indexOf('matchingSeal'));
const snippetAfterMatchingSeal = content.substring(content.indexOf('matchingSeal'), content.indexOf('matchingSeal') + 500);
const fullSnippet = snippetBeforeMatchingSeal + snippetAfterMatchingSeal;

// Determine the appropriate variable name based on context
let variableName = 'scanItem';

// If we can identify a map function with a different variable name, use that instead
const mapMatch = fullSnippet.match(/(\w+)\.map\(\((\w+),\s*\w+\)\s*=>\s*\{/);
if (mapMatch && mapMatch[2]) {
  variableName = mapMatch[2];
}

// Replace matchingSeal with the appropriate variable
content = content.replace(
  /matchingSeal\.method/g,
  variableName + '.method'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log(`Fixed matchingSeal reference by replacing with ${variableName}`); 