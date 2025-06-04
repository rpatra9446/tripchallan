const fs = require('fs');
const path = require('path');

// Read the file
const filePath = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix TypeScript typing for verificationFields state
content = content.replace(
  /const \[verificationFields, setVerificationFields\] = useState<Record<string, any>>\(\{\}\);/,
  `const [verificationFields, setVerificationFields] = useState<{[key: string]: {
    operatorValue: any;
    guardValue: any;
    comment: string;
    isVerified: boolean;
  }}>({});`
);

// Fix optional chaining syntax in JSX
content = content.replace(
  /\{operatorSeal\?.id\}/g,
  '{operatorSeal?.id ?? "Unknown"}'
);

content = content.replace(
  /\{guardSeal\?.id\}/g,
  '{guardSeal?.id ?? "Unknown"}'
);

// Fix potential undefined errors in method calls
content = content.replace(
  /getMethodDisplay\((.+?)\.method\)/g,
  'getMethodDisplay($1?.method)'
);

content = content.replace(
  /getMethodColor\((.+?)\.method\)/g,
  'getMethodColor($1?.method)'
);

// Fix potential undefined errors in ternary operators
content = content.replace(
  /\{(.+?) \? \(/g,
  '{$1 != null ? ('
);

// Write the fixed content back to the file
fs.writeFileSync(filePath, content);

console.log('Fixed TypeScript issues in client.tsx'); 