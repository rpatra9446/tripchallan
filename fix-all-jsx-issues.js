const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove all JSX fragments that are improperly formatted
content = content.replace(/<><\/>/g, '');
content = content.replace(/<><TableRow/g, '<TableRow');
content = content.replace(/<\/TableRow><\/>/g, '</TableRow>');

// 2. Fix all unclosed tags
// Fix unclosed TableCell/TableHead/TableBody tags
content = content.replace(/<TableHead>[\s\S]*?<TableBody>/g, (match) => {
  if (!match.includes('</TableHead>')) {
    return match.replace('<TableBody>', '</TableHead>\n              <TableBody>');
  }
  return match;
});

// 3. Fix double tags
content = content.replace(/<\/TableBody>\s*<\/TableBody>/g, '</TableBody>');
content = content.replace(/<\/TableCell>\s*<\/TableCell>/g, '</TableCell>');

// 4. Fix incorrect nesting
// Fix TableCell directly after TableRow closing
content = content.replace(/<\/TableRow>\s*<TableCell/g, '</TableCell>\n                </TableRow>\n                <TableRow>\n                  <TableCell');

// 5. Fix placeholder values that were inserted by regex
content = content.replace(/<TableCell\$1>\$2<\/TableCell>/g, '<TableCell sx={{ color: \'primary.contrastText\' }}>#</TableCell>');

// 6. Fix operatorSeal references that don't exist
content = content.replace(/operatorSeal\.method/g, 'seal.method');
content = content.replace(/guardSeal\.method/g, 'seal.method');

// 7. Find all fragments with broken closings
content = content.replace(/<\/>\s*<TableCell/g, '</TableCell>\n                <TableCell');

// 8. Fix broken JSX tag content
content = content.replace(/label=\{([^}]*)seal\.method\.toLowerCase\(\)\.includes/g, 'label={$1seal && seal.method && typeof seal.method === "string" && seal.method.toLowerCase().includes');
content = content.replace(/color=\{([^}]*)seal\.method\.toLowerCase\(\)\.includes/g, 'color={$1seal && seal.method && typeof seal.method === "string" && seal.method.toLowerCase().includes');

// 9. Find all line 1891 references with Box
content = content.replace(/return\s*\(\s*<Box\s*>/g, 'return (\n      <Box component="div">');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed all remaining JSX issues in client.tsx'); 