import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import { resizeAndCompressImage } from "@/lib/imageUtils";

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

    // Only guards can verify seal tags
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seal tags" },
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

    // Check if this seal tag exists in the session
    const existingSealTag = await prisma.sealTag.findFirst({
      where: {
        sessionId,
        barcode
      }
    });

    if (!existingSealTag) {
      return NextResponse.json({ 
        error: "Seal tag not found. This must be verified against an existing operator seal tag." 
      }, { status: 404 });
    }

    // Check if the seal tag is already verified by a guard
    if (existingSealTag.guardUserId) {
      return NextResponse.json({ 
        error: "This seal tag has already been verified by a guard" 
      }, { status: 409 });
    }

    // Update the seal tag with guard verification data
    const updatedSealTag = await prisma.sealTag.update({
      where: { id: existingSealTag.id },
      data: {
        guardMethod: method,
        guardImageData: imageData,
        guardTimestamp: new Date(),
        guardUserId: user.id,
        guardStatus: "VERIFIED"
      },
      include: {
        guardUser: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    });

    return NextResponse.json(updatedSealTag);
  } catch (error) {
    console.error("Error verifying seal tag:", error);
    return NextResponse.json(
      { error: "Failed to verify seal tag" },
      { status: 500 }
    );
  }
} 