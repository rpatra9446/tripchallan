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
    
    // First check for direct imageData (base64)
    if (guardSealTag.imageData) {
      // Extract content type from the data URL
      const contentType = guardSealTag.imageData.match(/^data:([^;]+);base64,/)?.[1] || 'image/jpeg';
      
      // Extract the base64 part
      const base64Data = guardSealTag.imageData.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }
    
    // If no imageData, check for media
    if (guardSealTag.mediaId && !guardSealTag.media) {
      return NextResponse.json({ error: "Media record not found for this guard seal tag" }, { status: 404 });
    }
    
    // If the guard seal tag has media, return the image data directly
    if (guardSealTag.media) {
      // Return the actual image data with appropriate content type
      return new NextResponse(guardSealTag.media.data, {
        headers: {
          'Content-Type': guardSealTag.media.mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
          'X-Content-Type-Options': 'nosniff'
        }
      });
    }
    
    // If the guard seal tag has an imageUrl but no media, redirect to the image URL
    if (guardSealTag.imageUrl) {
      return NextResponse.redirect(guardSealTag.imageUrl);
    }
    
    // If neither media nor imageUrl is available, return a default image or placeholder
    // Create a transparent 1x1 pixel PNG as fallback
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    return new NextResponse(transparentPixel, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (error) {
    console.error("Error fetching guard seal tag image:", error);
    // Return a default image instead of JSON error
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    return new NextResponse(transparentPixel, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-cache'
      }
    });
  }
} 