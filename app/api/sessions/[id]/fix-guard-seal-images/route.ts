import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { withAuth } from "@/lib/auth";
import { ActivityLog } from "@prisma/client";

/**
 * Special endpoint to fix guard seal tag images
 * This will look for guard seal tag images in activity logs and update the GuardSealTag records
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
    console.log(`[API DEBUG] Fixing guard seal tag images for session ${sessionId}`);
    
    // Get the session with guard seal tags
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { guardSealTags: true }
    });
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    // Find activity logs with image data
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: sessionId,
        targetResourceType: 'session',
        action: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Find the log that contains guard image data
    const imageLog = activityLogs.find((log: ActivityLog) => {
      const details = log.details as any;
      return details && 
             typeof details === 'object' && 
             details.guardImageBase64Data && 
             details.guardImageBase64Data.sealTagImages;
    });
    
    if (!imageLog) {
      return NextResponse.json({ 
        message: "No guard image data found in activity logs",
        fixed: 0
      });
    }
    
    // Process the guard seal tag images
    const details = imageLog.details as any;
    const guardSealTagImages = details.guardImageBase64Data.sealTagImages || {};
    const guardSealTags = session.guardSealTags;
    
    console.log(`[API DEBUG] Found ${guardSealTags.length} guard seal tags and ${Object.keys(guardSealTagImages).length} guard seal tag images`);
    
    // Track how many we fixed
    let fixedCount = 0;
    
    // Update each guard seal tag with image data
    for (const tag of guardSealTags) {
      if (guardSealTagImages[tag.barcode] && guardSealTagImages[tag.barcode].data) {
        const contentType = guardSealTagImages[tag.barcode].contentType || 'image/jpeg';
        const imageData = `data:${contentType};base64,${guardSealTagImages[tag.barcode].data}`;
        
        // Update the guard seal tag with the image data
        await prisma.guardSealTag.update({
          where: { id: tag.id },
          data: { imageData }
        });
        
        fixedCount++;
        console.log(`[API DEBUG] Updated guard seal tag ${tag.barcode} with image data`);
      }
    }
    
    return NextResponse.json({
      message: `Successfully updated ${fixedCount} guard seal tags with image data`,
      total: guardSealTags.length,
      fixed: fixedCount
    });
  } catch (error) {
    console.error("[API ERROR] Error fixing guard seal tag images:", error);
    return NextResponse.json(
      { error: "Failed to fix guard seal tag images", details: String(error) },
      { status: 500 }
    );
  }
}

// Export the handler with authentication
export const GET = withAuth(
  handler,
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 