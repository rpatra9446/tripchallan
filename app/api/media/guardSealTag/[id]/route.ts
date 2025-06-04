import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    
    if (!id) {
      return NextResponse.json({ error: "Guard seal tag ID is required" }, { status: 400 });
    }
    
    // Find the guard seal tag
    const guardSealTag = await prisma.guardSealTag.findUnique({
      where: { id },
      include: { media: true }
    });
    
    if (!guardSealTag) {
      return NextResponse.json({ error: "Guard seal tag not found" }, { status: 404 });
    }
    
    // If the guard seal tag has a media ID but no media record, return error
    if (guardSealTag.mediaId && !guardSealTag.media) {
      return NextResponse.json({ error: "Media record not found for this guard seal tag" }, { status: 404 });
    }
    
    // If the guard seal tag has media, return the data URL
    if (guardSealTag.media) {
      // Create a data URL from the binary data
      const dataUrl = `data:${guardSealTag.media.mimeType};base64,${Buffer.from(guardSealTag.media.data).toString('base64')}`;
      return NextResponse.json({ dataUrl });
    }
    
    // If the guard seal tag has an imageUrl but no media, return the image URL
    if (guardSealTag.imageUrl) {
      return NextResponse.json({ imageUrl: guardSealTag.imageUrl });
    }
    
    // If neither media nor imageUrl is available, return error
    return NextResponse.json({ error: "No image found for this guard seal tag" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching guard seal tag image:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard seal tag image" },
      { status: 500 }
    );
  }
} 