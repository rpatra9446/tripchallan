import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { VehicleStatus, VehicleType } from "@/prisma/enums";

// GET /api/vehicles - Retrieve vehicles for the company
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as VehicleStatus | null;
    
    // Build the query
    const query: any = {
      where: {
        companyId: session.user.companyId,
      },
      orderBy: {
        createdAt: 'desc',
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
    };
    
    // Add status filter if provided
    if (status) {
      query.where.status = status;
    }
    
    try {
      const vehicles = await prisma.vehicle.findMany(query);
      return NextResponse.json({ vehicles });
    } catch (dbError) {
      console.error("Database error fetching vehicles:", dbError);
      
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
        error: "Database error: Failed to fetch vehicles", 
        details: errorMessage 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json({ error: "Failed to fetch vehicles", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

// POST /api/vehicles - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    // Check if user is an operator and has permission to create
    if (session.user.role === "EMPLOYEE" && session.user.subrole === "OPERATOR") {
      const permissions = await prisma.operatorPermissions.findUnique({
        where: { userId: session.user.id },
      });
      
      if (!permissions?.canCreate) {
        return NextResponse.json({ error: "You don't have permission to create vehicles" }, { status: 403 });
      }
    }
    
    const data = await request.json();
    
    // Validate required fields
    if (!data.numberPlate) {
      return NextResponse.json({ error: "Vehicle number plate is required" }, { status: 400 });
    }
    
    // Check if vehicle with this number plate already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { numberPlate: data.numberPlate },
    });
    
    if (existingVehicle) {
      return NextResponse.json({ error: "Vehicle with this number plate already exists" }, { status: 409 });
    }
    
    // Create the vehicle
    try {
      const vehicle = await prisma.vehicle.create({
        data: {
          numberPlate: data.numberPlate,
          model: data.model || null,
          manufacturer: data.manufacturer || null,
          yearOfMake: data.yearOfMake ? parseInt(data.yearOfMake) : null,
          vehicleType: data.vehicleType || 'TRUCK',
          registrationCertificate: data.registrationCertificate || null,
          status: VehicleStatus.ACTIVE,
          company: { connect: { id: session.user.companyId } },
          createdBy: { connect: { id: session.user.id } },
        },
      });
      
      return NextResponse.json({ vehicle }, { status: 201 });
    } catch (dbError) {
      console.error("Database error creating vehicle:", dbError);
      
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
        error: "Database error: Failed to create vehicle", 
        details: errorMessage 
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return NextResponse.json({ error: "Failed to create vehicle", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
} 