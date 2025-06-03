const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix operatorSeal references
let modifiedContent = content.replace(
  /(\s*)(<TableCell>\s*<Chip\s*label=\{)seal(\.method && typeof )seal(\.method === 'string' && )seal(\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'Manually Entered' : 'Digitally Scanned'\}\s*color=\{)seal(\.method && typeof )seal(\.method === 'string' && )seal(\.method\.toLowerCase\(\)\.includes\('manual'\) \? 'secondary' : 'primary'\}\s*size="small"\s*\/>\s*<\/TableCell>)/g,
  function(match, space, start, _, __, ___, ____, _____, ______, context) {
    // Determine the appropriate variable name based on context
    const variableName = match.indexOf('matchingGuardSeal') > -1 ? 'matchingGuardSeal' : 
                         match.indexOf('guardSeal') > -1 ? 'guardSeal' : 'operatorSeal';
    
    return `${space}${start}${variableName}${_.replace('seal', variableName)}${__}${___}${____}${_____}${______}`;
  }
);

// Save the modified content
fs.writeFileSync(filePath, modifiedContent);
console.log(`Fixed seal variable references in ${filePath}`); 