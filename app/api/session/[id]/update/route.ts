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
          transporterName: data.tripDetails.transporterName,
          materialName: data.tripDetails.materialName,
          vehicleNumber: data.tripDetails.vehicleNumber,
          gpsImeiNumber: data.tripDetails.gpsImeiNumber,
          driverName: data.tripDetails.driverName,
          driverContactNumber: data.tripDetails.driverContactNumber,
          loaderName: data.tripDetails.loaderName,
          challanRoyaltyNumber: data.tripDetails.challanRoyaltyNumber,
          doNumber: data.tripDetails.doNumber,
          freight: data.tripDetails.freight ? Number(data.tripDetails.freight) : null,
          qualityOfMaterials: data.tripDetails.qualityOfMaterials,
          tpNumber: data.tripDetails.tpNumber,
          grossWeight: data.tripDetails.grossWeight ? Number(data.tripDetails.grossWeight) : null,
          tareWeight: data.tripDetails.tareWeight ? Number(data.tripDetails.tareWeight) : null,
          netMaterialWeight: data.tripDetails.netMaterialWeight ? Number(data.tripDetails.netMaterialWeight) : null,
          loaderMobileNumber: data.tripDetails.loaderMobileNumber,
          loadingSite: data.tripDetails.loadingSite,
          receiverPartyName: data.tripDetails.receiverPartyName,
          cargoType: data.tripDetails.cargoType,
          numberOfPackages: data.tripDetails.numberOfPackages,
          registrationCertificate: data.tripDetails.registrationCertificate,
          driverLicense: data.tripDetails.driverLicense
        }),
        
        // Update individual image fields
        ...(imageUpdates.gpsImeiPicture !== undefined && { gpsImeiPicture: imageUpdates.gpsImeiPicture }),
        ...(imageUpdates.vehicleNumberPlatePicture !== undefined && { vehicleNumberPlatePicture: imageUpdates.vehicleNumberPlatePicture }),
        ...(imageUpdates.driverPicture !== undefined && { driverPicture: imageUpdates.driverPicture }),
        ...(imageUpdates.sealingImages && { sealingImages: imageUpdates.sealingImages }),
        ...(imageUpdates.vehicleImages && { vehicleImages: imageUpdates.vehicleImages }),
        ...(imageUpdates.additionalImages && { additionalImages: imageUpdates.additionalImages }),
        
        // Update seal if needed
        ...sealUpdates,
        
        // Record update timestamp
        updatedAt: new Date(),
      },
      include: {
        company: true,
        seal: true
      },
    });
    
    // Log activity
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
          ...(data.images && { images: data.images }),
          ...(data.seal && { seal: data.seal })
        },
      },
    });
    
    // Add timestamp entries for updated fields
    if (data.tripDetails) {
      const timestamp = new Date();
      const timestampPromises = Object.keys(data.tripDetails).map(fieldName => {
        // Convert the field name to match the expected format for loading details
        const timestampFieldName = `loadingDetails.${fieldName}`;
        
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
      
      await Promise.all(timestampPromises);
    }
    
    // Add timestamp entries for updated image fields
    if (data.images) {
      const timestamp = new Date();
      const imageTimestampPromises = Object.keys(data.images).map(fieldName => {
        // Convert the field name to match the expected format for images
        const timestampFieldName = `images.${fieldName}`;
        
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
      
      await Promise.all(imageTimestampPromises);
    }
    
    return NextResponse.json(updatedSession);
  } catch (error: any) {
    console.error("Error updating session:", error);
    
    return NextResponse.json(
      { error: `Failed to update session: ${error.message}` },
      { status: 500 }
    );
  }
} 