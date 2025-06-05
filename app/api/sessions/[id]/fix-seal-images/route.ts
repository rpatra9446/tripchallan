import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { withAuth } from "@/lib/auth";
import { ActivityLog } from "@prisma/client";

/**
 * Special endpoint to fix seal tag images
 * This will look for seal tag images in activity logs and update the SealTag records
 */

// Define the handler outside of the withAuth call
async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const sessionId = context.params.id;
    console.log(`[API DEBUG] Fixing seal tag images for session ${sessionId}`);
    
    // Get the session with seal tags
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { sealTags: true }
    });
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    // Find activity logs with image data
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: sessionId,
        targetResourceType: 'session',
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Find the log that contains image data
    const imageLog = activityLogs.find((log: ActivityLog) => {
      const details = log.details as any;
      return details && 
             typeof details === 'object' && 
             details.imageBase64Data && 
             details.imageBase64Data.sealTagImages;
    });
    
    if (!imageLog) {
      return NextResponse.json({ 
        message: "No image data found in activity logs",
        fixed: 0
      });
    }
    
    // Process the seal tag images
    const details = imageLog.details as any;
    const sealTagImages = details.imageBase64Data.sealTagImages || {};
    const sealTags = session.sealTags;
    
    console.log(`[API DEBUG] Found ${sealTags.length} seal tags and ${Object.keys(sealTagImages).length} seal tag images`);
    
    // Track how many we fixed
    let fixedCount = 0;
    
    // Update each seal tag with image data
    for (const tag of sealTags) {
      if (sealTagImages[tag.barcode] && sealTagImages[tag.barcode].data) {
        const contentType = sealTagImages[tag.barcode].contentType || 'image/jpeg';
        const imageData = `data:${contentType};base64,${sealTagImages[tag.barcode].data}`;
        
        // Update the seal tag with the image data
        await prisma.sealTag.update({
          where: { id: tag.id },
          data: { imageData }
        });
        
        fixedCount++;
        console.log(`[API DEBUG] Updated seal tag ${tag.barcode} with image data`);
      }
    }
    
    return NextResponse.json({
      message: `Successfully updated ${fixedCount} seal tags with image data`,
      total: sealTags.length,
      fixed: fixedCount
    });
  } catch (error) {
    console.error("[API ERROR] Error fixing seal tag images:", error);
    return NextResponse.json(
      { error: "Failed to fix seal tag images", details: String(error) },
      { status: 500 }
    );
  }
}

// Export the handler with authentication
export const GET = withAuth(
  handler,
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 