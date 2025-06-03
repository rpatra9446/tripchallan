import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { EmployeeSubrole, UserRole } from "@/prisma/enums";
import { sendVerificationEmail } from "@/lib/email";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const seal = await prisma.seal.findUnique({
      where: { sessionId },
      include: {
        session: true,
        verifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(seal);
  } catch (error) {
    console.error("Error fetching seal:", error);
    return NextResponse.json(
      { error: "Failed to fetch seal" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can verify seals
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    const { sessionId, verificationData } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Check if the session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        company: true,
        createdBy: true
      }
    });

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check if the session already has a seal
    const existingSeal = await prisma.seal.findUnique({
      where: { sessionId },
    });

    if (existingSeal) {
      return NextResponse.json(
        { error: "Session already has a seal assigned" },
        { status: 400 }
      );
    }

    // Create the seal
    const sealData: any = {
      sessionId,
      barcode: `GENERATED-${Date.now()}`,
    };
    
    // If this is a verification request from a guard
    if (verificationData && user.role === UserRole.EMPLOYEE && user.subrole === EmployeeSubrole.GUARD) {
      // Set the seal as verified immediately
      sealData.verified = true;
      sealData.verifiedById = user.id;
      sealData.scannedAt = new Date();
      
      // Create the seal with verification
    const seal = await prisma.seal.create({
        data: sealData,
        include: {
          verifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              subrole: true,
            }
          },
      },
    });
      
      // Update session status to COMPLETED
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: "COMPLETED" },
      });
      
      // Store verification data in activity log
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "UPDATE",
          targetResourceId: sessionId,
          targetResourceType: "session",
          details: {
            verification: {
              timestamp: new Date().toISOString(),
              sealId: seal.id,
              fieldVerifications: verificationData.fieldVerifications,
              imageVerifications: verificationData.imageVerifications,
              allMatch: verificationData.allMatch
            }
          }
        }
      });
      
      // Get company email to send notification
      let companyEmail = existingSession.company?.email;
      
      if (!companyEmail && existingSession.company?.id) {
        const company = await prisma.company.findUnique({
          where: { id: existingSession.company.id },
          select: { email: true },
        });
        
        companyEmail = company?.email;
      }
      
      // Send email notification if company email is available
      if (companyEmail) {
        try {
          await sendVerificationEmail({
            sessionId,
            sessionDetails: existingSession,
            companyEmail,
            guardName: user.name || 'Guard',
            verificationDetails: verificationData,
            sealDetails: seal,
            timestamp: new Date().toISOString(),
          });
          
          console.log(`[API] Verification email sent to ${companyEmail}`);
        } catch (emailError) {
          console.error("[API] Failed to send verification email:", emailError);
          // Continue execution even if email fails
        }
      } else {
        console.log("[API] No company email found, skipping verification email");
      }
      
      return NextResponse.json({
        ...seal,
        verificationDetails: {
          allMatch: verificationData.allMatch,
          fieldVerifications: verificationData.fieldVerifications
        }
      });
    } else {
      // Create a regular seal
      const seal = await prisma.seal.create({
        data: sealData,
      });

    // Update session status to IN_PROGRESS
    await prisma.session.update({
      where: { id: sessionId },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json(seal);
    }
  } catch (error) {
    console.error("Error creating seal:", error);
    return NextResponse.json(
      { error: "Failed to create seal" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can verify seals
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    const { sealId, verificationData } = await req.json();

    if (!sealId) {
      return NextResponse.json(
        { error: "Seal ID is required" },
        { status: 400 }
      );
    }

    // Validate verification data is present
    if (!verificationData) {
      console.error("Missing verification data in request:", { sealId });
      return NextResponse.json(
        { error: "Verification data is required" },
        { status: 400 }
      );
    }

    // Check if the seal exists
    const existingSeal = await prisma.seal.findUnique({
      where: { id: sealId },
      include: { 
        session: {
          include: {
            company: true,
            createdBy: true
          }
        }
      }
    });

    if (!existingSeal) {
      return NextResponse.json(
        { error: "Seal not found" },
        { status: 404 }
      );
    }

    // Check if the seal is already verified
    if (existingSeal.verified) {
      return NextResponse.json(
        { error: "Seal is already verified" },
        { status: 400 }
      );
    }

    try {
      // Start a transaction to ensure data consistency
      const result = await prisma.$transaction(async (prismaClient: any) => {
        // Type assertion for the transaction client
        const tx = prismaClient as typeof prisma;

    // Update the seal as verified
        const updatedSeal = await tx.seal.update({
      where: { id: sealId },
      data: {
        verified: true,
        verifiedById: user.id,
        scannedAt: new Date(),
      },
      include: {
            verifiedBy: {
              select: {
                id: true,
                name: true, 
                email: true,
                role: true,
                subrole: true,
              }
            },
            session: {
              include: {
                company: true,
                createdBy: true,
              }
            },
      },
    });

    // Update session status to COMPLETED
        await tx.session.update({
      where: { id: updatedSeal.sessionId },
      data: { 
        status: "COMPLETED" 
      },
    });

    // Store verification data in activity log
        await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        targetResourceId: updatedSeal.sessionId,
        targetResourceType: "session",
        details: {
          verification: {
            timestamp: new Date().toISOString(),
            sealId: sealId,
            fieldVerifications: verificationData.fieldVerifications,
            imageVerifications: verificationData.imageVerifications,
            allMatch: verificationData.allMatch
          }
        }
      }
    });

        return updatedSeal;
      });

      // Get company email to send notification (after transaction completion)
      let companyEmail = result.session?.company?.email;
      
      if (!companyEmail && result.session?.company?.id) {
        const company = await prisma.company.findUnique({
          where: { id: result.session.company.id },
          select: { email: true },
        });
        
        companyEmail = company?.email;
      }
      
      // Send email notification if company email is available
      let emailSent = false;
      let emailError: any = null;
      
      if (companyEmail) {
        try {
          const emailResult = await sendVerificationEmail({
            sessionId: result.sessionId,
            sessionDetails: result.session,
            companyEmail,
            guardName: user.name || 'Guard',
            verificationDetails: verificationData,
            sealDetails: result,
            timestamp: new Date().toISOString(),
          });
          
          emailSent = emailResult.success;
          
          if (emailResult.success) {
            console.log(`[API] Verification email sent to ${companyEmail}`);
          } else {
            console.error("[API] Email sending returned error:", emailResult.error);
            emailError = emailResult.error;
          }
        } catch (e) {
          console.error("[API] Failed to send verification email:", e);
          emailError = e;
          // Continue execution even if email fails
        }
      } else {
        console.log("[API] No company email found, skipping verification email");
      }

    return NextResponse.json({
        ...result,
      verificationDetails: {
        allMatch: verificationData.allMatch,
        fieldVerifications: verificationData.fieldVerifications
        },
        emailSent,
        emailError: emailError ? String(emailError) : null
      });
    } catch (txError) {
      console.error("Transaction error during verification:", txError);
      return NextResponse.json(
        { error: "Failed to complete verification transaction" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error verifying seal:", error);
    return NextResponse.json(
      { error: "Failed to verify seal" },
      { status: 500 }
    );
  }
} 