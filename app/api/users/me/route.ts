import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/lib/types";

export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      // Prevent browser caching of this response
      const headers = new Headers();
      headers.append('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      headers.append('Pragma', 'no-cache');
      headers.append('Expires', '0');
      
      // Get user details with company info - using a direct database query
      // to ensure we're not getting stale data
      const user = await prisma.$transaction(async (tx) => {
        return tx.user.findUnique({
          where: { id: session.user.id },
          include: {
            company: true
          }
        });
      });
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      // Remove sensitive fields
      const { password, ...userWithoutPassword } = user;
      
      return NextResponse.json(userWithoutPassword, { headers });
    } catch (error) {
      console.error("Error fetching user details:", error);
      return NextResponse.json(
        { error: "Failed to fetch user details" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 