const fs = require('fs');
const path = require('path');

// Path to the file that needs to be fixed
const filePath = path.join(__dirname, 'app', 'dashboard', 'sessions', '[id]', 'client.tsx');

// Read the file content
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Split the file content into lines
  const lines = data.split('\n');
  
  // Check if line 5016 contains the duplicate declaration
  console.log(`Line 5016 content: ${lines[5015]}`);
  
  // Look for the exact line with the issue as reported in the error
  let hasRemovedDuplicate = false;
  
  // Search for the exact duplicate state declarations around line 5016
  for (let i = 5010; i < 5025; i++) {
    if (i < lines.length) {
      if (lines[i].trim() === 'const [openImageModal, setOpenImageModal] = useState(false);') {
        console.log(`Found duplicate openImageModal declaration at line ${i+1}`);
        lines[i] = '// Removed duplicate declaration';
        hasRemovedDuplicate = true;
      }
      if (lines[i].trim() === 'const [selectedImage, setSelectedImage] = useState(null);') {
        console.log(`Found duplicate selectedImage declaration at line ${i+1}`);
        lines[i] = '// Removed duplicate declaration';
        hasRemovedDuplicate = true;
      }
    }
  }
  
  if (hasRemovedDuplicate) {
    // Join the lines back together
    const modifiedContent = lines.join('\n');
    
    // Write the modified content back to the file
    fs.writeFile(filePath, modifiedContent, 'utf8', (err) => {
      if (err) {
        console.error('Error writing file:', err);
        return;
      }
      console.log('Successfully fixed duplicate state declarations');
    });
  } else {
    console.log('No duplicate state declarations found around line 5016, trying more general approach');
    
    // More robust approach - create a new content string without the duplicate declarations
    const modifiedContent = data.replace(/const \[openImageModal, setOpenImageModal\] = useState\(false\);(\r?\n)\s*const \[selectedImage, setSelectedImage\] = useState\(null\);/g, '// Removed duplicate declarations');
    
    // Write the modified content back to the file
    fs.writeFile(filePath, modifiedContent, 'utf8', (err) => {
      if (err) {
        console.error('Error writing file:', err);
        return;
      }
      console.log('Successfully applied general fix for duplicate state declarations');
    });
  }
}); 