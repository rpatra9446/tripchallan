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
        },
        media: {
          select: {
            id: true,
            type: true,
            mimeType: true,
          }
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
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, role: true, subrole: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can create guard seal tags
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can create guard seal tags" },
        { status: 403 }
      );
    }

    const sessionId = params.id;

    // Check if session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const { barcode, method, imageData } = body;

    if (!barcode || !method) {
      return NextResponse.json({ error: "Barcode and method are required" }, { status: 400 });
    }

    // Check if this guard seal tag already exists
    const existingTag = await prisma.guardSealTag.findFirst({
      where: {
        sessionId,
        barcode
      }
    });

    if (existingTag) {
      return NextResponse.json({ error: "Guard seal tag with this barcode already exists" }, { status: 409 });
    }

    // Create media record if image data is provided
    let mediaId = null;
    if (imageData) {
      try {
        // Parse the base64 image data
        const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Create media record
          const media = await prisma.media.create({
            data: {
              type: 'GUARD_SEAL_TAG',
              mimeType,
              data: buffer
            }
          });
          
          mediaId = media.id;
        }
      } catch (error) {
        console.error(`Error creating media for guard seal tag:`, error);
        // Continue without media if there's an error
      }
    }

    // Create guard seal tag
    const guardSealTag = await prisma.guardSealTag.create({
      data: {
        barcode,
        method,
        sessionId,
        verifiedById: user.id,
        status: "VERIFIED",
        mediaId
      },
      include: {
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        media: {
          select: {
            id: true,
            type: true,
            mimeType: true,
          }
        }
      }
    });

    return NextResponse.json(guardSealTag);
  } catch (error) {
    console.error("Error creating guard seal tag:", error);
    return NextResponse.json(
      { error: "Failed to create guard seal tag" },
      { status: 500 }
    );
  }
} 