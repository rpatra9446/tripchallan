import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { hash, compare } from "bcrypt";
import { ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { currentPassword, newPassword } = await req.json();
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }
    
    // Get user from database with hashed password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Compare provided current password with stored hash
    const passwordsMatch = await compare(currentPassword, user.password);
    
    if (!passwordsMatch) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      );
    }
    
    // Hash the new password
    const hashedPassword = await hash(newPassword, 10);
    
    // Update the user's password
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword }
    });
    
    // Log the password change activity
    await addActivityLog({
      userId: session.user.id,
      action: ActivityAction.UPDATE,
      details: {
        entityType: "USER",
        passwordChanged: true,
        summaryText: `Password changed`
      },
      targetUserId: session.user.id,
      targetResourceId: session.user.id,
      targetResourceType: "USER"
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "An error occurred while changing password" },
      { status: 500 }
    );
  }
} 