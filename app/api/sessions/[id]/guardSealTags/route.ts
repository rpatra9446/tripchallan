import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const sessionId = params.id;

    // Fetch guard seal tags for the session
    const guardSealTags = await prisma.guardSealTag.findMany({
      where: { sessionId },
      include: {
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    return NextResponse.json(guardSealTags);
  } catch (error) {
    console.error("Error fetching guard seal tags:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard seal tags" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[API] POST /api/sessions/${params.id}/guardSealTags - Starting request processing`);
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log(`[API] Unauthorized request`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, role: true, subrole: true }
    });

    if (!user) {
      console.log(`[API] User not found: ${session.user.email}`);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can create guard seal tags
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      console.log(`[API] User not authorized - role: ${user.role}, subrole: ${user.subrole}`);
      return NextResponse.json(
        { error: "Only guards can create guard seal tags" },
        { status: 403 }
      );
    }

    const sessionId = params.id;
    console.log(`[API] Processing request for session: ${sessionId}`);

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      console.log(`[API] Session not found: ${sessionId}`);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Parse request body with error handling
    let body;
    try {
      body = await req.json();
      console.log(`[API] Request body parsed successfully`);
    } catch (error) {
      console.error(`[API] Error parsing request body:`, error);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    
    const { barcode, method, imageData } = body;

    if (!barcode || !method) {
      console.log(`[API] Missing required fields - barcode: ${!!barcode}, method: ${!!method}`);
      return NextResponse.json({ error: "Barcode and method are required" }, { status: 400 });
    }

    // Check if image data is too large
    if (imageData && typeof imageData === 'string' && imageData.length > 5000000) { // 5MB
      console.log(`[API] Image data too large: ${imageData.length} bytes`);
      return NextResponse.json({ 
        error: "Image data too large, please compress the image to less than 5MB" 
      }, { status: 413 });
    }

    // Check if this guard seal tag already exists
    const existingTag = await prisma.guardSealTag.findFirst({
      where: {
        sessionId,
        barcode
      }
    });

    if (existingTag) {
      console.log(`[API] Guard seal tag already exists for barcode: ${barcode}`);
      return NextResponse.json({ 
        error: "Guard seal tag with this barcode already exists",
        existingTag 
      }, { status: 409 });
    }

    console.log(`[API] Creating guard seal tag with barcode: ${barcode}, method: ${method}`);
    console.log(`[API] Image data present: ${imageData ? 'Yes' : 'No'}`);
    if (imageData) {
      console.log(`[API] Image data size: ${typeof imageData === 'string' ? imageData.length : 'not a string'} bytes`);
    }

    // Store directly in imageData field
    try {
      const guardSealTag = await prisma.guardSealTag.create({
        data: {
          barcode,
          method,
          sessionId,
          verifiedById: user.id,
          status: "VERIFIED",
          imageData: imageData // Store base64 image directly
        },
        include: {
          verifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        }
      });

      console.log(`[API] Guard seal tag created successfully with ID: ${guardSealTag.id}`);
      return NextResponse.json(guardSealTag);
    } catch (dbError) {
      console.error(`[API] Database error creating guard seal tag:`, dbError);
      return NextResponse.json(
        { error: "Failed to create guard seal tag in database", details: String(dbError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] Error creating guard seal tag:", error);
    return NextResponse.json(
      { error: "Failed to create guard seal tag", details: String(error) },
      { status: 500 }
    );
  }
} 