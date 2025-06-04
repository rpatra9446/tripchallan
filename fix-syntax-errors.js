const fs = require('fs');
const path = require('path');

// Fix the syntax errors in the activity-logs page.tsx file
const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix the ActivityLogsResponse interface and Zod schema placement
const interfaceAndSchema = /interface ActivityLogsResponse {[\s\S]*?};[\s\S]*?\}/;
const fixedInterfaceAndSchema = `interface ActivityLogsResponse {
  logs: ActivityLog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }
}

// Zod schemas for runtime validation
const UserSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  role: z.string().nullable().optional()
});

const ActivityLogDetailsSchema = z.record(z.unknown()).optional().nullable();

const ActivityLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetResourceType: z.string().nullable().optional(),
  targetResourceId: z.string().nullable().optional(),
  userId: z.string(),
  createdAt: z.string().or(z.date()),
  userAgent: z.string().nullable().optional(),
  details: ActivityLogDetailsSchema,
  user: UserSchema.nullable().optional(),
  targetUser: UserSchema.nullable().optional()
});

const MetaSchema = z.object({
  currentPage: z.number().default(1),
  totalPages: z.number().default(1),
  totalItems: z.number().default(0),
  itemsPerPage: z.number().default(10),
  hasNextPage: z.boolean().default(false),
  hasPrevPage: z.boolean().default(false)
});

const ActivityLogsResponseSchema = z.object({
  logs: z.array(ActivityLogSchema).nullable().default([]),
  meta: MetaSchema.default({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false
  })
});`;

content = content.replace(interfaceAndSchema, fixedInterfaceAndSchema);

// 2. Remove the extra semicolon and closing brace after the Zod schemas
content = content.replace(/;\s*}/g, "}");

// 3. Fix the ActivityLogRow to match the definition in app-new.tsx
// Make targetResourceType required instead of optional
content = content.replace(/targetResourceType\?: string;/, "targetResourceType: string;");

// 4. Update the amount type in ActivityLogDetails to accept both string and number
content = content.replace(/amount\?: number;/, "amount?: string | number;");

// Save the changes
fs.writeFileSync(filePath, content);
console.log('Fixed syntax errors in activity logs page');

// Read the file
const filePathClient = path.join('app', 'dashboard', 'sessions', '[id]', 'client.tsx');
let contentClient = fs.readFileSync(filePathClient, 'utf8');

// Fix double question marks which is a syntax error
contentClient = contentClient.replace(/\?\?\.method/g, '?.method');

// Fix incorrect use of != null in ternary operators
contentClient = contentClient.replace(/activeSealTab === 0 != null/g, 'activeSealTab === 0');
contentClient = contentClient.replace(/isExpanded != null/g, 'isExpanded');

// Fix unnecessary != null comparisons while keeping the intent
contentClient = contentClient.replace(/operatorSeal != null \? \(/g, 'operatorSeal ? (');
contentClient = contentClient.replace(/guardSeal != null \? \(/g, 'guardSeal ? (');
contentClient = contentClient.replace(/seal\.verifiedBy != null/g, 'seal.verifiedBy');
contentClient = contentClient.replace(/seal\.scannedAt != null/g, 'seal.scannedAt');
contentClient = contentClient.replace(/seal\.image != null/g, 'seal.image');
contentClient = contentClient.replace(/guardSeal.imagePreview != null/g, 'guardSeal.imagePreview');
contentClient = contentClient.replace(/seal\.imageData != null/g, 'seal.imageData');
contentClient = contentClient.replace(/tag\.imageData != null/g, 'tag.imageData');
contentClient = contentClient.replace(/tag\.verifiedBy != null/g, 'tag.verifiedBy');
contentClient = contentClient.replace(/isVerified != null/g, 'isVerified');
contentClient = contentClient.replace(/operatorSeal && guardSeal != null/g, 'operatorSeal && guardSeal');

// Write the fixed content back to the file
fs.writeFileSync(filePathClient, contentClient);

console.log('Fixed syntax errors in client.tsx'); 