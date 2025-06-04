import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";

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
      select: { id: true, role: true, subrole: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can upload seal tag images
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can upload seal tag images" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const guardSealTagId = formData.get("guardSealTagId") as string;
    
    if (!file || !guardSealTagId) {
      return NextResponse.json(
        { error: "File and guardSealTagId are required" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create media record
    const media = await prisma.media.create({
      data: {
        type: 'GUARD_SEAL_TAG',
        mimeType: file.type,
        data: buffer
      }
    });
    
    // Update guard seal tag with media ID
    await prisma.guardSealTag.update({
      where: { id: guardSealTagId },
      data: {
        mediaId: media.id
      }
    });
    
    return NextResponse.json({ success: true, mediaId: media.id });
  } catch (error) {
    console.error("Error uploading guard seal tag image:", error);
    return NextResponse.json(
      { error: "Failed to upload guard seal tag image" },
      { status: 500 }
    );
  }
} 