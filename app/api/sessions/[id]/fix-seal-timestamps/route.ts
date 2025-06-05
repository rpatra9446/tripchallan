import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { withAuth } from "@/lib/auth";
import { ActivityLog } from "@prisma/client";

/**
 * Special endpoint to fix seal tag timestamps
 * This will look for seal tag timestamps in activity logs and update the SealTag records
 */
async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const sessionId = context.params.id;
    console.log(`[API DEBUG] Fixing seal tag timestamps for session ${sessionId}`);
    
    // Get the session with seal tags
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { sealTags: true }
    });
    
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    
    // Find activity logs with timestamp data
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: sessionId,
        targetResourceType: 'session',
        action: 'CREATE',
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Find the log that contains sealTagData with timestamps
    const timestampLog = activityLogs.find((log: ActivityLog) => {
      const details = log.details as any;
      return details && 
             typeof details === 'object' && 
             details.sealTagData && 
             details.sealTagData.sealTagTimestamps;
    });
    
    if (!timestampLog) {
      return NextResponse.json({ 
        message: "No timestamp data found in activity logs",
        fixed: 0
      });
    }
    
    // Process the seal tag timestamps
    const details = timestampLog.details as any;
    const sealTagTimestamps = details.sealTagData.sealTagTimestamps || {};
    const sealTags = session.sealTags;
    
    console.log(`[API DEBUG] Found ${sealTags.length} seal tags and ${Object.keys(sealTagTimestamps).length} seal tag timestamps`);
    
    // Track how many we fixed
    let fixedCount = 0;
    
    // Update each seal tag with its timestamp
    for (const tag of sealTags) {
      if (sealTagTimestamps[tag.barcode]) {
        const timestamp = new Date(sealTagTimestamps[tag.barcode]);
        
        // Update the seal tag with the correct timestamp
        await prisma.sealTag.update({
          where: { id: tag.id },
          data: { createdAt: timestamp }
        });
        
        fixedCount++;
        console.log(`[API DEBUG] Updated seal tag ${tag.barcode} with timestamp ${timestamp.toISOString()}`);
      }
    }
    
    return NextResponse.json({
      message: `Successfully updated ${fixedCount} seal tags with individual timestamps`,
      total: sealTags.length,
      fixed: fixedCount
    });
  } catch (error) {
    console.error("[API ERROR] Error fixing seal tag timestamps:", error);
    return NextResponse.json(
      { error: "Failed to fix seal tag timestamps", details: String(error) },
      { status: 500 }
    );
  }
}

// Export the handler with authentication
export const GET = withAuth(
  handler,
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 