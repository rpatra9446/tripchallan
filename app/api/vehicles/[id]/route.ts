import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { VehicleStatus, VehicleType } from "@/prisma/enums";

// GET /api/vehicles/[id] - Retrieve a specific vehicle
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    const vehicleId = params.id;
    
    try {
      const vehicle = await prisma.vehicle.findUnique({
        where: {
          id: vehicleId,
          companyId: session.user.companyId, // Ensure vehicle belongs to user's company
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      
      if (!vehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      
      return NextResponse.json({ vehicle });
    } catch (dbError) {
      console.error("Database error fetching vehicle:", dbError);
      
      // Check for schema-related errors
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      if (errorMessage.includes("does not exist in the current database")) {
        // Handle schema mismatch specifically
        console.error("Schema mismatch detected. Database schema needs migration.");
        return NextResponse.json({ 
          error: "Database schema error", 
          details: "The database schema needs to be updated. Please run 'npx prisma migrate dev'.",
          message: errorMessage
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: "Database error: Failed to fetch vehicle", 
        details: errorMessage 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error fetching vehicle:", error);
    return NextResponse.json({ error: "Failed to fetch vehicle", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// PATCH /api/vehicles/[id] - Update a vehicle
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    // Check if user is an operator and has permission to modify
    if (session.user.role === "EMPLOYEE" && session.user.subrole === "OPERATOR") {
      const permissions = await prisma.operatorPermissions.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!permissions?.canModify) {
        return NextResponse.json({ error: "You don't have permission to update vehicles" }, { status: 403 });
      }
    }
    
    const vehicleId = params.id;
    
    try {
      // Check if vehicle exists and belongs to user's company
      const existingVehicle = await prisma.vehicle.findUnique({
        where: {
          id: vehicleId,
          companyId: session.user.companyId,
        },
      });
      
      if (!existingVehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      
      const data = await request.json();
      
      // Check for number plate uniqueness if it's being updated
      if (data.numberPlate && data.numberPlate !== existingVehicle.numberPlate) {
        const vehicleWithSamePlate = await prisma.vehicle.findUnique({
          where: { numberPlate: data.numberPlate },
        });
        
        if (vehicleWithSamePlate) {
          return NextResponse.json({ error: "Vehicle with this number plate already exists" }, { status: 409 });
        }
      }
      
      // Prepare update data
      const updateData: any = {};
      
      if (data.numberPlate) updateData.numberPlate = data.numberPlate;
      if (data.model !== undefined) updateData.model = data.model;
      if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
      if (data.yearOfMake !== undefined) updateData.yearOfMake = data.yearOfMake ? parseInt(data.yearOfMake) : null;
      if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType;
      if (data.status && Object.values(VehicleStatus).includes(data.status as VehicleStatus)) {
        updateData.status = data.status;
      }
      
      // Update the vehicle
      const updatedVehicle = await prisma.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
      });
      
      return NextResponse.json({ vehicle: updatedVehicle });
    } catch (dbError) {
      console.error("Database error updating vehicle:", dbError);
      
      // Check for schema-related errors
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      if (errorMessage.includes("does not exist in the current database")) {
        // Handle schema mismatch specifically
        console.error("Schema mismatch detected. Database schema needs migration.");
        return NextResponse.json({ 
          error: "Database schema error", 
          details: "The database schema needs to be updated. Please run 'npx prisma migrate dev'.",
          message: errorMessage
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: "Database error: Failed to update vehicle", 
        details: errorMessage 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error updating vehicle:", error);
    return NextResponse.json({ error: "Failed to update vehicle", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// DELETE /api/vehicles/[id] - Delete a vehicle (soft delete by marking as INACTIVE or hard delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    // Check if user is an operator and has permission to delete
    if (session.user.role === "EMPLOYEE" && session.user.subrole === "OPERATOR") {
      const permissions = await prisma.operatorPermissions.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!permissions?.canDelete) {
        return NextResponse.json({ error: "You don't have permission to deactivate or delete vehicles" }, { status: 403 });
      }
    }
    
    const vehicleId = params.id;
    
    try {
      // Check if vehicle exists and belongs to user's company
      const existingVehicle = await prisma.vehicle.findUnique({
        where: {
          id: vehicleId,
          companyId: session.user.companyId,
        },
      });
      
      if (!existingVehicle) {
        return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
      }
      
      // Check for permanent deletion flag in the request body
      const requestData = request.headers.get('content-type')?.includes('application/json') 
        ? await request.json().catch(() => ({})) 
        : {};
      
      const isPermanentDelete = requestData.permanent === true;
      
      if (isPermanentDelete) {
        // Hard delete the vehicle from the database
        await prisma.vehicle.delete({
          where: { id: vehicleId },
        });
        
        return NextResponse.json({ 
          message: "Vehicle permanently deleted",
        });
      } else {
        // Soft delete by marking as INACTIVE
        const deactivatedVehicle = await prisma.vehicle.update({
          where: { id: vehicleId },
          data: { status: VehicleStatus.INACTIVE },
        });
        
        return NextResponse.json({ 
          message: "Vehicle deactivated successfully",
          vehicle: deactivatedVehicle
        });
      }
    } catch (dbError) {
      console.error("Database error processing vehicle delete/deactivate:", dbError);
      
      // Check for schema-related errors
      const errorMessage = dbError instanceof Error ? dbError.message : String(dbError);
      if (errorMessage.includes("does not exist in the current database")) {
        // Handle schema mismatch specifically
        console.error("Schema mismatch detected. Database schema needs migration.");
        return NextResponse.json({ 
          error: "Database schema error", 
          details: "The database schema needs to be updated. Please run 'npx prisma migrate dev'.",
          message: errorMessage
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: "Database error: Failed to process vehicle deletion request", 
        details: errorMessage 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error handling vehicle delete/deactivate:", error);
    return NextResponse.json({ error: "Failed to process vehicle deletion request", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 