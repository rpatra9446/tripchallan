import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import fs from 'fs';
import path from 'path';

// Directory for storing uploaded files
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Create directory only in development, not in production (Vercel has read-only filesystem)
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create uploads directory:", error);
  }
}

// Helper function to save a single file from FormData
async function saveFormFile(file: File, filePath: string): Promise<void> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
  } catch (error) {
    console.error(`Error saving file to ${filePath}:`, error);
    throw error;
  }
}

// Helper function to save multiple files from FormData
async function saveFormFilesArray(formData: FormData, prefix: string, dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix) && value instanceof File) {
      const index = key.match(/\[(\d+)\]/)?.[1] || '0';
      const filePath = path.join(dirPath, index);
      await saveFormFile(value, filePath);
    }
  }
}

// Helper function to convert File to base64
async function fileToBase64(file: File): Promise<string> {
  try {
    console.log(`Converting file to base64: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // // Implement size check - 5MB limit
    // const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    // if (file.size > MAX_FILE_SIZE) {
    //   console.error(`File too large: ${file.name}, size: ${file.size} bytes`);
    //   throw new Error(`File too large: ${file.name}. Maximum size is 5MB.`);
    // }
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    console.log(`Successfully converted file to base64: ${file.name}, base64 length: ${base64.length}`);
    return base64;
  } catch (error) {
    console.error(`Error converting file to base64: ${file.name}`, error);
    throw error;
  }
}

interface QueryOptions {
  skip: number;
  take: number;
  orderBy: { createdAt: "desc" };
  include: {
    createdBy: {
      select: {
        id: true;
        name: true;
        email: true;
        subrole: true;
      };
    };
    company: {
      select: {
        id: true;
        name: true;
      };
    };
    seal: {
      include: {
        verifiedBy: {
          select: {
            id: true;
            name: true;
            email: true;
            role: true;
            subrole: true;
          }
        }
      }
    };
  };
  where?: Record<string, unknown>;
}

interface SessionWithSeal {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: Date;
  seal: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: Date | null;
  } | null;
}

interface ActivityLogDetails {
  tripDetails?: Record<string, unknown>;
  images?: Record<string, string>;
  timestamps?: Record<string, string>;
  qrCodes?: Record<string, string>;
  verification?: {
    status: string;
    timestamp: string;
    verifiedBy: string;
  };
}

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userRole = session.user.role;
    const userId = session.user.id;
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    // Build where clause based on user role
    let whereClause: Record<string, any> = {};
    
    try {
      if (userRole === UserRole.SUPERADMIN) {
        // SuperAdmin can see all sessions
        whereClause = {};
      } else if (userRole === UserRole.ADMIN) {
        // Admin can only see sessions from companies they created
        const companiesCreatedByAdmin = await prisma.user.findMany({
          where: {
            role: UserRole.COMPANY,
            createdById: userId,
          },
          select: {
            id: true,
            companyId: true,
          }
        });
        
        const companyIds = companiesCreatedByAdmin
          .filter((company: { companyId?: string }) => company.companyId)
          .map((company: { companyId?: string }) => company.companyId as string);
          
        const companyUserIds = companiesCreatedByAdmin.map((company: { id: string }) => company.id);
        
        if (companyIds.length === 0 && companyUserIds.length === 0) {
          // No companies found, return empty results instead of attempting a query
          return NextResponse.json({
            sessions: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0
            }
          });
        }
        
        whereClause = {
          companyId: {
            in: [...new Set([...companyIds, ...companyUserIds])].filter(Boolean)
          }
        };
      } else if (userRole === UserRole.COMPANY) {
        // Company user should see all sessions associated with their company
        console.log("[API DEBUG] Fetching sessions for company user:", userId);
        
        // First, we need to get the actual company information for this company user
        // The user ID is NOT the same as the company ID in the sessions table
        const companyUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, companyId: true }
        });
        
        if (!companyUser) {
          console.error("Company user not found:", userId);
          return NextResponse.json({
            sessions: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0
            }
          });
        }
        
        // Important: When operators create sessions, they set companyId to THEIR company's ID
        // So we need to use the company entity ID here, NOT the company user's ID
        whereClause = {
          OR: [
            { companyId: userId }, // Legacy - if any sessions were created with the company user's ID
            { companyId: companyUser.id } // Also try the user's ID directly in case it's stored that way
          ]
        };
        
        // If the company user has an associated company, also include that ID
        if (companyUser.companyId) {
          whereClause.OR.push({ companyId: companyUser.companyId });
        }
        
        console.log("[API DEBUG] Company sessions whereClause:", JSON.stringify(whereClause, null, 2));
      } else if (userRole === UserRole.EMPLOYEE) {
        const employee = await prisma.user.findUnique({
          where: { id: userId },
          select: { companyId: true, subrole: true }
        });
        
        // Check if we can find the employee and their company
        if (!employee || !employee.companyId) {
          console.error("Employee has no company association:", userId);
          return NextResponse.json({
            sessions: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0
            }
          });
        }
        
        // Employee can only see sessions from their company or they created/verified
        whereClause = {
          OR: [
            { companyId: employee.companyId },
            { createdById: userId }
          ]
        };
        
        // Specific case for guards: add needsVerification filter
        if (employee.subrole === EmployeeSubrole.GUARD) {
          const needsVerification = searchParams.get('needsVerification') === 'true';
          console.log("[API DEBUG] GUARD query. needsVerification param:", needsVerification);
          console.log("[API DEBUG] GUARD employee:", {
            id: employee.id,
            companyId: employee.companyId,
            subrole: employee.subrole
          });
          
          if (needsVerification) {
            console.log("[API DEBUG] Original whereClause for GUARD:", JSON.stringify(whereClause, null, 2));
            whereClause = {
              ...whereClause,
              status: "IN_PROGRESS",
              companyId: employee.companyId,
              seal: {
                verified: false
              }
            };
            console.log("[API DEBUG] Modified whereClause for GUARD with needsVerification=true:", JSON.stringify(whereClause, null, 2));
          }
        }
      }
    } catch (error) {
      console.error("Error building where clause:", error);
      return NextResponse.json({
        sessions: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }
    
    // Add status filter if provided
    if (status) {
      whereClause = {
        ...whereClause,
        status
      };
    }
    
    // Add search filter if provided
    if (search) {
      whereClause = {
        ...whereClause,
        OR: [
          { source: { contains: search, mode: 'insensitive' } },
          { destination: { contains: search, mode: 'insensitive' } },
          { 'seal.barcode': { contains: search, mode: 'insensitive' } }
        ]
      };
    }
    
    // Get total count for pagination
    const total = await prisma.session.count({
      where: whereClause
    }).catch((error: Error) => {
      console.error("Error counting sessions:", error);
      return 0;
    });
    
    // If no results, return empty array immediately
    if (total === 0) {
      return NextResponse.json({
        sessions: [],
        pagination: {
          total: 0,
          page: 1,
          limit,
          pages: 0
        }
      });
    }
    
    // Get sessions with pagination
    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        seal: {
          select: {
            id: true,
            barcode: true,
            verified: true,
            scannedAt: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    }).catch((error: Error) => {
      console.error("Error fetching sessions:", error);
      return [];
    });
    
    // Log the results for debugging
    if (userRole === UserRole.EMPLOYEE && session.user.subrole === EmployeeSubrole.GUARD) {
      console.log(`[API DEBUG] Found ${sessions.length} sessions for GUARD with filters`);
      
      if (sessions.length > 0) {
        sessions.forEach((session: any) => {
          console.log(`[API DEBUG] Session ${session.id}:`, {
            status: session.status,
            companyId: session.companyId,
            hasSeal: !!session.seal,
            sealVerified: session.seal?.verified
          });
        });
      } else {
        // If no sessions were found, check without the seal filter to see if that's the issue
        console.log("[API DEBUG] No sessions found with current filter. Checking DB for any IN_PROGRESS sessions for this company...");
        
        prisma.session.findMany({
          where: {
            companyId: whereClause.companyId,
            status: "IN_PROGRESS"
          },
          include: { seal: true },
          take: 5
        }).then((checkSessions: any[]) => {
          console.log(`[API DEBUG] Found ${checkSessions.length} IN_PROGRESS sessions for company without seal filter`);
          checkSessions.forEach((checkSession: any) => {
            console.log(`[API DEBUG] Check session ${checkSession.id}:`, {
              hasSeal: !!checkSession.seal,
              sealVerified: checkSession.seal?.verified
            });
          });
        }).catch((error: Error) => {
          console.error("[API DEBUG] Error checking sessions without seal filter:", error);
        });
      }
    }
    
    if (sessions.length === 0) {
      return NextResponse.json({
        sessions: [],
        pagination: {
          total: 0,
          page: 1,
          limit,
          pages: 0
        }
      });
    }
    
    // Get activity logs for trip details
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: {
          in: sessions.map((s: { id: string }) => s.id)
        },
        targetResourceType: 'session',
        action: 'CREATE'
      }
    }).catch((error: Error) => {
      console.error("Error fetching activity logs:", error);
      return [];
    });
    
    // Enhance sessions with trip details
    const enhancedSessions = sessions.map((session: any) => {
      const activityLog = activityLogs.find((log: { targetResourceId: string }) => log.targetResourceId === session.id);
      const details = activityLog?.details as ActivityLogDetails | undefined;
      
      return {
        ...session,
        tripDetails: details?.tripDetails || {},
        qrCodes: details?.qrCodes || {}
      };
    });
    
    // Check if no sessions were found with a seal, check for employees to see if guard and operators belong to same company
    if (sessions.length === 0 && userRole === UserRole.EMPLOYEE && session.user.subrole === EmployeeSubrole.GUARD) {
      console.log("[API DEBUG] Checking company employees to verify guard-operator relationship...");
      
      // Get company ID
      const guardCompanyId = whereClause.companyId;
      
      // Look up all employees in this company
      prisma.user.findMany({
        where: {
          companyId: guardCompanyId,
          role: UserRole.EMPLOYEE
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          subrole: true,
          companyId: true
        }
      }).then((employees: any[]) => {
        console.log(`[API DEBUG] Found ${employees.length} employees in company ${guardCompanyId}`);
        
        // Count how many operators and guards
        const operators = employees.filter(emp => emp.subrole === EmployeeSubrole.OPERATOR);
        const guards = employees.filter(emp => emp.subrole === EmployeeSubrole.GUARD);
        
        console.log(`[API DEBUG] Company has ${operators.length} operators and ${guards.length} guards`);
        
        if (operators.length > 0) {
          console.log("[API DEBUG] Operators in this company:", operators.map(op => ({
            id: op.id,
            name: op.name,
            email: op.email
          })));
        }
      }).catch((error: Error) => {
        console.error("[API DEBUG] Error checking company employees:", error);
      });
    }
    
    return NextResponse.json({
      sessions: enhancedSessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({
      error: "Failed to fetch sessions",
      sessions: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        pages: 0
      }
    }, { status: 200 });  // Return 200 with empty data instead of 500
  }
}

// All authenticated users can access sessions list
// (Role-based filtering is done within the handler)
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE
]);

// Add POST handler for session creation
export const POST = withAuth(
  async (req: NextRequest) => {
    console.log("Starting session creation process");
    try {
      const session = await getServerSession(authOptions);
      const userId = session?.user.id;
      const userRole = session?.user.role;
      const userSubrole = session?.user.subrole;

      console.log(`User ID: ${userId}, Role: ${userRole}, Subrole: ${userSubrole}`);

      // Only OPERATORS can create sessions
      if (userRole !== UserRole.EMPLOYEE || userSubrole !== EmployeeSubrole.OPERATOR) {
        console.error("Unauthorized session creation attempt: User is not an operator");
        return NextResponse.json(
          { error: "Unauthorized. Only operators can create sessions" },
          { status: 403 }
        );
      }

      console.log("Checking operator permissions");
      // Check if the operator has permission to create sessions
      const permissions = await prisma.operatorPermissions.findUnique({
        where: { userId: userId }
      });

      if (!permissions?.canCreate) {
        return NextResponse.json(
          { error: "You don't have permission to create sessions. Please contact your administrator." },
          { status: 403 }
        );
      }

      // Extract basic session data
      const formData = await req.formData();
      
      // Extract only the fields that exist in the Session model
      const sessionData = {
        source: formData.get('source') as string || formData.get('loadingSite') as string,
        destination: formData.get('destination') as string || formData.get('receiverPartyName') as string,
        createdById: userId as string,
        // Add all trip details fields directly to the session
        transporterName: formData.get('transporterName') as string,
        materialName: formData.get('materialName') as string,
        receiverPartyName: formData.get('receiverPartyName') as string,
        vehicleNumber: formData.get('vehicleNumber') as string,
        gpsImeiNumber: formData.get('gpsImeiNumber') as string,
        driverName: formData.get('driverName') as string,
        driverContactNumber: formData.get('driverContactNumber') as string,
        loaderName: formData.get('loaderName') as string,
        challanRoyaltyNumber: formData.get('challanRoyaltyNumber') as string,
        doNumber: formData.get('doNumber') as string,
        freight: parseFloat(formData.get('freight') as string) || null,
        qualityOfMaterials: formData.get('qualityOfMaterials') as string,
        tpNumber: formData.get('tpNumber') as string,
        grossWeight: parseFloat(formData.get('grossWeight') as string) || null,
        tareWeight: parseFloat(formData.get('tareWeight') as string) || null,
        netMaterialWeight: parseFloat(formData.get('netMaterialWeight') as string) || null,
        loaderMobileNumber: formData.get('loaderMobileNumber') as string,
        loadingSite: formData.get('loadingSite') as string,
        cargoType: formData.get('cargoType') as string,
        numberOfPackages: formData.get('numberOfPackages') as string,
      };

      // Get timestamps data
      const loadingDetailsTimestamps = formData.get('loadingDetailsTimestamps');
      const imagesFormTimestamps = formData.get('imagesFormTimestamps');

      // Extract seal tag data
      const sealTagIdsJson = formData.get('sealTagIds') as string;
      const sealTagMethodsJson = formData.get('sealTagMethods') as string;
      const sealTagTimestampsJson = formData.get('sealTagTimestamps') as string;
      
      // Parse the seal tag data if it exists
      const sealTagIds = sealTagIdsJson ? JSON.parse(sealTagIdsJson) : [];
      const sealTagMethods = sealTagMethodsJson ? JSON.parse(sealTagMethodsJson) : {};
      const sealTagTimestamps = sealTagTimestampsJson ? JSON.parse(sealTagTimestampsJson) : {};

      // Handle scanned codes
      const scannedCodesJson = formData.get('scannedCodes') as string;
      const scannedCodes = scannedCodesJson ? JSON.parse(scannedCodesJson) : [];

      // Extract files information
      console.log("Extracting file information from form data");
      const gpsImeiPicture = formData.get('gpsImeiPicture') as File;
      const vehicleNumberPlatePicture = formData.get('vehicleNumberPlatePicture') as File;
      const driverPicture = formData.get('driverPicture') as File;
      
      // Log file information
      if (gpsImeiPicture) {
        console.log(`GPS IMEI picture: ${gpsImeiPicture.name}, ${gpsImeiPicture.size} bytes, ${gpsImeiPicture.type}`);
      }
      if (vehicleNumberPlatePicture) {
        console.log(`Vehicle number plate picture: ${vehicleNumberPlatePicture.name}, ${vehicleNumberPlatePicture.size} bytes, ${vehicleNumberPlatePicture.type}`);
      }
      if (driverPicture) {
        console.log(`Driver picture: ${driverPicture.name}, ${driverPicture.size} bytes, ${driverPicture.type}`);
      }
      
      // Check for array images and log counts
      let sealingImagesCount = 0;
      let vehicleImagesCount = 0;
      let additionalImagesCount = 0;
      
      // Count the number of images in each category
      for (const key of formData.keys()) {
        if (key.startsWith('sealingImages')) sealingImagesCount++;
        if (key.startsWith('vehicleImages')) vehicleImagesCount++;
        if (key.startsWith('additionalImages')) additionalImagesCount++;
      }
      
      console.log(`Found ${sealingImagesCount} sealing images, ${vehicleImagesCount} vehicle images, and ${additionalImagesCount} additional images`);
      
      // // Set a limit for total number of images to prevent overloading the database
      // const MAX_TOTAL_IMAGES = 20;
      // const totalImages = (gpsImeiPicture ? 1 : 0) + 
      //                    (vehicleNumberPlatePicture ? 1 : 0) + 
      //                    (driverPicture ? 1 : 0) + 
      //                    sealingImagesCount + 
      //                    vehicleImagesCount + 
      //                    additionalImagesCount;
                         
      // console.log(`Total number of images: ${totalImages}`);
      
      // if (totalImages > MAX_TOTAL_IMAGES) {
      //   console.error(`Too many images: ${totalImages} exceeds limit of ${MAX_TOTAL_IMAGES}`);
      //   return NextResponse.json(
      //     { error: `Too many images. Maximum allowed is ${MAX_TOTAL_IMAGES}, but received ${totalImages}.` },
      //     { status: 413 }
      //   );
      // }
      
      // Get employee data to determine company association
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true }
      });
      
      if (!employee || !employee.companyId) {
        return NextResponse.json(
          { error: "Employee is not associated with any company" },
          { status: 400 }
        );
      }
      
      // Check if operator has enough coins (minimum 1 coin needed)
      const operatorCoins = employee.coins ?? 0;
      if (operatorCoins < 1) {
        return NextResponse.json(
          { error: "Insufficient coins. You need at least 1 coin to create a session." },
          { status: 400 }
        );
      }

      // Process images to base64
      console.log("Starting image processing to base64");
      let imageBase64Data: Record<string, any> = {};
      
      // Check if client already sent base64 data
      const clientBase64Data = formData.get('imageBase64Data');
      if (clientBase64Data) {
        try {
          console.log("Using client-provided base64 image data");
          imageBase64Data = JSON.parse(clientBase64Data as string);
          console.log("Successfully parsed client base64 image data");
        } catch (error) {
          console.error("Error parsing client base64 image data:", error);
          // Continue with server-side processing if client data is invalid
        }
      }
      
      // If we don't have client-side base64 data, process images on the server
      if (!clientBase64Data || Object.keys(imageBase64Data).length === 0) {
        try {
          // Process single images
          if (gpsImeiPicture) {
            try {
              console.log(`Processing GPS IMEI picture: ${gpsImeiPicture.name}, size: ${gpsImeiPicture.size} bytes`);
              imageBase64Data.gpsImeiPicture = {
                contentType: gpsImeiPicture.type,
                data: await fileToBase64(gpsImeiPicture)
              };
              console.log("GPS IMEI picture processed successfully");
            } catch (error) {
              console.error("Error processing GPS IMEI picture:", error);
              return NextResponse.json(
                { error: `Failed to process GPS IMEI picture: ${error instanceof Error ? error.message : 'Unknown error'}` },
                { status: 413 }
              );
            }
          }
          
          if (vehicleNumberPlatePicture) {
            try {
              console.log(`Processing vehicle number plate picture: ${vehicleNumberPlatePicture.name}, size: ${vehicleNumberPlatePicture.size} bytes`);
              imageBase64Data.vehicleNumberPlatePicture = {
                contentType: vehicleNumberPlatePicture.type,
                data: await fileToBase64(vehicleNumberPlatePicture)
              };
              console.log("Vehicle number plate picture processed successfully");
            } catch (error) {
              console.error("Error processing vehicle number plate picture:", error);
              return NextResponse.json(
                { error: `Failed to process vehicle number plate picture: ${error instanceof Error ? error.message : 'Unknown error'}` },
                { status: 413 }
              );
            }
          }
          
          if (driverPicture) {
            try {
              console.log(`Processing driver picture: ${driverPicture.name}, size: ${driverPicture.size} bytes`);
              imageBase64Data.driverPicture = {
                contentType: driverPicture.type,
                data: await fileToBase64(driverPicture)
              };
              console.log("Driver picture processed successfully");
            } catch (error) {
              console.error("Error processing driver picture:", error);
              return NextResponse.json(
                { error: `Failed to process driver picture: ${error instanceof Error ? error.message : 'Unknown error'}` },
                { status: 413 }
              );
            }
          }
          
          // Process array images
          imageBase64Data.sealingImages = [];
          imageBase64Data.vehicleImages = [];
          imageBase64Data.additionalImages = [];
          
          // Helper function to extract and convert files from FormData
          const processFormDataFiles = async (prefix: string, targetArray: any[], displayName: string) => {
            console.log(`Processing ${displayName} images`);
            let index = 0;
            let errors = [];
            
            while (formData.get(`${prefix}[${index}]`)) {
              try {
                const file = formData.get(`${prefix}[${index}]`) as File;
                console.log(`Processing ${displayName}[${index}]: ${file.name}, size: ${file.size} bytes`);
                
                targetArray.push({
                  contentType: file.type,
                  data: await fileToBase64(file)
                });
                
                console.log(`Successfully processed ${displayName}[${index}]`);
              } catch (error) {
                console.error(`Error processing ${displayName}[${index}]:`, error);
                errors.push(`${displayName} image #${index+1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
              index++;
            }
            
            if (errors.length > 0) {
              throw new Error(`Failed to process some ${displayName} images: ${errors.join('; ')}`);
            }
            
            console.log(`Successfully processed ${index} ${displayName} images`);
          };
          
          // Process each type of array images
          try {
            await processFormDataFiles('sealingImages', imageBase64Data.sealingImages, 'Sealing');
          } catch (error) {
            console.error("Error processing sealing images:", error);
            return NextResponse.json(
              { error: error instanceof Error ? error.message : 'Failed to process sealing images' },
              { status: 413 }
            );
          }
          
          try {
            await processFormDataFiles('vehicleImages', imageBase64Data.vehicleImages, 'Vehicle');
          } catch (error) {
            console.error("Error processing vehicle images:", error);
            return NextResponse.json(
              { error: error instanceof Error ? error.message : 'Failed to process vehicle images' },
              { status: 413 }
            );
          }
          
          try {
            await processFormDataFiles('additionalImages', imageBase64Data.additionalImages, 'Additional');
          } catch (error) {
            console.error("Error processing additional images:", error);
            return NextResponse.json(
              { error: error instanceof Error ? error.message : 'Failed to process additional images' },
              { status: 413 }
            );
          }
          
          console.log("All images processed successfully");
        } catch (error) {
          console.error("Error processing images:", error);
          return NextResponse.json(
            { error: `Failed to process images: ${error instanceof Error ? error.message : 'Unknown error'}` },
            { status: 500 }
          );
        }
      }
      
      // Create session with a seal in a transaction
      try {
        console.log("Starting database transaction for session creation");
        
        const result = await prisma.$transaction(async (tx: any) => {
          try {
            console.log("Deducting coin from operator");
            // Deduct coin from operator
            const updatedOperator = await tx.user.update({
              where: { id: userId },
              data: { coins: { decrement: 1 } }
            });
            console.log("Coin deducted successfully");
          
            console.log("Creating new session");
            // First create the session with only the fields in the schema
            const newSession = await tx.session.create({
              data: {
                ...sessionData,
                companyId: employee.companyId || "", // Ensure companyId is not null
                status: "IN_PROGRESS", // Set to IN_PROGRESS directly since we're creating a seal
                // Create a seal record associated with this session
                seal: {
                  create: {
                    barcode: sealTagIds.length > 0 ? sealTagIds[0] : `GENERATED-${Date.now()}`,
                    verified: false, // Explicitly set to false to ensure it shows up for guards
                    scannedAt: null
                  }
                },
                // Create SealTag records for each seal tag
                sealTags: {
                  create: sealTagIds.map((tagId: string) => ({
                    barcode: tagId,
                    method: sealTagMethods[tagId] || 'digitally scanned',
                    // Store image URL - can be updated later when images are processed
                    imageUrl: null
                  }))
                }
              },
              include: {
                seal: true,
                sealTags: true
              }
            }).catch((error: Error) => {
              console.error("Error creating session:", error);
              throw new Error(`Session creation failed: ${error.message}`);
            });
            
            console.log(`Session created with ID: ${newSession.id}`);
            console.log(`Seal created with ID: ${newSession.seal?.id}, barcode: ${newSession.seal?.barcode}, verified: ${newSession.seal?.verified}`);
            console.log(`Created ${newSession.sealTags.length} seal tag records`);
            
            // Double-check that the seal was created correctly
            if (!newSession.seal) {
              console.error("[API ERROR] Seal was not created with session! This will cause issues for guard verification.");
              
              // Create the seal explicitly if it doesn't exist
              try {
                const seal = await tx.seal.create({
                  data: {
                    sessionId: newSession.id,
                    barcode: sealTagIds.length > 0 ? sealTagIds[0] : `FALLBACK-${Date.now()}`,
                    verified: false
                  }
                });
                console.log(`[API RECOVERY] Created fallback seal: ${seal.id}, barcode: ${seal.barcode}`);
              } catch (sealError) {
                console.error("[API ERROR] Failed to create fallback seal:", sealError);
              }
            }
            
            console.log(`Using ${sealTagIds.length} seal tags from operator.`);

            console.log("Creating coin transaction record");
            // Create coin transaction record - coin is spent, not transferred
            await tx.coinTransaction.create({
              data: {
                fromUserId: userId as string,
                toUserId: userId as string, // Operator spends the coin (not transferred to another user)
                amount: 1,
                reason: "SESSION_CREATION",
                reasonText: `Session ID: ${newSession.id} - Session creation cost`
              }
            }).catch((error: Error) => {
              console.error("Error creating coin transaction:", error);
              throw new Error(`Coin transaction failed: ${error.message}`);
            });
            console.log("Coin transaction created successfully");
            
            console.log("Storing trip details in activity log");
            // Store all the trip details in the activity log
            await tx.activityLog.create({
              data: {
                userId: userId as string,
                action: "CREATE",
                targetResourceId: newSession.id,
                targetResourceType: "session",
                details: {
                  tripDetails: {
                    ...sessionData,
                  },
                  images: {
                    gpsImeiPicture: gpsImeiPicture ? `/api/images/${newSession.id}/gpsImei` : null,
                    vehicleNumberPlatePicture: vehicleNumberPlatePicture ? `/api/images/${newSession.id}/vehicleNumber` : null,
                    driverPicture: driverPicture ? `/api/images/${newSession.id}/driver` : null,
                    sealingImages: Array.from({ length: getFileCountFromFormData(formData, 'sealingImages') }, 
                      (_, i) => `/api/images/${newSession.id}/sealing/${i}`),
                    vehicleImages: Array.from({ length: getFileCountFromFormData(formData, 'vehicleImages') }, 
                      (_, i) => `/api/images/${newSession.id}/vehicle/${i}`),
                    additionalImages: Array.from({ length: getFileCountFromFormData(formData, 'additionalImages') }, 
                      (_, i) => `/api/images/${newSession.id}/additional/${i}`),
                  },
                  timestamps: {
                    loadingDetails: loadingDetailsTimestamps ? JSON.parse(loadingDetailsTimestamps as string) : {},
                    imagesForm: imagesFormTimestamps ? JSON.parse(imagesFormTimestamps as string) : {},
                  },
                  qrCodes: {
                    primaryBarcode: sealTagIds.length > 0 ? sealTagIds[0] : "",
                    additionalBarcodes: sealTagIds.length > 1 ? sealTagIds.slice(1) : [],
                  },
                  sealTagData: {
                    sealTagIds,
                    sealTagMethods,
                    sealTagTimestamps
                  }
                }
              }
            }).catch((error: Error) => {
              console.error("Error creating activity log for trip details:", error);
              throw new Error(`Activity log creation failed: ${error.message}`);
            });
            console.log("Trip details stored successfully");

            console.log("Storing base64 image data in activity log");
            
            // Check the size of the JSON before storing
            const imageDataSize = JSON.stringify(imageBase64Data).length;
            console.log(`Size of base64 image data: ${imageDataSize} bytes (${(imageDataSize / (1024 * 1024)).toFixed(2)}MB)`);
            
            // // Image data may be too large - Prisma has limits for JSON fields
            // const MAX_JSON_SIZE = 20 * 1024 * 1024; // 20MB limit to match our client-side total limit
            // if (imageDataSize > MAX_JSON_SIZE) {
            //   console.error(`Base64 image data too large: ${imageDataSize} bytes exceeds limit of ${MAX_JSON_SIZE} bytes`);
            //   throw new Error(`Base64 image data too large (${(imageDataSize / (1024 * 1024)).toFixed(2)}MB). Please use smaller or fewer images. Try reducing resolution or quality.`);
            // }
            
            // Store base64 image data in a separate activity log entry
            await tx.activityLog.create({
              data: {
                userId: userId as string,
                action: "CREATE", // Changed from "STORE_IMAGES" to a valid ActivityAction enum value
                targetResourceId: newSession.id,
                targetResourceType: "session",
                details: {
                  imageBase64Data
                }
              }
            }).catch((error: Error) => {
              console.error("Error storing base64 image data:", error);
              throw new Error(`Storing image data failed: ${error.message}. Try reducing image count, size, or quality.`);
            });
            console.log("Base64 image data stored successfully");
            
            return { session: newSession };
          } catch (error) {
            console.error("Error in database transaction:", error);
            throw error; // Rethrow to trigger transaction rollback
          }
        });
        
        console.log("Database transaction completed successfully");
        
        // Skip file storage since we're using base64
        
        return NextResponse.json({
          success: true,
          sessionId: result.session.id,
          message: "Session created successfully",
        });
      } catch (error) {
        console.error("Error in session creation transaction:", error);
        
        // Provide more specific error message
        let errorMessage = "Database transaction failed";
        let statusCode = 500;
        
        if (error instanceof Error) {
          errorMessage = error.message;
          
          // Check for specific error patterns to provide better guidance
          if (errorMessage.includes("base64") && errorMessage.includes("large")) {
            statusCode = 413; // Payload Too Large
            errorMessage = `${error.message} Try using fewer images or smaller images (max 5MB per image, total 20MB).`;
          } else if (errorMessage.includes("too large")) {
            statusCode = 413;
          } else if (errorMessage.includes("JSON")) {
            statusCode = 413;
            errorMessage = "Data payload is too large. Try using fewer or smaller images.";
          } else if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
            errorMessage = "Request timed out processing images. Try using smaller or fewer images.";
          }
        }
        
        return NextResponse.json(
          { error: `Failed to create session: ${errorMessage}` },
          { status: statusCode }
        );
      }
    } catch (error) {
      console.error("Error creating session:", error);
      
      // Handle different types of errors with appropriate status codes
      if (error instanceof Error) {
        if (error.message.includes("too large") || error.message.includes("size limit")) {
          return NextResponse.json(
            { error: `Failed to create session: ${error.message}` },
            { status: 413 }
          );
        } else if (error.message.includes("Unauthorized") || error.message.includes("permission")) {
          return NextResponse.json(
            { error: `Failed to create session: ${error.message}` },
            { status: 403 }
          );
        } else if (error.message.includes("not found")) {
          return NextResponse.json(
            { error: `Failed to create session: ${error.message}` },
            { status: 404 }
          );
        }
      }
      
      // Default error response
      return NextResponse.json(
        { error: error instanceof Error ? `Failed to create session: ${error.message}` : "Failed to create session due to an unknown error" },
        { status: 500 }
      );
    }
  },
  [UserRole.EMPLOYEE]
);

// Helper function to count files with a specific prefix
function getFileCountFromFormData(formData: FormData, prefix: string): number {
  let count = 0;
  for (const key of formData.keys()) {
    if (key.startsWith(prefix)) {
      count++;
    }
  }
  return count;
} 