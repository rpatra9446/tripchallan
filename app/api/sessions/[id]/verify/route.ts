import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { ActivityAction, EmployeeSubrole, SessionStatus, UserRole } from "@/prisma/enums";
import { PrismaClient, Prisma } from "@prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("[API DEBUG] Processing session verification:", params.id);
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

    // Only guards can complete verification
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can complete verification" },
        { status: 403 }
      );
    }

    // Get the session
    const sessionData = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        seal: true,
        company: true,
        createdBy: true
      }
    });

    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get verification data from request
    const verificationData = await req.json();
    
    // Create activity log and update session in a transaction
    const results = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create activity log for verification
      const activityLog = await tx.activityLog.create({
        data: {
          action: ActivityAction.UPDATE,
          userId: user.id,
          targetResourceId: params.id,
          targetResourceType: 'session',
          details: {
            verification: {
              completedBy: {
                id: user.id,
                name: user.name,
                role: user.role,
                subrole: user.subrole
              },
              completedAt: new Date().toISOString(),
              verificationData
            }
          }
        }
      });

      // Update session status to COMPLETED
      const updatedSession = await tx.session.update({
        where: { id: params.id },
        data: {
          status: SessionStatus.COMPLETED
        },
        include: {
          seal: true,
          company: true
        }
      });

      return { session: updatedSession, activityLog };
    });

    console.log("[API] Session verification completed successfully:", params.id);
    
    return NextResponse.json({
      success: true,
      session: results.session
    });
  } catch (error) {
    console.error("[API ERROR] Error in session verification:", error);
    return NextResponse.json(
      { error: "Failed to complete verification", details: String(error) },
      { status: 500 }
    );
  }
}
