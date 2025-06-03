import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { ActivityAction, EmployeeSubrole, SealStatus, UserRole } from "@/prisma/enums";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sealId: string } }
) {
  try {
    console.log("[API DEBUG] Updating seal status:", params);
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

    // Only guards can update seal status
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can update seal status" },
        { status: 403 }
      );
    }

    const { status, comment, evidence } = await req.json();
    
    // Validate status is a valid SealStatus
    if (!Object.values(SealStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", validStatuses: Object.values(SealStatus) },
        { status: 400 }
      );
    }

    // Get the current seal
    const existingSeal = await prisma.seal.findUnique({
      where: { id: params.sealId },
      include: { session: true }
    });

    if (!existingSeal) {
      return NextResponse.json({ error: "Seal not found" }, { status: 404 });
    }

    // Check if session ID matches
    if (existingSeal.sessionId !== params.id) {
      return NextResponse.json(
        { error: "Seal does not belong to this session" },
        { status: 400 }
      );
    }

    // Check if the current status can be changed to the requested status
    if (existingSeal.status) {
      // Only VERIFIED status can be changed to BROKEN or TAMPERED
      if (existingSeal.status !== SealStatus.VERIFIED && 
          (status === SealStatus.BROKEN || status === SealStatus.TAMPERED)) {
        return NextResponse.json(
          { error: `Cannot change status from ${existingSeal.status} to ${status}` },
          { status: 400 }
        );
      }

      // MISSING, BROKEN, and TAMPERED statuses cannot be changed
      if ((existingSeal.status === SealStatus.MISSING || 
           existingSeal.status === SealStatus.BROKEN ||
           existingSeal.status === SealStatus.TAMPERED) && 
           status !== existingSeal.status) {
        return NextResponse.json(
          { error: `Cannot change status from ${existingSeal.status} to ${status}` },
          { status: 400 }
        );
      }
    }

    // Validate evidence requirements
    if ((status === SealStatus.BROKEN || status === SealStatus.TAMPERED) && !evidence) {
      return NextResponse.json(
        { error: `Evidence is required for ${status} status` },
        { status: 400 }
      );
    }

    // Update the seal status
    const updatedSeal = await prisma.seal.update({
      where: { id: params.sealId },
      data: {
        status,
        statusComment: comment,
        statusUpdatedAt: new Date(),
        statusEvidence: evidence ? JSON.stringify(evidence) : null,
        // If we're marking as VERIFIED, also set the verified flag
        verified: status === SealStatus.VERIFIED ? true : existingSeal.verified,
        // If not already verified and marking as VERIFIED, set the verifiedBy
        verifiedById: status === SealStatus.VERIFIED && !existingSeal.verified 
          ? user.id 
          : existingSeal.verifiedById,
        // If not already scanned and marking as VERIFIED, set the scannedAt
        scannedAt: status === SealStatus.VERIFIED && !existingSeal.scannedAt 
          ? new Date() 
          : existingSeal.scannedAt
      },
      include: {
        session: true,
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
          }
        }
      }
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        action: ActivityAction.UPDATE,
        details: {
          previousStatus: existingSeal.status,
          newStatus: status,
          comment,
          evidence: evidence ? true : false,
          timestamp: new Date().toISOString()
        },
        userId: user.id,
        targetResourceId: params.sealId,
        targetResourceType: 'seal'
      }
    });

    return NextResponse.json({ 
      success: true, 
      seal: updatedSeal 
    });
  } catch (error) {
    console.error("[API ERROR] Error updating seal status:", error);
    return NextResponse.json(
      { error: "Failed to update seal status", details: String(error) },
      { status: 500 }
    );
  }
} 