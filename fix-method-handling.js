const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Ensure scanMethod state is properly initialized
if (!content.includes('const [scanMethod, setScanMethod] = useState')) {
  // Find the other useState hooks and add this one
  content = content.replace(
    /const \[scanInput, setScanInput\] = useState\(""\);/,
    `const [scanInput, setScanInput] = useState("");
  const [scanMethod, setScanMethod] = useState<'manual' | 'digital'>('manual');`
  );
  console.log('Added scanMethod state');
}

// 2. Fix the Add Manually button to set the scanMethod to 'manual'
content = content.replace(
  /onClick=\{\(\) => handleScanComplete\(scanInput\)\}/,
  `onClick={() => {
                  setScanMethod('manual');
                  handleScanComplete(scanInput);
                }}`
);
console.log('Fixed Add Manually button to set scanMethod');

// 3. Fix Chip component to display correct method
content = content.replace(
  /<Chip\s+size="small"\s+label=\{tag\?.method && typeof tag\?.method === 'string' &&\s+tag\?.method\.toLowerCase\(\)\.includes\('manual'\) \?\s+'Manually Entered' : 'Digitally Scanned'\}\s+color=\{tag\?.method && typeof tag\?.method === 'string' &&\s+tag\?.method\.toLowerCase\(\)\.includes\('manual'\) \?\s+'secondary' : 'primary'\}/g,
  `<Chip 
                          size="small" 
                          label={tag?.method === 'manual' ? 'Manually Entered' : 'Digitally Scanned'}
                          color={tag?.method === 'manual' ? 'secondary' : 'primary'}`
);
console.log('Fixed method display in Chip component');

// 4. Ensure the scanMethod is properly used in the ClientSideQrScanner component
content = content.replace(
  /onScanWithImage=\{\(data, imageFile\) => \{/,
  `onScanWithImage={(data, imageFile) => {
                  // Set method to digital since this was scanned with camera
                  setScanMethod('digital');`
);
console.log('Ensured scanMethod is set in QR scanner');

// 5. Add a method dropdown to select manual or digital method
if (!content.includes('Select Method:')) {
  content = content.replace(
    /<Box sx=\{\{ display: 'flex', alignItems: 'center', gap: 2 \}\}>/,
    `<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="scan-method-label">Select Method:</InputLabel>
                  <Select
                    labelId="scan-method-label"
                    value={scanMethod}
                    label="Select Method:"
                    onChange={(e) => setScanMethod(e.target.value as 'manual' | 'digital')}
                  >
                    <MenuItem value="manual">Manual Entry</MenuItem>
                    <MenuItem value="digital">Digital Scan</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>`
  );
  
  // Add closing tag for the new Box
  content = content.replace(
    /<\/Box>\s+<\/Box>\s+<\/Paper>/,
    `</Box>
                    </Box>
                  </Box>
                </Paper>`
  );
  
  // Add required imports
  if (!content.includes('FormControl')) {
    content = content.replace(
      /import { (.*) } from "@mui\/material";/,
      `import { $1, FormControl, InputLabel, Select, MenuItem } from "@mui/material";`
    );
  }
  
  console.log('Added method selection dropdown');
}

// 6. Fix the handleScanComplete function to use the selected method
content = content.replace(
  /method: 'manual', \/\/ This is manual entry/,
  `method: scanMethod, // Use the selected method`
);
console.log('Updated handleScanComplete to use selected method');

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);
console.log('Successfully improved method handling in guard verification'); 