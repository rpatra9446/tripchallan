const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Common patterns to fix

// 1. Fix double closing tags on TableCell
content = content.replace(/<\/TableCell>\s*<\/TableCell>/g, '</TableCell>');

// 2. Fix all return statements with TableRow to use fragments
const returnRowRegex = /return\s*\(\s*<TableRow/g;
content = content.replace(returnRowRegex, 'return (<>$&');

const closeRowRegex = /<\/TableRow>\s*\)\s*;/g;
content = content.replace(closeRowRegex, '</TableRow></>);');

// 3. Fix unclosed JSX fragments
content = content.replace(/<>\s*<TableCell[\s\S]*?<\/TableCell>\s*(?!<\/TableCell>|<\/TableRow>|<\/>)/g, match => {
  return match + '</>';
});

// 4. Fix missing TableRow closing tags
content = content.replace(/<TableRow[^>]*>[\s\S]*?(?!<\/TableRow>)<\/TableCell>\s*<\/TableCell>/g, match => {
  return match + '</TableRow>';
});

// 5. Fix self-closing fragments
content = content.replace(/<\/>([^<]*?)<\/>/g, '</>$1');

// 6. Handle specific error contexts
// Fix missing TableRow close tags around table cells
content = content.replace(
  /(<TableRow[^>]*>[\s\S]*?)(<\/TableCell>\s*)(?!<\/TableRow>)([\s\S]*?<TableCell>)/g,
  '$1$2</TableRow>$3'
);

// Ensure fragments in complex nested contexts
content = content.replace(
  /(matchingGuardSeal \? \(\s*)(<TableCell>[\s\S]*?<\/TableCell>\s*<TableCell>[\s\S]*?<\/TableCell>\s*<TableCell>[\s\S]*?<\/TableCell>)/g,
  '$1<>$2</>'
);

// Remove any direct uses of <> followed by </>
content = content.replace(/<>\s*<\/>/g, '');

// Fix extra closing tags
content = content.replace(/<\/TableCell>\s*<\/TableRow>\s*<\/TableRow>/g, '</TableCell></TableRow>');

// Fix doubled array closing brackets
content = content.replace(/\]\]\s*;/g, '];');

// Replace mismatched variables with their correct context
const variableReplacements = [
  // Fix variable references in map functions
  { pattern: /seal\.method && typeof seal\.method/g, context: /\.map\(\(([^,]+)[^)]*\)/g, replacement: (match, p1) => `${p1}.method && typeof ${p1}.method` },
  { pattern: /item && item\.method && typeof item\.method/g, context: /\.map\(\(([^,]+)[^)]*\)/g, replacement: (match, p1) => `${p1} && ${p1}.method && typeof ${p1}.method` },
  { pattern: /scanItem\.method/g, replacement: 'seal.method' }
];

// Apply variable fixes in context
for (const { pattern, context, replacement } of variableReplacements) {
  if (context) {
    // Find all map functions
    const mapMatches = content.match(new RegExp(context, 'g')) || [];
    
    for (const mapMatch of mapMatches) {
      // Extract the iterator variable
      const match = new RegExp(context).exec(mapMatch);
      if (match && match[1]) {
        const iterVar = match[1];
        // Find nearby pattern uses and replace with contextualized version
        const nearbyContent = content.substring(content.indexOf(mapMatch), content.indexOf(mapMatch) + 1000);
        const patternMatches = nearbyContent.match(pattern) || [];
        
        for (const patternMatch of patternMatches) {
          // Create replacement with the correct variable
          const specificReplacement = typeof replacement === 'function' 
            ? replacement(patternMatch, iterVar)
            : replacement.replace(/\$1/g, iterVar);
          
          // Replace in the content
          content = content.replace(patternMatch, specificReplacement);
        }
      }
    }
  } else {
    // Global replace for non-contextual patterns
    content = content.replace(pattern, replacement);
  }
}

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed remaining complex errors in client.tsx'); 