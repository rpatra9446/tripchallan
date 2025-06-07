import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addActivityLog } from "@/lib/activity-logger";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const data = await request.json();
    
    // Get session ID from params
    const sessionId = params.id;
    
    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        company: true,
        seal: true
      }
    });
    
    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check permission based on user role
    const userId = session.user.id;
    const userRole = session.user.role;
    const userSubrole = session.user.subrole;
    
    // Only operators with edit permission can edit sessions
    if (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.OPERATOR) {
      // Check if operator has permission to edit sessions
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          operatorPermissions: true,
        },
      });
      
      if (!employee?.operatorPermissions?.canModify) {
        return NextResponse.json(
          { error: "You don't have permission to edit sessions" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "You don't have permission to edit sessions" },
        { status: 403 }
      );
    }
    
    // Process image updates if any
    const imageUpdates = data.images || {};
    
    // Debug the incoming data
    console.log("Updating session with data:", {
      sessionId,
      source: data.source,
      destination: data.destination,
      tripDetailsFields: data.tripDetails ? Object.keys(data.tripDetails) : [],
      imageFields: Object.keys(imageUpdates)
    });
    
    // Update seal information if provided and not already verified
    let sealUpdates: any = undefined;
    if (data.seal && data.seal.barcode) {
      // Check if the session already has a seal
      if (existingSession.seal) {
        // Only allow updating if the seal is not verified
        if (!existingSession.seal.verified) {
          sealUpdates = {
            seal: {
              update: {
                barcode: data.seal.barcode
              }
            }
          };
        }
      } else {
        // Create new seal
        sealUpdates = {
          seal: {
            create: {
              barcode: data.seal.barcode,
              verified: false
            }
          }
        };
      }
    }
    
    // Update session with new data
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        source: data.source,
        destination: data.destination,
        
        // Update individual tripDetails fields if provided
        ...(data.tripDetails && {
          // Handle each field individually with proper null/undefined checking
          ...(data.tripDetails.transporterName !== undefined && { transporterName: data.tripDetails.transporterName }),
          ...(data.tripDetails.materialName !== undefined && { materialName: data.tripDetails.materialName }),
          ...(data.tripDetails.vehicleNumber !== undefined && { vehicleNumber: data.tripDetails.vehicleNumber }),
          ...(data.tripDetails.gpsImeiNumber !== undefined && { gpsImeiNumber: data.tripDetails.gpsImeiNumber }),
          ...(data.tripDetails.driverName !== undefined && { driverName: data.tripDetails.driverName }),
          ...(data.tripDetails.driverContactNumber !== undefined && { driverContactNumber: data.tripDetails.driverContactNumber }),
          ...(data.tripDetails.loaderName !== undefined && { loaderName: data.tripDetails.loaderName }),
          ...(data.tripDetails.challanRoyaltyNumber !== undefined && { challanRoyaltyNumber: data.tripDetails.challanRoyaltyNumber }),
          ...(data.tripDetails.doNumber !== undefined && { doNumber: data.tripDetails.doNumber }),
          ...(data.tripDetails.freight !== undefined && { freight: data.tripDetails.freight ? Number(data.tripDetails.freight) : null }),
          ...(data.tripDetails.qualityOfMaterials !== undefined && { qualityOfMaterials: data.tripDetails.qualityOfMaterials }),
          ...(data.tripDetails.tpNumber !== undefined && { tpNumber: data.tripDetails.tpNumber }),
          ...(data.tripDetails.grossWeight !== undefined && { grossWeight: data.tripDetails.grossWeight ? Number(data.tripDetails.grossWeight) : null }),
          ...(data.tripDetails.tareWeight !== undefined && { tareWeight: data.tripDetails.tareWeight ? Number(data.tripDetails.tareWeight) : null }),
          ...(data.tripDetails.netMaterialWeight !== undefined && { netMaterialWeight: data.tripDetails.netMaterialWeight ? Number(data.tripDetails.netMaterialWeight) : null }),
          ...(data.tripDetails.loaderMobileNumber !== undefined && { loaderMobileNumber: data.tripDetails.loaderMobileNumber }),
          ...(data.tripDetails.loadingSite !== undefined && { loadingSite: data.tripDetails.loadingSite }),
          ...(data.tripDetails.receiverPartyName !== undefined && { receiverPartyName: data.tripDetails.receiverPartyName }),
          ...(data.tripDetails.cargoType !== undefined && { cargoType: data.tripDetails.cargoType }),
          ...(data.tripDetails.numberOfPackages !== undefined && { numberOfPackages: data.tripDetails.numberOfPackages }),
          ...(data.tripDetails.registrationCertificate !== undefined && { registrationCertificate: data.tripDetails.registrationCertificate }),
          ...(data.tripDetails.driverLicense !== undefined && { driverLicense: data.tripDetails.driverLicense })
        }),
        
        // We don't directly update image fields in the Session model
        // They are stored in activity logs and presented as URLs
        
        // Update seal if needed
        ...sealUpdates,
        
        // Note: There is no updatedAt field in the Session model according to the Prisma schema
      },
      include: {
        company: true,
        seal: true
      },
    });
    
    // Log activity - store images in the activity log since they're not direct fields
    await addActivityLog({
      action: ActivityAction.UPDATE,
      userId: userId,
      targetResourceId: sessionId,
      targetResourceType: "SESSION",
      details: {
        sessionId: sessionId,
        updates: {
          source: data.source,
          destination: data.destination,
          ...(data.tripDetails && { tripDetails: data.tripDetails }),
          ...(data.seal && { seal: data.seal })
        },
        // Store images separately to match the expected format
        ...(data.images && { images: data.images }),
      },
    });
    
    // Add timestamp entries for updated fields
    if (data.tripDetails) {
      const timestamp = new Date();
      
      // Get the existing session data to compare with
      const existingSessionData = {
        transporterName: existingSession.transporterName || '',
        materialName: existingSession.materialName || '',
        vehicleNumber: existingSession.vehicleNumber || '',
        gpsImeiNumber: existingSession.gpsImeiNumber || '',
        driverName: existingSession.driverName || '',
        driverContactNumber: existingSession.driverContactNumber || '',
        loaderName: existingSession.loaderName || '',
        challanRoyaltyNumber: existingSession.challanRoyaltyNumber || '',
        doNumber: existingSession.doNumber || '',
        freight: existingSession.freight || 0,
        qualityOfMaterials: existingSession.qualityOfMaterials || '',
        tpNumber: existingSession.tpNumber || '',
        grossWeight: existingSession.grossWeight || 0,
        tareWeight: existingSession.tareWeight || 0,
        netMaterialWeight: existingSession.netMaterialWeight || 0,
        loaderMobileNumber: existingSession.loaderMobileNumber || '',
        loadingSite: existingSession.loadingSite || '',
        receiverPartyName: existingSession.receiverPartyName || '',
        cargoType: existingSession.cargoType || '',
        numberOfPackages: existingSession.numberOfPackages || '',
        registrationCertificate: existingSession.registrationCertificate || '',
        driverLicense: existingSession.driverLicense || ''
      };
      
      // Only update timestamps for fields that have actually changed
      const changedFields = Object.keys(data.tripDetails).filter(fieldName => {
        const oldValue = existingSessionData[fieldName as keyof typeof existingSessionData];
        const newValue = data.tripDetails[fieldName];
        
        // Compare stringified values to handle different types
        return String(oldValue) !== String(newValue);
      });
      
      console.log("Changed fields:", changedFields);
      
      if (changedFields.length === 0) {
        console.log("No fields have changed, skipping timestamp updates");
      }
      
      const timestampPromises = changedFields.map(fieldName => {
        // Convert the field name to match the expected format for loading details
        const timestampFieldName = `loadingDetails.${fieldName}`;
        
        console.log(`Updating timestamp for field: ${fieldName}`);
        
        return prisma.sessionFieldTimestamps.upsert({
          where: {
            sessionId_fieldName: {
              sessionId: sessionId,
              fieldName: timestampFieldName
            }
          },
          update: {
            timestamp: timestamp,
            updatedById: userId
          },
          create: {
            sessionId: sessionId,
            fieldName: timestampFieldName,
            timestamp: timestamp,
            updatedById: userId
          }
        });
      });
      
      if (timestampPromises.length > 0) {
        await Promise.all(timestampPromises);
      }
    }
    
    // Add timestamp entries for updated image fields - these are still tracked even though
    // images aren't direct fields on the Session model
    if (data.images) {
      const timestamp = new Date();
      
      // Get all existing activity logs to find current image values
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'SESSION',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      // Find the most recent log with image data
      const imageLog = activityLogs.find((log: any) => 
        log.details && 
        typeof log.details === 'object' && 
        ((log.details as any).images || (log.details as any).imageBase64Data)
      );
      
      // Extract existing images
      const existingImages: Record<string, any> = {};
      
      if (imageLog?.details) {
        const details = imageLog.details as any;
        
        if (details.images) {
          Object.keys(details.images).forEach(key => {
            existingImages[key] = details.images[key];
          });
        }
      }
      
      // Only update timestamps for images that have actually changed
      const changedImageFields = Object.keys(data.images).filter(fieldName => {
        // For arrays, check if the length has changed
        if (Array.isArray(data.images[fieldName]) && Array.isArray(existingImages[fieldName])) {
          return data.images[fieldName].length !== existingImages[fieldName].length;
        }
        
        // For single values, check if the value has changed
        return data.images[fieldName] !== existingImages[fieldName];
      });
      
      console.log("Changed image fields:", changedImageFields);
      
      if (changedImageFields.length === 0) {
        console.log("No image fields have changed, skipping timestamp updates");
      }
      
      const imageTimestampPromises = changedImageFields.map(fieldName => {
        // Convert the field name to match the expected format for images
        const timestampFieldName = `images.${fieldName}`;
        
        console.log(`Updating timestamp for image field: ${fieldName}`);
        
        return prisma.sessionFieldTimestamps.upsert({
          where: {
            sessionId_fieldName: {
              sessionId: sessionId,
              fieldName: timestampFieldName
            }
          },
          update: {
            timestamp: timestamp,
            updatedById: userId
          },
          create: {
            sessionId: sessionId,
            fieldName: timestampFieldName,
            timestamp: timestamp,
            updatedById: userId
          }
        });
      });
      
      if (imageTimestampPromises.length > 0) {
        await Promise.all(imageTimestampPromises);
      }
    }
    
    return NextResponse.json(updatedSession);
  } catch (error: any) {
    console.error("Error updating session:", error);
    console.error("Error details:", error.stack);
    
    // Return more detailed error information
    return NextResponse.json(
      { 
        error: `Failed to update session: ${error.message}`,
        details: error.stack
      },
      { status: 500 }
    );
  }
} 