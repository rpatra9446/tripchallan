const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the incorrect TableRow closing tag in table headers
content = content.replace(
  /<TableCell width=\"40%\"><strong>Field<\/strong><\/TableCell>\s*<\/TableRow><TableCell/g, 
  '<TableCell width=\"40%\"><strong>Field</strong></TableCell>\n                <TableCell'
);

// Fix indentation in driver details section
content = content.replace(
  /<TextField\s+size="small"\s+placeholder="Add comment"\s+value={data\.comment}\s+onChange={\(e\) => handleCommentChange\(field, e\.target\.value\)}\s+variant="standard"\s+sx={{ mt: 1, width: '100%' }}\s+InputProps={{/g,
  '<TextField\n                          size="small"\n                          placeholder="Add comment"\n                          value={data.comment}\n                          onChange={(e) => handleCommentChange(field, e.target.value)}\n                          variant="standard"\n                          sx={{ mt: 1, width: \'100%\' }}\n                          InputProps={{'
);

// Fix closing tags and indentation
content = content.replace(
  /<IconButton\s+onClick={\(\) => handleCommentChange\(field, ''\)}\s+edge="end"\s+size="small"\s+>/g,
  '<IconButton\n                                  onClick={() => handleCommentChange(field, \'\')}\n                                  edge="end"\n                                  size="small"\n                                >'
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed JSX syntax issues in client.tsx'); 