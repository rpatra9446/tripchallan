import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { withAuth } from "@/lib/auth";
import { addActivityLog } from "@/lib/activity-logger";

/**
 * API endpoint to update a specific field in a session and record the timestamp
 */
async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Get session ID from URL params
    const sessionId = context.params.id;
    
    // Get the current user from the session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Only OPERATOR role can update session fields
    if (session.user.subrole !== EmployeeSubrole.OPERATOR) {
      return NextResponse.json(
        { error: "Only operators can update session fields" },
        { status: 403 }
      );
    }
    
    // Extract data from request body
    const { fieldName, value } = await req.json();
    
    // Validate required fields
    if (!fieldName) {
      return NextResponse.json(
        { error: "Field name is required" },
        { status: 400 }
      );
    }
    
    // Get the session to check if it exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    
    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    // We'll use a transaction to ensure both the session update and timestamp record are created
    const result = await prisma.$transaction(async (tx: any) => {
      // Update the session field
      const updateData: Record<string, any> = {};
      updateData[fieldName] = value;
      
      const updatedSession = await tx.session.update({
        where: { id: sessionId },
        data: updateData,
      });
      
      // Create or update the field timestamp
      const updatedTimestamp = await tx.sessionFieldTimestamps.upsert({
        where: {
          sessionId_fieldName: {
            sessionId: sessionId,
            fieldName: fieldName,
          },
        },
        create: {
          sessionId: sessionId,
          fieldName: fieldName,
          timestamp: new Date(),
          updatedById: session.user.id,
        },
        update: {
          timestamp: new Date(),
          updatedById: session.user.id,
        },
      });
      
      // Add activity log for the update
      await addActivityLog({
        userId: session.user.id,
        action: ActivityAction.UPDATE,
        details: {
          entityType: "SESSION",
          sessionId: sessionId,
          fieldName: fieldName,
          oldValue: existingSession[fieldName as keyof typeof existingSession],
          newValue: value,
          timestamp: updatedTimestamp.timestamp.toISOString(),
        },
        targetResourceId: sessionId,
        targetResourceType: "SESSION",
      });
      
      return {
        success: true,
        fieldName,
        updatedAt: updatedTimestamp.timestamp,
      };
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error("Error updating session field:", error);
    return NextResponse.json(
      { error: "Failed to update session field" },
      { status: 500 }
    );
  }
}

// Authorize route for employees only
export const PUT = withAuth(handler, [UserRole.EMPLOYEE]);
